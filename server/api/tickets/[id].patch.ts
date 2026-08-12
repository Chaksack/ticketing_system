import type { TicketPriority, TicketStatus } from '../../../app/types/ticket'
import type { TicketRow } from '../../utils/mappers'

interface UpdateTicketBody {
  status?: TicketStatus
  priority?: TicketPriority
  category?: string
}

export default defineEventHandler(async (event) => {
  await requireSessionUser(event)

  const id = getRouterParam(event, 'id')
  const body = await readBody<UpdateTicketBody>(event)

  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'Missing ticket id' })
  }

  await ensureDb()
  const db = useDatabase()

  const existing = await db.prepare('SELECT * FROM tickets WHERE id = ?').get(id) as TicketRow | undefined
  if (!existing) {
    throw createError({ statusCode: 404, statusMessage: 'Ticket not found' })
  }

  const status = body.status ?? existing.status
  const priority = body.priority ?? existing.priority
  const category = body.category ?? existing.category

  await db.prepare('UPDATE tickets SET status = ?, priority = ?, category = ? WHERE id = ?').run(status, priority, category, id)

  const row = await db.prepare('SELECT * FROM tickets WHERE id = ?').get(id) as TicketRow
  return { ticket: mapTicketRow(row) }
})
