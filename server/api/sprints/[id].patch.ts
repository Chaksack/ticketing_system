import type { SprintStatus } from '../../../app/types/sprint'
import type { SprintRow } from '../../utils/mappers'

interface UpdateSprintBody {
  name?: string
  goal?: string | null
  status?: SprintStatus
  startDate?: string | null
  endDate?: string | null
}

export default defineEventHandler(async (event) => {
  await requireBd(event)

  const id = getRouterParam(event, 'id')
  const body = await readBody<UpdateSprintBody>(event)

  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'Missing sprint id' })
  }

  await ensureDb()
  const db = useDatabase()

  const existing = await db.prepare('SELECT * FROM sprints WHERE id = ?').get(id) as SprintRow | undefined
  if (!existing) {
    throw createError({ statusCode: 404, statusMessage: 'Sprint not found' })
  }

  const name = body.name?.trim() || existing.name
  const goal = body.goal !== undefined ? body.goal : existing.goal
  const status = body.status ?? existing.status as SprintStatus
  const startDate = body.startDate !== undefined ? body.startDate : existing.start_date
  const endDate = body.endDate !== undefined ? body.endDate : existing.end_date
  const now = new Date().toISOString()

  // Starting this sprint auto-completes whichever other sprint was active —
  // only one sprint may be active at a time.
  if (status === 'active' && existing.status !== 'active') {
    await db.prepare('UPDATE sprints SET status = \'completed\', updated_at = ? WHERE status = \'active\' AND id != ?').run(now, id)
  }

  await db.prepare(`
    UPDATE sprints
    SET name = ?, goal = ?, status = ?, start_date = ?, end_date = ?, updated_at = ?
    WHERE id = ?
  `).run(name, goal, status, startDate, endDate, now, id)

  const row = await db.prepare('SELECT * FROM sprints WHERE id = ?').get(id) as SprintRow

  return { sprint: mapSprintRow(row) }
})
