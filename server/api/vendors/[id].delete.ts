export default defineEventHandler(async (event) => {
  await requireFinance(event)

  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'Missing vendor id' })
  }

  await ensureDb()
  const db = useDatabase()

  const inUse = await db.prepare('SELECT 1 FROM vendor_bills WHERE vendor_id = ? LIMIT 1').get(id)
  if (inUse) {
    throw createError({ statusCode: 409, statusMessage: 'Cannot delete a vendor with recorded bills' })
  }

  await db.prepare('DELETE FROM vendors WHERE id = ?').run(id)

  return { success: true }
})
