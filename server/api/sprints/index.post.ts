import type { SprintStatus } from '../../../app/types/sprint'
import type { SprintRow } from '../../utils/mappers'

interface NewSprintBody {
  name?: string
  goal?: string
  status?: SprintStatus
  startDate?: string
  endDate?: string
}

export default defineEventHandler(async (event) => {
  const user = await requireBd(event)

  const body = await readBody<NewSprintBody>(event)

  if (!body?.name?.trim()) {
    throw createError({ statusCode: 400, statusMessage: 'name is required' })
  }

  await ensureDb()
  const db = useDatabase()

  const id = await nextSprintId()
  const now = new Date().toISOString()
  const status = body.status ?? 'planned'

  // Starting a new sprint as active auto-completes whichever sprint was active before it —
  // only one sprint may be active at a time.
  if (status === 'active') {
    await db.prepare('UPDATE sprints SET status = \'completed\', updated_at = ? WHERE status = \'active\'').run(now)
  }

  await db.prepare(`
    INSERT INTO sprints (id, name, goal, status, start_date, end_date, created_by, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    body.name.trim(),
    body.goal ?? null,
    status,
    body.startDate ?? null,
    body.endDate ?? null,
    user.id,
    now,
    now,
  )

  const row = await db.prepare('SELECT * FROM sprints WHERE id = ?').get(id) as SprintRow

  setResponseStatus(event, 201)
  return { sprint: mapSprintRow(row) }
})
