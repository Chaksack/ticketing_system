import type { TagRow, TicketRow } from '../../utils/mappers'

export default defineEventHandler(async (event) => {
  await requireSessionUser(event)
  await ensureDb()

  const db = useTenantDb()
  // ?clientId= / ?projectId= narrow the list (client and project records show their tickets).
  const query = getQuery(event)
  const where: string[] = []
  const params: string[] = []
  if (typeof query.clientId === 'string' && query.clientId) {
    where.push('tickets.client_id = ?')
    params.push(query.clientId)
  }
  if (typeof query.projectId === 'string' && query.projectId) {
    where.push('tickets.project_id = ?')
    params.push(query.projectId)
  }
  const rows = await db.prepare(`${TICKET_LIST_SELECT}${where.length ? ` WHERE ${where.join(' AND ')}` : ''} ORDER BY tickets.created_at DESC`).all(...params) as TicketRow[]

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
