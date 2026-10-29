import type { AiModelProvider, AiModelSettings } from '../../app/types/aiAgent'
import Anthropic from '@anthropic-ai/sdk'

/**
 * The workspace's AI connection for AI agents (AI agents → Model settings): Canopy's company Claude
 * key, the workspace's own Claude key, or any OpenAI-compatible endpoint (OpenAI, Azure, Groq,
 * OpenRouter, a local model…). Agents talk to customers on the company's behalf, so this is a
 * workspace setting rather than someone's personal AI connection.
 */

interface SettingsRow { provider: AiModelProvider, model: string | null, base_url: string | null, api_key: string | null, updated_at: string }

export const DEFAULT_OPENAI_BASE_URL = 'https://api.openai.com/v1'

async function loadSettingsRow() {
  return await useTenantDb().prepare('SELECT * FROM ai_model_settings WHERE id = \'default\'').get() as SettingsRow | undefined
}

export async function getAiModelSettings(): Promise<AiModelSettings> {
  const row = await loadSettingsRow()
  const config = useRuntimeConfig()
  const provider = row?.provider ?? 'company'
  return {
    provider,
    model: row?.model || (provider === 'openai' ? config.aiOpenaiModel : config.aiAnthropicModel),
    baseUrl: row?.base_url || DEFAULT_OPENAI_BASE_URL,
    hasApiKey: !!row?.api_key,
    companyKeyAvailable: !!config.anthropicApiKey,
    updatedAt: row?.updated_at,
  }
}

export async function saveAiModelSettings(input: { provider: AiModelProvider, model?: string, baseUrl?: string, apiKey?: string }) {
  const existing = await loadSettingsRow()
  const apiKey = input.apiKey?.trim() ? encryptSecret(input.apiKey.trim()) : (input.provider === existing?.provider ? existing?.api_key : null)
  const now = new Date().toISOString()
  await useTenantDb().prepare(`
    INSERT INTO ai_model_settings (id, provider, model, base_url, api_key, updated_at) VALUES ('default', ?, ?, ?, ?, ?)
    ON CONFLICT (id) DO UPDATE SET provider = excluded.provider, model = excluded.model, base_url = excluded.base_url, api_key = excluded.api_key, updated_at = excluded.updated_at
  `).run(input.provider, input.model?.trim() || null, input.baseUrl?.trim() || null, apiKey ?? null, now)
}

// ── Talking to the model ──────────────────────────────────────────────────

export interface ModelTool { name: string, description: string, parameters: Record<string, unknown> }
export interface ModelToolCall { id: string, name: string, input: Record<string, any> }
export type ModelMessage
  = | { role: 'user', text: string }
    | { role: 'assistant', text?: string, toolCalls?: ModelToolCall[] }
    | { role: 'tool', callId: string, name: string, result: string }
export interface ModelResult { text: string, toolCalls: ModelToolCall[], inputTokens: number, outputTokens: number }

/** Thrown when no AI is set up, or the provider refuses — the agent hands the chat to a person. */
export class AiUnavailableError extends Error {}

interface Connection { kind: 'anthropic' | 'openai', apiKey: string, model: string, baseUrl: string, label: string }

async function connection(): Promise<Connection> {
  const row = await loadSettingsRow()
  const config = useRuntimeConfig()
  const provider = row?.provider ?? 'company'
  if (provider === 'company') {
    if (!config.anthropicApiKey)
      throw new AiUnavailableError('No AI connection: add one in AI agents → Model settings.')
    return { kind: 'anthropic', apiKey: config.anthropicApiKey, model: row?.model || config.aiAnthropicModel, baseUrl: '', label: 'Claude (company key)' }
  }
  if (!row?.api_key)
    throw new AiUnavailableError('The AI connection has no API key. Add it in AI agents → Model settings.')
  const apiKey = decryptSecret(row.api_key)
  return provider === 'anthropic'
    ? { kind: 'anthropic', apiKey, model: row.model || config.aiAnthropicModel, baseUrl: '', label: 'Claude' }
    : { kind: 'openai', apiKey, model: row.model || config.aiOpenaiModel, baseUrl: (row.base_url || DEFAULT_OPENAI_BASE_URL).replace(/\/+$/, ''), label: 'OpenAI-compatible model' }
}

function explain(label: string, status: number | undefined, fallback: string) {
  if (status === 401 || status === 403)
    return `${label} rejected the API key. Check AI agents → Model settings.`
  if (status === 429)
    return `${label} says the usage limit was hit. Try again later.`
  if (status === 404)
    return `${label} doesn't know that model. Check the model name in AI agents → Model settings.`
  return fallback
}

/** One model call with tools. Messages use a provider-neutral shape, translated here. */
export async function callModel(input: { system: string, messages: ModelMessage[], tools: ModelTool[], maxTokens?: number }): Promise<ModelResult> {
  const conn = await connection()
  const maxTokens = input.maxTokens ?? 800
  try {
    if (conn.kind === 'anthropic')
      return await callAnthropic(conn, input.system, input.messages, input.tools, maxTokens)
    return await callOpenAi(conn, input.system, input.messages, input.tools, maxTokens)
  }
  catch (error: any) {
    if (error instanceof AiUnavailableError)
      throw error
    const status = Number(error?.status) || undefined
    console.error(`[ai-agent] ${conn.label} failed`, error?.message ?? error)
    throw new AiUnavailableError(explain(conn.label, status, `${conn.label} didn't respond. ${String(error?.message ?? '').slice(0, 160)}`))
  }
}

async function callAnthropic(conn: Connection, system: string, messages: ModelMessage[], tools: ModelTool[], maxTokens: number): Promise<ModelResult> {
  const client = new Anthropic({ apiKey: conn.apiKey })
  const wire: Anthropic.MessageParam[] = []
  for (const message of messages) {
    if (message.role === 'user') {
      wire.push({ role: 'user', content: message.text })
    }
    else if (message.role === 'assistant') {
      const content: Anthropic.ContentBlockParam[] = []
      if (message.text)
        content.push({ type: 'text', text: message.text })
      for (const call of message.toolCalls ?? [])
        content.push({ type: 'tool_use', id: call.id, name: call.name, input: call.input })
      wire.push({ role: 'assistant', content })
    }
    else {
      // Consecutive tool results go back together in one user turn.
      const block: Anthropic.ToolResultBlockParam = { type: 'tool_result', tool_use_id: message.callId, content: message.result }
      const last = wire.at(-1)
      if (last?.role === 'user' && Array.isArray(last.content) && last.content.every(b => b.type === 'tool_result'))
        last.content.push(block)
      else
        wire.push({ role: 'user', content: [block] })
    }
  }
  const response = await client.messages.create({
    model: conn.model,
    max_tokens: maxTokens,
    system,
    messages: wire,
    tools: tools.map(tool => ({ name: tool.name, description: tool.description, input_schema: tool.parameters as Anthropic.Tool.InputSchema })),
  })
  return {
    text: response.content.filter(block => block.type === 'text').map(block => block.text).join('\n').trim(),
    toolCalls: response.content.filter(block => block.type === 'tool_use').map(block => ({ id: block.id, name: block.name, input: block.input as Record<string, any> })),
    inputTokens: response.usage.input_tokens,
    outputTokens: response.usage.output_tokens,
  }
}

async function callOpenAi(conn: Connection, system: string, messages: ModelMessage[], tools: ModelTool[], maxTokens: number): Promise<ModelResult> {
  const wire: any[] = [{ role: 'system', content: system }]
  for (const message of messages) {
    if (message.role === 'user')
      wire.push({ role: 'user', content: message.text })
    else if (message.role === 'assistant')
      wire.push({ role: 'assistant', content: message.text ?? null, ...(message.toolCalls?.length ? { tool_calls: message.toolCalls.map(call => ({ id: call.id, type: 'function', function: { name: call.name, arguments: JSON.stringify(call.input) } })) } : {}) })
    else
      wire.push({ role: 'tool', tool_call_id: message.callId, content: message.result })
  }
  const response = await fetch(`${conn.baseUrl}/chat/completions`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${conn.apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: conn.model,
      max_tokens: maxTokens,
      messages: wire,
      tools: tools.map(tool => ({ type: 'function', function: { name: tool.name, description: tool.description, parameters: tool.parameters } })),
    }),
    signal: AbortSignal.timeout(60_000),
  })
  if (!response.ok)
    throw Object.assign(new Error(`${response.status} ${(await response.text()).slice(0, 200)}`), { status: response.status })
  const data = await response.json() as any
  const choice = data.choices?.[0]?.message ?? {}
  return {
    text: String(choice.content ?? '').trim(),
    toolCalls: (choice.tool_calls ?? []).map((call: any) => ({ id: call.id, name: call.function?.name, input: safeJson(call.function?.arguments) })),
    inputTokens: Number(data.usage?.prompt_tokens) || 0,
    outputTokens: Number(data.usage?.completion_tokens) || 0,
  }
}

function safeJson(value: unknown): Record<string, any> {
  try {
    return typeof value === 'string' ? JSON.parse(value) : {}
  }
  catch {
    return {}
  }
}
