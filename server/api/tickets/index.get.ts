import type { TagRow, TicketRow } from '../../utils/mappers'

export default defineEventHandler(async (event) => {
  await requireSessionUser(event)
  await ensureDb()

  const db = useDatabase()
  const rows = await db.prepare(`
    SELECT tickets.*, staff.name AS assignee_name
    FROM tickets
    LEFT JOIN staff ON staff.id = tickets.assignee_id
    ORDER BY tickets.created_at DESC
  `).all() as TicketRow[]

  const tagRows = await db.prepare(`
    SELECT ticket_tags.ticket_id AS ticket_id, tags.*
    FROM ticket_tags
    INNER JOIN tags ON tags.id = ticket_tags.tag_id
  `).all() as (TagRow & { ticket_id: string })[]

  const tagsByTicket = new Map<string, TagRow[]>()
  for (const row of tagRows) {
    const list = tagsByTicket.get(row.ticket_id) ?? []
    list.push(row)
    tagsByTicket.set(row.ticket_id, list)
  }

  const tickets = rows.map(row => mapTicketRow(row, [], [], (tagsByTicket.get(row.id) ?? []).map(tagRow => mapTagRow(tagRow))))

  return { tickets }
})
