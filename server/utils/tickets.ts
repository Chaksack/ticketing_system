import type { Ticket, TicketActivityType } from '../../app/types/ticket'
import type { ActivityRow, ReplyRow, TagRow, TicketRow } from './mappers'

/** Tickets with their assignee, client, project and the AMC plan whose SLA applies. */
export const TICKET_LIST_SELECT = `
  SELECT tickets.*, staff.name AS assignee_name, clients.name AS client_name, projects.name AS project_name, amc_plans.name AS plan_name
  FROM tickets
  LEFT JOIN staff ON staff.id = tickets.assignee_id
  LEFT JOIN clients ON clients.id = tickets.client_id
  LEFT JOIN projects ON projects.id = tickets.project_id
  LEFT JOIN client_amc_contracts ON client_amc_contracts.id = tickets.contract_id
  LEFT JOIN amc_plans ON amc_plans.id = client_amc_contracts.plan_id
`

const TICKET_SELECT = `${TICKET_LIST_SELECT} WHERE tickets.id = ?`

export async function loadFullTicket(id: string): Promise<Ticket> {
  const db = useTenantDb()

  const row = await db.prepare(TICKET_SELECT).get(id) as TicketRow | undefined
  if (!row) {
    throw createError({ statusCode: 404, statusMessage: 'Ticket not found' })
  }

  const replyRows = await db.prepare('SELECT * FROM ticket_replies WHERE ticket_id = ? ORDER BY created_at ASC').all(id) as ReplyRow[]
  const activityRows = await db.prepare('SELECT * FROM ticket_activity WHERE ticket_id = ? ORDER BY created_at ASC').all(id) as ActivityRow[]
  const tagRows = await db.prepare(`
    SELECT tags.* FROM tags
    INNER JOIN ticket_tags ON ticket_tags.tag_id = tags.id
    WHERE ticket_tags.ticket_id = ?
    ORDER BY tags.name ASC
  `).all(id) as TagRow[]

  return mapTicketRow(
    row,
    replyRows.map(replyRow => mapReplyRow(replyRow)),
    activityRows.map(activityRow => mapActivityRow(activityRow)),
    tagRows.map(tagRow => mapTagRow(tagRow)),
  )
}

export async function logTicketActivity(options: {
  ticketId: string
  type: TicketActivityType
  actorId?: string
  actorName?: string
  fromValue?: string
  toValue?: string
  message?: string
}) {
  const db = useTenantDb()
  const id = await nextActivityId()
  const now = new Date().toISOString()

  await db.prepare(`
    INSERT INTO ticket_activity (id, ticket_id, type, actor_id, actor_name, from_value, to_value, message, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, options.ticketId, options.type, options.actorId ?? null, options.actorName ?? null, options.fromValue ?? null, options.toValue ?? null, options.message ?? null, now)
}

export async function touchTicket(ticketId: string) {
  const db = useTenantDb()
  await db.prepare('UPDATE tickets SET updated_at = ? WHERE id = ?').run(new Date().toISOString(), ticketId)
}
