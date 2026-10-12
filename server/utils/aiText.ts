import type { SessionUser } from './auth'
import Anthropic from '@anthropic-ai/sdk'

/**
 * One-shot text generation with the person's own connected AI (or the company Claude key) — the
 * same credentials as Ask AI. Returns null when nobody has connected an AI, so callers can fall
 * back to a non-AI result instead of failing.
 */
export async function generateAiText(user: SessionUser, system: string, prompt: string, maxTokens = 900): Promise<string | null> {
  const credentials = await resolveAiCredentials(user.id)
  if (!credentials)
    return null

  const config = useRuntimeConfig()
  try {
    if (credentials.provider === 'anthropic') {
      const client = new Anthropic({ apiKey: credentials.apiKey })
      const response = await client.messages.create({ model: config.aiAnthropicModel, max_tokens: maxTokens, system, messages: [{ role: 'user', content: prompt }] })
      return response.content.filter(block => block.type === 'text').map(block => block.text).join('\n').trim() || null
    }
    if (credentials.provider === 'openai') {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${credentials.apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: config.aiOpenaiModel, max_tokens: maxTokens, messages: [{ role: 'system', content: system }, { role: 'user', content: prompt }] }),
      })
      if (!response.ok)
        throw Object.assign(new Error(`ChatGPT ${response.status}`), { status: response.status })
      return String((await response.json() as any).choices?.[0]?.message?.content ?? '').trim() || null
    }
    if (credentials.provider !== 'gemini')
      return null
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(config.aiGeminiModel)}:generateContent`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${credentials.accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ systemInstruction: { parts: [{ text: system }] }, contents: [{ role: 'user', parts: [{ text: prompt }] }] }),
    })
    if (!response.ok)
      throw Object.assign(new Error(`Gemini ${response.status}`), { status: response.status })
    const parts: any[] = (await response.json() as any).candidates?.[0]?.content?.parts ?? []
    return parts.map(part => part.text ?? '').join('').trim() || null
  }
  catch (error: any) {
    console.error(`[ai-text] ${credentials.label} failed`, error)
    const status = Number(error?.status ?? String(error?.message ?? '').match(/\b(401|403|429)\b/)?.[1])
    if (status === 401 || status === 403) {
      const where = credentials.source === 'company' ? 'the company AI key (NUXT_ANTHROPIC_API_KEY)' : 'your AI connection in Settings → Integrations'
      throw createError({ statusCode: 400, statusMessage: `${credentials.label} rejected the credentials. Check ${where}.` })
    }
    if (status === 429)
      throw createError({ statusCode: 429, statusMessage: `${credentials.label} says you've hit its usage limit. Try again later.` })
    throw createError({ statusCode: 502, statusMessage: `${credentials.label} couldn't write that just now. Please try again.` })
  }
}
