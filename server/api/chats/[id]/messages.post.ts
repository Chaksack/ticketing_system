export default defineEventHandler(async (event) => {
  const user = await requireServiceStaff(event)
  const id = getRouterParam(event, 'id') ?? ''
  // `note: true` adds an internal note: staff see it in the inbox, the customer never does.
  const body = await readBody<{ message?: string, note?: boolean }>(event)
  const message = body?.message?.trim().slice(0, 4000)
  if (!message)
    throw createError({ statusCode: 400, statusMessage: 'Message is empty' })

  await ensureDb()
  if (body?.note) {
    if (!(await loadChatDetail(id)))
      throw createError({ statusCode: 404, statusMessage: 'Chat not found' })
    await addChatMessage(id, { authorType: 'note', authorId: user.id, authorName: user.name, body: message })
  }
  else {
    await addAgentChatMessage(id, user, message)
  }
  return { chat: await loadChatDetail(id) }
})
