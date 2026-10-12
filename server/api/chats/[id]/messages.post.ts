export default defineEventHandler(async (event) => {
  const user = await requireServiceStaff(event)
  const id = getRouterParam(event, 'id') ?? ''
  const body = await readBody<{ message?: string }>(event)
  const message = body?.message?.trim().slice(0, 4000)
  if (!message)
    throw createError({ statusCode: 400, statusMessage: 'Message is empty' })

  await ensureDb()
  await addAgentChatMessage(id, user, message)
  return { chat: await loadChatDetail(id) }
})
