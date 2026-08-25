export default defineEventHandler(async (event) => {
  await requireSessionUser(event)

  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'Missing ticket id' })
  }

  await ensureDb()

  const ticket = await loadFullTicket(id)

  return { ticket }
})
