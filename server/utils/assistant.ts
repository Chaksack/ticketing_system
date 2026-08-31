import type { AmcContractDisplayStatus, AmcContractStatus } from '../../app/types/amc'
import type { AssistantSection } from '../../app/types/assistant'
import type { SessionUser } from './auth'
import { getContractDisplayStatus } from '../../app/lib/amc'
import { parseStaffRoles } from './mappers'

const DAY_MS = 24 * 60 * 60 * 1000

const TICKET_STATUS_LABELS: Record<string, string> = {
  'open': 'Open',
  'in-progress': 'In progress',
  'resolved': 'Resolved',
  'closed': 'Closed',
}

const CLIENT_STAGE_LABELS: Record<string, string> = {
  lead: 'Lead',
  contacted: 'Contacted',
  proposal: 'Proposal',
  negotiation: 'Negotiation',
  active: 'Active',
  lost: 'Lost',
}

const ROLE_LABELS: Record<string, string> = {
  admin: 'Admin',
  agent: 'Agent',
  bd: 'BD Executive',
  sm: 'Sales & Marketing Exec',
  engineer: 'Engineer',
  engineering_coordinator: 'Engineering Coordinator',
  engineering_lead: 'Engineering Lead',
}

function normalize(text: string) {
  return text.toLowerCase().replace(/[^\w\s]/g, ' ').replace(/\s+/g, ' ').trim()
}

function hasAny(text: string, words: string[]) {
  return words.some(word => text.includes(word))
}

function canSeeTickets(user: SessionUser) {
  return user.roles.some(role => role === 'agent' || role === 'admin' || role === 'engineer' || role === 'engineering_coordinator' || role === 'engineering_lead')
}

function canSeeClients(user: SessionUser) {
  return user.roles.some(role => role === 'bd' || role === 'sm' || role === 'admin')
}

function isAdminUser(user: SessionUser) {
  return user.roles.includes('admin')
}

async function ticketStatusBreakdown(): Promise<AssistantSection[]> {
  const db = useDatabase()
  const rows = await db.prepare('SELECT status, COUNT(*) AS count FROM tickets GROUP BY status').all() as { status: string, count: number }[]

  if (!rows.length)
    return [{ heading: 'Tickets by status', stats: [{ label: 'Total', value: 0 }] }]

  return [{
    heading: 'Tickets by status',
    stats: rows.map(row => ({ label: TICKET_STATUS_LABELS[row.status] ?? row.status, value: Number(row.count) })),
  }]
}

async function ticketPriorityBreakdown(): Promise<AssistantSection[]> {
  const db = useDatabase()
  const rows = await db.prepare('SELECT priority, COUNT(*) AS count FROM tickets GROUP BY priority').all() as { priority: string, count: number }[]

  if (!rows.length)
    return [{ heading: 'Tickets by priority', stats: [{ label: 'Total', value: 0 }] }]

  return [{
    heading: 'Tickets by priority',
    stats: rows.map(row => ({ label: row.priority.charAt(0).toUpperCase() + row.priority.slice(1), value: Number(row.count) })),
  }]
}

async function slaBreachSummary(): Promise<AssistantSection[]> {
  const db = useDatabase()
  const nowIso = new Date().toISOString()

  const openOverdue = await db.prepare(`
    SELECT COUNT(*) AS count FROM tickets
    WHERE status NOT IN ('resolved', 'closed') AND due_at IS NOT NULL AND due_at < ?
  `).get(nowIso) as { count: number }

  const resolvedLate = await db.prepare(`
    SELECT COUNT(*) AS count FROM tickets
    WHERE status IN ('resolved', 'closed') AND due_at IS NOT NULL AND resolved_at IS NOT NULL AND resolved_at > due_at
  `).get() as { count: number }

  return [{
    heading: 'SLA breaches',
    stats: [
      { label: 'Currently overdue', value: Number(openOverdue.count) },
      { label: 'Resolved late', value: Number(resolvedLate.count) },
    ],
  }]
}

async function myTickets(user: SessionUser): Promise<AssistantSection[]> {
  const db = useDatabase()
  const rows = await db.prepare('SELECT status, COUNT(*) AS count FROM tickets WHERE assignee_id = ? GROUP BY status').all(user.id) as { status: string, count: number }[]

  if (!rows.length)
    return [{ heading: 'Your tickets', stats: [{ label: 'Assigned to you', value: 0 }] }]

  return [{
    heading: 'Your tickets',
    stats: rows.map(row => ({ label: TICKET_STATUS_LABELS[row.status] ?? row.status, value: Number(row.count) })),
  }]
}

async function ticketVolume(): Promise<AssistantSection[]> {
  const db = useDatabase()
  const now = new Date()
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString()
  const weekStart = new Date(now.getTime() - 7 * DAY_MS).toISOString()

  const today = await db.prepare('SELECT COUNT(*) AS count FROM tickets WHERE created_at >= ?').get(todayStart) as { count: number }
  const week = await db.prepare('SELECT COUNT(*) AS count FROM tickets WHERE created_at >= ?').get(weekStart) as { count: number }

  return [{
    heading: 'Ticket volume',
    stats: [
      { label: 'Created today', value: Number(today.count) },
      { label: 'Created last 7 days', value: Number(week.count) },
    ],
  }]
}

async function clientsByStage(): Promise<AssistantSection[]> {
  const db = useDatabase()
  const rows = await db.prepare('SELECT stage, COUNT(*) AS count FROM clients GROUP BY stage').all() as { stage: string, count: number }[]

  if (!rows.length)
    return [{ heading: 'Clients by stage', stats: [{ label: 'Total', value: 0 }] }]

  return [{
    heading: 'Clients by stage',
    stats: rows.map(row => ({ label: CLIENT_STAGE_LABELS[row.stage] ?? row.stage, value: Number(row.count) })),
  }]
}

async function myClients(user: SessionUser): Promise<AssistantSection[]> {
  const db = useDatabase()
  const rows = await db.prepare('SELECT stage, COUNT(*) AS count FROM clients WHERE assigned_to = ? GROUP BY stage').all(user.id) as { stage: string, count: number }[]

  if (!rows.length)
    return [{ heading: 'Your clients', stats: [{ label: 'Assigned to you', value: 0 }] }]

  return [{
    heading: 'Your clients',
    stats: rows.map(row => ({ label: CLIENT_STAGE_LABELS[row.stage] ?? row.stage, value: Number(row.count) })),
  }]
}

async function contractsExpiringSoon(): Promise<AssistantSection[]> {
  const db = useDatabase()
  const now = new Date()
  const in30Days = new Date(now.getTime() + 30 * DAY_MS).toISOString()
  const nowIso = now.toISOString()

  const rows = await db.prepare(`
    SELECT clients.name AS client_name, amc_plans.name AS plan_name, c.end_date
    FROM client_amc_contracts c
    INNER JOIN clients ON clients.id = c.client_id
    LEFT JOIN amc_plans ON amc_plans.id = c.plan_id
    WHERE c.status = 'active' AND c.end_date <= ? AND c.end_date > ?
    ORDER BY c.end_date ASC
    LIMIT 10
  `).all(in30Days, nowIso) as { client_name: string, plan_name: string | null, end_date: string }[]

  if (!rows.length)
    return [{ heading: 'Contracts expiring in the next 30 days', stats: [{ label: 'Expiring soon', value: 0 }] }]

  return [{
    heading: 'Contracts expiring in the next 30 days',
    table: {
      headers: ['Client', 'Plan', 'Expires'],
      rows: rows.map(row => [row.client_name, row.plan_name ?? '—', row.end_date.slice(0, 10)]),
    },
  }]
}

async function contractCounts(): Promise<AssistantSection[]> {
  const db = useDatabase()
  const rows = await db.prepare('SELECT status, end_date FROM client_amc_contracts').all() as { status: string, end_date: string }[]

  const tally: Record<AmcContractDisplayStatus, number> = { submitted: 0, negotiating: 0, active: 0, expiring: 0, lost: 0, expired: 0, cancelled: 0 }
  for (const row of rows) {
    const display = getContractDisplayStatus({ status: row.status as AmcContractStatus, endDate: row.end_date })
    tally[display] += 1
  }

  return [{
    heading: 'AMC contracts',
    stats: [
      { label: 'Submitted', value: tally.submitted },
      { label: 'Negotiating', value: tally.negotiating },
      { label: 'Active', value: tally.active },
      { label: 'Expiring soon', value: tally.expiring },
      { label: 'Lost', value: tally.lost },
      { label: 'Expired', value: tally.expired },
      { label: 'Cancelled', value: tally.cancelled },
    ],
  }]
}

async function onCallStaff(): Promise<AssistantSection[]> {
  const db = useDatabase()
  const rows = await db.prepare('SELECT name FROM staff WHERE on_call = 1 AND status = \'active\'').all() as { name: string }[]

  if (!rows.length)
    return [{ heading: 'On-call staff', stats: [{ label: 'On call now', value: 'Nobody is marked on-call' }] }]

  return [{
    heading: 'On-call staff',
    stats: rows.map(row => ({ label: row.name, value: 'On call' })),
  }]
}

async function staffHeadcount(): Promise<AssistantSection[]> {
  const db = useDatabase()
  const rows = await db.prepare('SELECT role, roles FROM staff').all() as { role: string, roles: string | null }[]

  const tally: Record<string, number> = { admin: 0, agent: 0, bd: 0, sm: 0, engineer: 0, engineering_coordinator: 0, engineering_lead: 0 }
  for (const row of rows) {
    for (const role of parseStaffRoles(row))
      tally[role] = (tally[role] ?? 0) + 1
  }

  return [{
    heading: 'Staff headcount by role',
    stats: Object.entries(tally).map(([role, count]) => ({ label: ROLE_LABELS[role] ?? role, value: count })),
  }]
}

async function overview(user: SessionUser): Promise<AssistantSection[]> {
  const sections: AssistantSection[] = []

  if (canSeeTickets(user))
    sections.push(...await ticketStatusBreakdown())

  if (canSeeClients(user)) {
    sections.push(...await clientsByStage())
    sections.push(...await contractsExpiringSoon())
  }

  if (isAdminUser(user))
    sections.push(...await staffHeadcount())

  if (!sections.length)
    sections.push({ heading: 'Overview', stats: [{ label: 'No report access', value: 'Ask an admin for access to reports.' }] })

  return sections
}

function deniedSections(): AssistantSection[] {
  return [{ stats: [{ label: 'Access', value: 'You don\'t have access to that data.' }] }]
}

function helpSections(user: SessionUser): AssistantSection[] {
  const examples: string[] = []

  if (canSeeTickets(user))
    examples.push('How many open tickets?', 'Any SLA breaches?', 'What are my tickets?')

  if (canSeeClients(user))
    examples.push('Clients by stage', 'Contracts expiring soon', 'My clients')

  if (isAdminUser(user))
    examples.push('Staff headcount')

  examples.push('Give me a report')

  return [{
    heading: 'Try asking one of these',
    table: { headers: ['Example question'], rows: examples.map(example => [example]) },
  }]
}

interface Intent {
  test: (text: string) => boolean
  allowed: (user: SessionUser) => boolean
  run: (user: SessionUser) => Promise<AssistantSection[]>
}

const intents: Intent[] = [
  {
    test: text => hasAny(text, ['overdue', 'breach', 'sla']),
    allowed: canSeeTickets,
    run: slaBreachSummary,
  },
  {
    test: text => text.includes('my ticket') || text.includes('assigned to me'),
    allowed: canSeeTickets,
    run: myTickets,
  },
  {
    test: text => text.includes('priority') && text.includes('ticket'),
    allowed: canSeeTickets,
    run: ticketPriorityBreakdown,
  },
  {
    test: text => text.includes('ticket') && (text.includes('today') || text.includes('this week') || text.includes('last 7 days') || text.includes('volume')),
    allowed: canSeeTickets,
    run: ticketVolume,
  },
  {
    test: text => text.includes('on call') || text.includes('oncall') || text.includes('on-call'),
    allowed: canSeeTickets,
    run: onCallStaff,
  },
  {
    test: text => text.includes('ticket') && (text.includes('status') || text.includes('how many') || text.includes('open')),
    allowed: canSeeTickets,
    run: ticketStatusBreakdown,
  },
  {
    test: text => text.includes('my client'),
    allowed: canSeeClients,
    run: myClients,
  },
  {
    test: text => text.includes('contract') && (text.includes('active') || text.includes('expired') || text.includes('how many') || text.includes('count')),
    allowed: canSeeClients,
    run: contractCounts,
  },
  {
    test: text => hasAny(text, ['expir', 'renewal']) || text.includes('contract'),
    allowed: canSeeClients,
    run: contractsExpiringSoon,
  },
  {
    test: text => text.includes('client') && (text.includes('stage') || text.includes('pipeline') || text.includes('how many')),
    allowed: canSeeClients,
    run: clientsByStage,
  },
  {
    test: text => text.includes('pipeline'),
    allowed: canSeeClients,
    run: clientsByStage,
  },
  {
    test: text => text.includes('staff') || text.includes('headcount'),
    allowed: isAdminUser,
    run: staffHeadcount,
  },
  {
    test: text => text === '' || hasAny(text, ['report', 'summary', 'overview', 'hi', 'hello', 'help']),
    allowed: () => true,
    run: overview,
  },
]

export async function runAssistantQuery(user: SessionUser, message: string): Promise<AssistantSection[]> {
  const text = normalize(message)

  for (const intent of intents) {
    if (intent.test(text))
      return intent.allowed(user) ? intent.run(user) : deniedSections()
  }

  return helpSections(user)
}
