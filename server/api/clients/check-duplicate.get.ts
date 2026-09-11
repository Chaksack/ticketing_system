export default defineEventHandler(async (event) => {
  await requireBd(event)
  await ensureDb()

  const query = getQuery(event)
  const matches = await findDuplicates('clients', {
    name: typeof query.name === 'string' ? query.name : undefined,
    email: typeof query.email === 'string' ? query.email : undefined,
    phone: typeof query.phone === 'string' ? query.phone : undefined,
  })

  return { matches }
})
