export default defineEventHandler(async (event) => {
  await requireBd(event)

  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'Missing tender id' })
  }

  await ensureDb()

  const tender = await loadFullTender(id)

  return { tender }
})
