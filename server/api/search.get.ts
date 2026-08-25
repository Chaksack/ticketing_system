interface TicketResult { id: string, subject: string, requester: string }
interface ClientResult { id: string, name: string, contactName: string | null }
interface StaffResult { id: string, name: string, email: string }
interface AmcPlanResult { id: string, name: string }

const MAX_RESULTS = 6

export default defineEventHandler(async (event) => {
  const user = await requireSessionUser(event)

  const query = getQuery(event)
  const q = typeof query.q === 'string' ? query.q.trim() : ''

  if (q.length < 2) {
    return { tickets: [], clients: [], staff: [], amcPlans: [] }
  }

  await ensureDb()
  const db = useDatabase()
  const like = `%${q}%`

  const canSeeTickets = user.roles.some(role => role === 'agent' || role === 'admin')
  const canSeeClients = user.roles.some(role => role === 'bd' || role === 'sm' || role === 'admin')

  const [tickets, clients, staff, amcPlans] = await Promise.all([
    canSeeTickets
      ? db.prepare(`
          SELECT id, subject, requester FROM tickets
          WHERE id ILIKE ? OR subject ILIKE ? OR requester ILIKE ? OR requester_email ILIKE ?
          ORDER BY created_at DESC LIMIT ?
        `).all(like, like, like, like, MAX_RESULTS) as Promise<TicketResult[]>
      : Promise.resolve([]),
    canSeeClients
      ? db.prepare(`
          SELECT id, name, contact_name AS "contactName" FROM clients
          WHERE name ILIKE ? OR contact_name ILIKE ? OR contact_email ILIKE ?
          ORDER BY created_at DESC LIMIT ?
        `).all(like, like, like, MAX_RESULTS) as Promise<ClientResult[]>
      : Promise.resolve([]),
    db.prepare(`
      SELECT id, name, email FROM staff
      WHERE name ILIKE ? OR email ILIKE ?
      ORDER BY created_at DESC LIMIT ?
    `).all(like, like, MAX_RESULTS) as Promise<StaffResult[]>,
    canSeeClients
      ? db.prepare(`
          SELECT id, name FROM amc_plans WHERE name ILIKE ? ORDER BY name ASC LIMIT ?
        `).all(like, MAX_RESULTS) as Promise<AmcPlanResult[]>
      : Promise.resolve([]),
  ])

  return { tickets, clients, staff, amcPlans }
})
