interface TicketResult { id: string, subject: string, requester: string }
interface ClientResult { id: string, name: string, contactName: string | null }
interface StaffResult { id: string, name: string, email: string }
interface AmcPlanResult { id: string, name: string }
interface LeadResult { id: string, name: string, contactName: string | null }
interface TaskResult { id: string, title: string, type: string }
interface ProjectResult { id: string, name: string, clientName: string | null }

const MAX_RESULTS = 6

export default defineEventHandler(async (event) => {
  const user = await requireSessionUser(event)

  const query = getQuery(event)
  const q = typeof query.q === 'string' ? query.q.trim() : ''

  const empty = { tickets: [], clients: [], staff: [], amcPlans: [], leads: [], tasks: [], projects: [] }
  if (q.length < 2) {
    return empty
  }

  await ensureDb()
  const db = useDatabase()
  const like = `%${q}%`

  const canSeeTickets = user.roles.some(role => role === 'agent' || role === 'admin' || role === 'engineer' || role === 'engineering_coordinator' || role === 'engineering_lead')
  const canSeeBd = user.roles.some(role => role === 'bd' || role === 'sm' || role === 'admin')

  // Sequential, not Promise.all — db0's postgresql connector shares a single client
  // and warns (and can wedge) on overlapping concurrent queries.
  const tickets = canSeeTickets
    ? await db.prepare(`
        SELECT id, subject, requester FROM tickets
        WHERE id ILIKE ? OR subject ILIKE ? OR requester ILIKE ? OR requester_email ILIKE ?
        ORDER BY created_at DESC LIMIT ?
      `).all(like, like, like, like, MAX_RESULTS) as TicketResult[]
    : []

  const clients = canSeeBd
    ? await db.prepare(`
        SELECT id, name, contact_name AS "contactName" FROM clients
        WHERE name ILIKE ? OR contact_name ILIKE ? OR contact_email ILIKE ?
        ORDER BY created_at DESC LIMIT ?
      `).all(like, like, like, MAX_RESULTS) as ClientResult[]
    : []

  const staff = await db.prepare(`
    SELECT id, name, email FROM staff
    WHERE name ILIKE ? OR email ILIKE ?
    ORDER BY created_at DESC LIMIT ?
  `).all(like, like, MAX_RESULTS) as StaffResult[]

  const amcPlans = canSeeBd
    ? await db.prepare(`
        SELECT id, name FROM amc_plans WHERE name ILIKE ? ORDER BY name ASC LIMIT ?
      `).all(like, MAX_RESULTS) as AmcPlanResult[]
    : []

  const leads = canSeeBd
    ? await db.prepare(`
        SELECT id, name, contact_name AS "contactName" FROM leads
        WHERE name ILIKE ? OR contact_name ILIKE ? OR contact_email ILIKE ?
        ORDER BY created_at DESC LIMIT ?
      `).all(like, like, like, MAX_RESULTS) as LeadResult[]
    : []

  const tasks = canSeeBd
    ? await db.prepare(`
        SELECT id, title, type FROM tasks
        WHERE title ILIKE ? OR id ILIKE ?
        ORDER BY created_at DESC LIMIT ?
      `).all(like, like, MAX_RESULTS) as TaskResult[]
    : []

  const projects = canSeeBd
    ? await db.prepare(`
        SELECT projects.id, projects.name, clients.name AS "clientName"
        FROM projects
        LEFT JOIN clients ON clients.id = projects.client_id
        WHERE projects.name ILIKE ? OR clients.name ILIKE ?
        ORDER BY projects.created_at DESC LIMIT ?
      `).all(like, like, MAX_RESULTS) as ProjectResult[]
    : []

  return { tickets, clients, staff, amcPlans, leads, tasks, projects }
})
