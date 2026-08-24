import type { SlaPolicyRow } from '../../utils/sla'

export default defineEventHandler(async (event) => {
  await requireSessionUser(event)
  await ensureDb()

  const db = useDatabase()
  const rows = await db.prepare('SELECT * FROM sla_policies ORDER BY resolution_mins ASC').all() as SlaPolicyRow[]

  return { policies: rows.map(row => mapSlaPolicyRow(row)) }
})
