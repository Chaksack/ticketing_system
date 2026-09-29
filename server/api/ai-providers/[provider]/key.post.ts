// Saves the person's own OpenAI/Anthropic API key (checked with the provider first, then encrypted).
// Gemini doesn't take a key here — it connects with Google sign-in (../gemini/connect.get.ts).
export default defineEventHandler(async (event) => {
  const user = await requireSessionUser(event)

  const provider = getRouterParam(event, 'provider')
  if (provider !== 'openai' && provider !== 'anthropic') {
    throw createError({ statusCode: 400, statusMessage: 'API keys can only be added for OpenAI or Anthropic' })
  }

  const body = await readBody<{ apiKey?: string }>(event)
  if (!body?.apiKey?.trim()) {
    throw createError({ statusCode: 400, statusMessage: 'apiKey is required' })
  }

  await ensureDb()
  await saveAiApiKey(user.id, provider, body.apiKey)
  return { settings: await getAiSettings(user.id) }
})
