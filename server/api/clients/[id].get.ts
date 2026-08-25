export default defineEventHandler(async (event) => {
  await requireBd(event)

  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'Missing client id' })
  }

  await ensureDb()

  const client = await loadFullClient(id)

  return { client }
})
