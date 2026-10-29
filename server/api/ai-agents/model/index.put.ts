import type { AiModelProvider } from '../../../../app/types/aiAgent'

/** The workspace's AI connection for agents. The API key is write-only (leave it blank to keep the saved one). */
export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  await ensureDb()
  const body = await readBody<{ provider?: AiModelProvider, model?: string, baseUrl?: string, apiKey?: string }>(event) ?? {}
  const provider = (['company', 'anthropic', 'openai'] as const).find(p => p === body.provider)
  if (!provider)
    throw createError({ statusCode: 400, statusMessage: 'Pick a provider' })
  if (body.baseUrl?.trim() && !/^https?:\/\/\S+$/.test(body.baseUrl.trim()))
    throw createError({ statusCode: 400, statusMessage: 'The base URL should start with https://' })
  await saveAiModelSettings({ provider, model: body.model?.slice(0, 120), baseUrl: body.baseUrl?.slice(0, 300), apiKey: body.apiKey?.slice(0, 500) })
  return { model: await getAiModelSettings() }
})
