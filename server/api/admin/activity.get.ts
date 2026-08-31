export interface ActivityLogEntry {
  id: string
  source: 'ticket' | 'client' | 'lead' | 'page'
  entityId: string
  entityLabel: string
  type: string
  actorId?: string
  actorName?: string
  fromValue?: string
  toValue?: string
  message?: string
  createdAt: string
}

interface RawPageRow {
  id: string
  ticket_id: string
  ticket_subject: string
  staff_id: string
  staff_name: string
  acknowledged: number
  created_at: string
}

function mapPageRow(row: RawPageRow): ActivityLogEntry {
  return {
    id: row.id,
    source: 'page',
    entityId: row.ticket_id,
    entityLabel: row.ticket_subject,
    type: 'paged',
    actorId: row.staff_id,
    actorName: row.staff_name,
    toValue: row.acknowledged ? 'Acknowledged' : 'Pending',
    createdAt: row.created_at,
  }
}

interface RawActivityRow {
  id: string
  entity_id: string
  entity_label: string | null
  type: string
  actor_id: string | null
  actor_name: string | null
  from_value: string | null
  to_value: string | null
  message: string | null
  created_at: string
}

function mapRow(row: RawActivityRow, source: ActivityLogEntry['source']): ActivityLogEntry {
  return {
    id: row.id,
    source,
    entityId: row.entity_id,
    entityLabel: row.entity_label ?? row.entity_id,
    type: row.type,
    actorId: row.actor_id ?? undefined,
    actorName: row.actor_name ?? undefined,
    fromValue: row.from_value ?? undefined,
    toValue: row.to_value ?? undefined,
    message: row.message ?? undefined,
    createdAt: row.created_at,
  }
}

export default defineEventHandler(async (event) => {
  await requireAdmin(event)

  const query = getQuery(event)
  const staffId = typeof query.staffId === 'string' && query.staffId ? query.staffId : undefined

  await ensureDb()
  const db = useDatabase()

  const ticketRows = await db.prepare(`
    SELECT ticket_activity.id, ticket_activity.ticket_id AS entity_id, tickets.subject AS entity_label,
           ticket_activity.type, ticket_activity.actor_id, ticket_activity.actor_name,
           ticket_activity.from_value, ticket_activity.to_value, ticket_activity.message, ticket_activity.created_at
    FROM ticket_activity
    LEFT JOIN tickets ON tickets.id = ticket_activity.ticket_id
    ${staffId ? 'WHERE ticket_activity.actor_id = ?' : ''}
    ORDER BY ticket_activity.created_at DESC
    LIMIT 300
  `).all(...(staffId ? [staffId] : [])) as RawActivityRow[]

  const clientRows = await db.prepare(`
    SELECT client_activity.id, client_activity.client_id AS entity_id, clients.name AS entity_label,
           client_activity.type, client_activity.actor_id, client_activity.actor_name,
           client_activity.from_value, client_activity.to_value, client_activity.message, client_activity.created_at
    FROM client_activity
    LEFT JOIN clients ON clients.id = client_activity.client_id
    ${staffId ? 'WHERE client_activity.actor_id = ?' : ''}
    ORDER BY client_activity.created_at DESC
    LIMIT 300
  `).all(...(staffId ? [staffId] : [])) as RawActivityRow[]

  const leadRows = await db.prepare(`
    SELECT lead_activity.id, lead_activity.lead_id AS entity_id, leads.name AS entity_label,
           lead_activity.type, lead_activity.actor_id, lead_activity.actor_name,
           lead_activity.from_value, lead_activity.to_value, lead_activity.message, lead_activity.created_at
    FROM lead_activity
    LEFT JOIN leads ON leads.id = lead_activity.lead_id
    ${staffId ? 'WHERE lead_activity.actor_id = ?' : ''}
    ORDER BY lead_activity.created_at DESC
    LIMIT 300
  `).all(...(staffId ? [staffId] : [])) as RawActivityRow[]

  // "actor" here means the staff member who was paged, not who triggered the page (pages are
  // always system-initiated) — filtering by staff surfaces pages relevant to that person.
  const pageRows = await db.prepare(`
    SELECT id, ticket_id, ticket_subject, staff_id, staff_name, acknowledged, created_at
    FROM pages
    ${staffId ? 'WHERE staff_id = ?' : ''}
    ORDER BY created_at DESC
    LIMIT 300
  `).all(...(staffId ? [staffId] : [])) as RawPageRow[]

  const activity = [
    ...ticketRows.map(row => mapRow(row, 'ticket')),
    ...clientRows.map(row => mapRow(row, 'client')),
    ...leadRows.map(row => mapRow(row, 'lead')),
    ...pageRows.map(mapPageRow),
  ].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 300)

  return { activity }
})
