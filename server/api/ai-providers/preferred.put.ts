import { isAiProvider } from '../../../app/types/ai-provider'

export default defineEventHandler(async (event) => {
  const user = await requireSessionUser(event)
  const body = await readBody<{ provider?: string | null }>(event)

  const provider = body?.provider ?? null
  if (provider !== null && !isAiProvider(provider)) {
    throw createError({ statusCode: 400, statusMessage: 'Unknown AI provider' })
  }

  await ensureDb()
  await setPreferredAiProvider(user.id, provider)
  return { settings: await getAiSettings(user.id) }
})
