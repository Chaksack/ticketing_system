import type { BdQuotaRow } from '../../utils/quotas'

interface UpsertQuotaBody {
  staffId?: string
  period?: string
  targetValue?: number
}

export default defineEventHandler(async (event) => {
  await requireAdmin(event)

  const body = await readBody<UpsertQuotaBody>(event)

  if (!body?.staffId || !body?.period || body.targetValue === undefined || body.targetValue < 0) {
    throw createError({ statusCode: 400, statusMessage: 'staffId, period and a non-negative targetValue are required' })
  }

  await ensureDb()
  const db = useDatabase()

  const staff = await db.prepare('SELECT id FROM staff WHERE id = ?').get(body.staffId)
  if (!staff) {
    throw createError({ statusCode: 404, statusMessage: 'Staff member not found' })
  }

  const now = new Date().toISOString()

  const existing = await db.prepare('SELECT id FROM bd_quotas WHERE staff_id = ? AND period = ?').get(body.staffId, body.period) as { id: string } | undefined
  const id = existing?.id ?? await nextBdQuotaId()

  await db.prepare(`
    INSERT INTO bd_quotas (id, staff_id, period, target_value, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT (staff_id, period) DO UPDATE SET target_value = EXCLUDED.target_value, updated_at = EXCLUDED.updated_at
  `).run(id, body.staffId, body.period, body.targetValue, now, now)

  const row = await db.prepare(`
    SELECT bd_quotas.*, staff.name AS staff_name
    FROM bd_quotas
    JOIN staff ON staff.id = bd_quotas.staff_id
    WHERE bd_quotas.staff_id = ? AND bd_quotas.period = ?
  `).get(body.staffId, body.period) as BdQuotaRow

  setResponseStatus(event, 201)
  return { quota: mapBdQuotaRow(row) }
})
