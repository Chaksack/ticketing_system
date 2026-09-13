export default defineEventHandler(async (event) => {
  const user = await requireFinance(event)

  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'Missing approval id' })
  }

  const body = await readBody<{ notes?: string }>(event)

  await ensureDb()
  const approval = await decideApproval(id, 'rejected', user.id, body?.notes)

  return { approval }
})
