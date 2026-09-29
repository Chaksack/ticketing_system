import type { AssistantSection } from '../../app/types/assistant'
import type { SessionUser } from './auth'
import Anthropic from '@anthropic-ai/sdk'
import {
  canSeeClients,
  canSeeTickets,
  clientsByStage,
  contractCounts,
  contractsExpiringSoon,
  isAdminUser,
  myClients,
  myTickets,
  onCallStaff,
  overview,
  runAssistantQuery,
  slaBreachSummary,
  staffHeadcount,
  ticketPriorityBreakdown,
  ticketStatusBreakdown,
  ticketVolume,
} from './assistant'

// Fast + cheap models (runtimeConfig.ai*Model) — this is a high-frequency internal utility, not the
// product's main surface, and every "tool" it can call is a trivial DB read.
const MAX_TOOL_ITERATIONS = 4

export interface ChatTurn {
  role: 'user' | 'assistant'
  text: string
}

export interface AssistantChatResult {
  text: string
  sections: AssistantSection[]
  /** Which AI answered, e.g. "Gemini", "ChatGPT", "Claude (company)" — absent for built-in answers. */
  answeredBy?: string
}

interface ToolDef {
  description: string
  allowed: (user: SessionUser) => boolean
  run: (user: SessionUser) => Promise<AssistantSection[]>
}

// One tool per existing report the deterministic assistant already knew how to run — the model
// decides which (if any) fit a question; the actual data access and role gating are unchanged.
const TOOLS: Record<string, ToolDef> = {
  get_ticket_status_breakdown: { description: 'Count of tickets grouped by status (open/in-progress/resolved/closed), across the whole team.', allowed: canSeeTickets, run: () => ticketStatusBreakdown() },
  get_ticket_priority_breakdown: { description: 'Count of tickets grouped by priority (low/medium/high/urgent).', allowed: canSeeTickets, run: () => ticketPriorityBreakdown() },
  get_sla_breach_summary: { description: 'How many tickets are currently overdue on their SLA, and how many were resolved late.', allowed: canSeeTickets, run: () => slaBreachSummary() },
  get_my_tickets: { description: 'The current staff member\'s own assigned tickets, grouped by status.', allowed: canSeeTickets, run: user => myTickets(user) },
  get_ticket_volume: { description: 'How many tickets were created today and in the last 7 days.', allowed: canSeeTickets, run: () => ticketVolume() },
  get_oncall_staff: { description: 'Which staff members are currently marked on-call.', allowed: canSeeTickets, run: () => onCallStaff() },
  get_clients_by_stage: { description: 'Count of clients grouped by pipeline stage (lead/contacted/proposal/negotiation/active/lost).', allowed: canSeeClients, run: () => clientsByStage() },
  get_my_clients: { description: 'The current staff member\'s own assigned clients, grouped by stage.', allowed: canSeeClients, run: user => myClients(user) },
  get_contracts_expiring_soon: { description: 'AMC contracts expiring in the next 30 days, with client, plan, and expiry date.', allowed: canSeeClients, run: () => contractsExpiringSoon() },
  get_contract_counts: { description: 'Count of AMC contracts grouped by display status (submitted/negotiating/active/expiring/lost/expired/cancelled).', allowed: canSeeClients, run: () => contractCounts() },
  get_staff_headcount: { description: 'Count of staff grouped by role.', allowed: isAdminUser, run: () => staffHeadcount() },
  get_overview: { description: 'A general cross-area snapshot (tickets, clients, staff) scoped to whatever the current user\'s role can see. Use this for vague requests like "give me a report" or "how are things looking".', allowed: () => true, run: user => overview(user) },
}

const SYSTEM_PROMPT = `You are the in-app assistant for IBS's internal CRM/ticketing platform, used by a support team and a BD/sales team.

Modules staff use day to day:
- Tickets: customer support requests with SLA targets, auto-assignment, escalation (Engineer -> Engineering Coordinator -> Engineering Lead), macros, tags, automation rules.
- Leads & Tenders: two staged sales pipelines with win-probability, converting into Clients when marked Won.
- Quotes: line-item proposals attached to a Lead/Tender, built from a shared Products catalog.
- Projects, Tasks & Sprints: a kanban board; Tasks can link to a Project and show who they're assigned to.
- Calendar: typed activities (meetings, site visits, etc.), a click-a-day agenda view, PDF export.
- Chat: direct messages, private groups, and self-service Project channels, with @mentions and reactions.
- Settings > Integrations: each staff member can connect their own Slack and Gmail accounts.

You have tools that fetch REAL, live data from the database, already scoped to what the current user's role is allowed to see. Always call a tool for questions about actual data (counts, statuses, who's on call, etc.) instead of guessing or inventing numbers. If no tool fits a data question, say so plainly.
For general "how do I..." or "what is..." questions about how the app works, answer directly using the module descriptions above rather than calling a tool.
If a tool reports the user doesn't have access, explain that plainly and don't try a different tool to work around it.
Keep answers short and direct — a sentence or two is usually enough. This is a busy internal tool, not a conversation to pad out.`

function buildFallbackText(sections: AssistantSection[]): string {
  if (!sections.length)
    return 'I couldn\'t find anything for that.'
  return sections[0]?.heading ? 'Here\'s what I found:' : ''
}

/** Runs one tool call with the usual role check; collects what the user may see for the UI cards. */
async function executeTool(user: SessionUser, name: string, collected: AssistantSection[]): Promise<AssistantSection[]> {
  const tool = TOOLS[name]
  if (!tool)
    return [{ stats: [{ label: 'Error', value: 'Unknown tool' }] }]
  if (!tool.allowed(user))
    return [{ stats: [{ label: 'Access', value: 'You don\'t have access to that data.' }] }]
  const sections = await tool.run(user)
  collected.push(...sections)
  return sections
}

const TOOL_LIST = Object.entries(TOOLS).map(([name, tool]) => ({ name, description: tool.description }))
const TOO_MANY_STEPS = 'That took more steps than expected — try rephrasing your question.'

function providerError(label: string, status: number, detail: string): never {
  if (status === 401 || status === 403)
    throw createError({ statusCode: 400, statusMessage: `${label} rejected your credentials. Reconnect it in Settings → Integrations.` })
  if (status === 429)
    throw createError({ statusCode: 429, statusMessage: `${label} says you've hit its usage or rate limit. Try again later or check your ${label} account.` })
  console.error(`[assistant] ${label} error ${status}: ${detail.slice(0, 500)}`)
  throw createError({ statusCode: 502, statusMessage: `${label} returned an error (HTTP ${status}). Please try again.` })
}

async function chatWithClaude(user: SessionUser, history: ChatTurn[], apiKey: string, collected: AssistantSection[]): Promise<string> {
  const client = new Anthropic({ apiKey })
  const tools: Anthropic.Tool[] = TOOL_LIST.map(t => ({ name: t.name, description: t.description, input_schema: { type: 'object', properties: {} } }))
  const messages: Anthropic.MessageParam[] = history.map(turn => ({ role: turn.role, content: turn.text }))

  for (let iteration = 0; iteration < MAX_TOOL_ITERATIONS; iteration++) {
    let response: Anthropic.Message
    try {
      response = await client.messages.create({ model: useRuntimeConfig().aiAnthropicModel, max_tokens: 1024, system: SYSTEM_PROMPT, tools, messages })
    }
    catch (error: any) {
      providerError('Claude', error?.status ?? 500, String(error?.message ?? error))
    }

    const toolUseBlocks = response.content.filter(block => block.type === 'tool_use')
    if (!toolUseBlocks.length)
      return response.content.filter(block => block.type === 'text').map(block => block.text).join('\n').trim()

    messages.push({ role: 'assistant', content: response.content })
    const toolResults: Anthropic.ToolResultBlockParam[] = []
    for (const block of toolUseBlocks)
      toolResults.push({ type: 'tool_result', tool_use_id: block.id, content: JSON.stringify(await executeTool(user, block.name, collected)) })
    messages.push({ role: 'user', content: toolResults })
  }
  return TOO_MANY_STEPS
}

async function chatWithOpenAi(user: SessionUser, history: ChatTurn[], apiKey: string, collected: AssistantSection[]): Promise<string> {
  const tools = TOOL_LIST.map(t => ({ type: 'function', function: { name: t.name, description: t.description, parameters: { type: 'object', properties: {} } } }))
  const messages: any[] = [{ role: 'system', content: SYSTEM_PROMPT }, ...history.map(turn => ({ role: turn.role, content: turn.text }))]

  for (let iteration = 0; iteration < MAX_TOOL_ITERATIONS; iteration++) {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: useRuntimeConfig().aiOpenaiModel, messages, tools }),
    })
    if (!response.ok)
      providerError('ChatGPT', response.status, await response.text())

    const message = (await response.json() as any).choices?.[0]?.message
    const toolCalls: { id: string, function: { name: string } }[] = message?.tool_calls ?? []
    if (!toolCalls.length)
      return String(message?.content ?? '').trim()

    messages.push(message)
    for (const call of toolCalls)
      messages.push({ role: 'tool', tool_call_id: call.id, content: JSON.stringify(await executeTool(user, call.function.name, collected)) })
  }
  return TOO_MANY_STEPS
}

async function chatWithGemini(user: SessionUser, history: ChatTurn[], accessToken: string, collected: AssistantSection[]): Promise<string> {
  const model = useRuntimeConfig().aiGeminiModel
  const tools = [{ functionDeclarations: TOOL_LIST.map(t => ({ name: t.name, description: t.description })) }]
  const contents: any[] = history.map(turn => ({ role: turn.role === 'assistant' ? 'model' : 'user', parts: [{ text: turn.text }] }))

  for (let iteration = 0; iteration < MAX_TOOL_ITERATIONS; iteration++) {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] }, contents, tools }),
    })
    if (!response.ok)
      providerError('Gemini', response.status, await response.text())

    const content = (await response.json() as any).candidates?.[0]?.content
    const parts: any[] = content?.parts ?? []
    const calls = parts.filter(part => part.functionCall).map(part => part.functionCall as { name: string })
    if (!calls.length)
      return parts.map(part => part.text ?? '').join('').trim()

    contents.push(content)
    const responses = []
    for (const call of calls)
      responses.push({ functionResponse: { name: call.name, response: { result: await executeTool(user, call.name, collected) } } })
    contents.push({ role: 'user', parts: responses })
  }
  return TOO_MANY_STEPS
}

/**
 * Answers with the person's own connected AI (Gemini via Google sign-in, or their ChatGPT/Claude
 * API key — see server/utils/aiProviders.ts), else the company Claude key, else the built-in
 * keyword matcher. Every provider gets the same tools with the same role checks.
 */
export async function runAiAssistantChat(user: SessionUser, history: ChatTurn[]): Promise<AssistantChatResult> {
  const credentials = await resolveAiCredentials(user.id)

  // Graceful degradation: no personal AI and no company key → the original deterministic matcher.
  if (!credentials) {
    const lastUserMessage = [...history].reverse().find(turn => turn.role === 'user')?.text ?? ''
    const sections = await runAssistantQuery(user, lastUserMessage)
    return { text: buildFallbackText(sections), sections }
  }

  const collected: AssistantSection[] = []
  const text = credentials.provider === 'gemini'
    ? await chatWithGemini(user, history, credentials.accessToken, collected)
    : credentials.provider === 'openai'
      ? await chatWithOpenAi(user, history, credentials.apiKey, collected)
      : await chatWithClaude(user, history, credentials.apiKey, collected)

  return {
    text: text || 'I\'m not sure how to answer that.',
    sections: collected,
    answeredBy: credentials.source === 'company' ? `${credentials.label} (company)` : credentials.label,
  }
}
