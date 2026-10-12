export default defineEventHandler(async (event) => {
  await requireDispatcher(event)
  const id = getRouterParam(event, 'id') ?? ''
  await ensureDb()
  const db = useTenantDb()
  const used = await db.prepare('SELECT COUNT(*) AS count FROM work_orders WHERE asset_id = ?').get(id) as { count: string | number }
  if (Number(used.count) > 0)
    throw createError({ statusCode: 409, statusMessage: 'This asset has work-order history, so it can\'t be deleted' })
  await db.prepare('DELETE FROM field_assets WHERE id = ?').run(id)
  return { ok: true }
})
