import { isAiProvider } from '../../../../app/types/ai-provider'

export default defineEventHandler(async (event) => {
  const user = await requireSessionUser(event)

  const provider = getRouterParam(event, 'provider')
  if (!isAiProvider(provider)) {
    throw createError({ statusCode: 404, statusMessage: 'Unknown AI provider' })
  }

  await ensureDb()
  await removeAiProvider(user.id, provider)
  return { settings: await getAiSettings(user.id) }
})
