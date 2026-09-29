import type { BdReportSummary } from '../../app/types/bd-report'
import type { StaffRow } from './mappers'
import { dealDecisionsSql } from './dealOutcomes'
import { parseStaffRoles } from './mappers'

type Extras = Pick<BdReportSummary, 'calendar' | 'interactions' | 'quotes' | 'projectFinancials' | 'reps' | 'upcoming' | 'tasks' | 'projectList' | 'wonDeals' | 'newClients'>

const DAY_MS = 24 * 60 * 60 * 1000
const UPCOMING_DAYS = 14
const MAX_EVENT_ROWS = 200
const MAX_LIST_ROWS = 200

/**
 * Task board columns are staff-defined (task_statuses), so "done" means the same thing the boards
 * use: a column with id 'done' if there is one, otherwise the last column.
 */
export async function getDoneTaskStatusId(): Promise<string> {
  const db = useDatabase()
  const rows = await db.prepare('SELECT id FROM task_statuses ORDER BY position ASC').all() as { id: string }[]
  return rows.find(r => r.id === 'done')?.id ?? rows.at(-1)?.id ?? 'done'
}

interface EventRow {
  id: string
  title: string
  activity_type: string | null
  location: string | null
  start_at: string
  end_at: string
  created_by: string | null
  regarding_type: string | null
  regarding_id: string | null
  regarding_label: string | null
}

// Label for whatever the event/deal is linked to, looked up from the right table by regarding_type.
const REGARDING_LABEL_SQL = `
  CASE calendar_events.regarding_type
    WHEN 'lead' THEN (SELECT name FROM leads WHERE leads.id = calendar_events.regarding_id)
    WHEN 'tender' THEN (SELECT title FROM tenders WHERE tenders.id = calendar_events.regarding_id)
    WHEN 'client' THEN (SELECT name FROM clients WHERE clients.id = calendar_events.regarding_id)
  END
`

function countBy<T>(items: T[], key: (item: T) => string) {
  const counts = new Map<string, number>()
  for (const item of items)
    counts.set(key(item), (counts.get(key(item)) ?? 0) + 1)
  return [...counts.entries()].map(([k, count]) => ({ key: k, count })).sort((a, b) => b.count - a.count)
}

/**
 * The parts of the BD & SM report beyond the pipeline numbers: calendar activity, logged
 * interactions, quotes, project money, a per-rep scorecard, and what's coming up next.
 * `from`/`to` are full ISO timestamps (inclusive range); "upcoming" is always the next 14 days.
 */
export async function getBdReportExtras(from: string, to: string): Promise<Extras> {
  const db = useDatabase()
  const now = new Date()
  const nowIso = now.toISOString()
  const upcomingEnd = new Date(now.getTime() + UPCOMING_DAYS * DAY_MS).toISOString()

  // BD/SM staff — the people this report is about.
  const staffRows = await db.prepare('SELECT * FROM staff WHERE status = \'active\'').all() as StaffRow[]
  const bdStaff = staffRows.filter(row => parseStaffRoles(row).some(role => role === 'bd' || role === 'sm'))
  const bdStaffIds = new Set(bdStaff.map(s => s.id))
  const staffName = new Map(staffRows.map(s => [s.id, s.name]))

  // ── Calendar ──────────────────────────────────────────────────────────────
  // Every calendar event in the range is included; the rep scorecard credits each BD/SM person
  // with the events they created or attend.
  async function loadEvents(start: string, end: string) {
    const rows = await db.prepare(`
      SELECT calendar_events.id, calendar_events.title, calendar_events.activity_type, calendar_events.location,
        calendar_events.start_at, calendar_events.end_at, calendar_events.created_by,
        calendar_events.regarding_type, calendar_events.regarding_id, ${REGARDING_LABEL_SQL} AS regarding_label
      FROM calendar_events
      WHERE calendar_events.start_at >= ? AND calendar_events.start_at <= ?
      ORDER BY calendar_events.start_at ASC
    `).all(start, end) as EventRow[]

    const attendeeRows = rows.length
      ? await db.prepare(`SELECT event_id, staff_id FROM calendar_event_attendees WHERE event_id IN (${rows.map(() => '?').join(',')})`).all(...rows.map(r => r.id)) as { event_id: string, staff_id: string }[]
      : []
    const attendeesByEvent = new Map<string, string[]>()
    for (const row of attendeeRows)
      attendeesByEvent.set(row.event_id, [...(attendeesByEvent.get(row.event_id) ?? []), row.staff_id])

    return rows.map((row) => {
      const participants = [...new Set([row.created_by, ...(attendeesByEvent.get(row.id) ?? [])].filter((id): id is string => !!id))]
      return { ...row, participants }
    })
  }

  const events = await loadEvents(from, to)
  const upcomingEvents = await loadEvents(nowIso, upcomingEnd)

  const toEventItem = (event: typeof events[number]) => ({
    id: event.id,
    title: event.title,
    activityType: event.activity_type || 'Other',
    startAt: event.start_at,
    location: event.location ?? undefined,
    regardingType: event.regarding_type ?? undefined,
    regardingLabel: event.regarding_label ?? undefined,
    staff: event.participants.map(id => staffName.get(id)).filter((n): n is string => !!n),
  })

  const eventsByStaff = new Map<string, number>()
  for (const event of events) {
    for (const id of event.participants) {
      if (bdStaffIds.has(id))
        eventsByStaff.set(id, (eventsByStaff.get(id) ?? 0) + 1)
    }
  }

  // ── Interactions (calls / emails / meetings / notes logged on leads, tenders, clients) ──
  const interactionRows = await db.prepare(`
    SELECT type, logged_by, regarding_type FROM interactions WHERE occurred_at BETWEEN ? AND ?
  `).all(from, to) as { type: string, logged_by: string | null, regarding_type: string }[]
  const interactionsByStaff = new Map<string, number>()
  for (const row of interactionRows) {
    if (row.logged_by)
      interactionsByStaff.set(row.logged_by, (interactionsByStaff.get(row.logged_by) ?? 0) + 1)
  }

  // ── Quotes & sales orders ────────────────────────────────────────────────
  const quoteRows = await db.prepare(`
    SELECT quotes.status AS status, COALESCE(SUM(quote_line_items.unit_price * quote_line_items.quantity), 0) AS total
    FROM quotes
    LEFT JOIN quote_line_items ON quote_line_items.quote_id = quotes.id
    WHERE quotes.created_at BETWEEN ? AND ?
    GROUP BY quotes.id, quotes.status
  `).all(from, to) as { status: string, total: number | string }[]
  const quotesByStatus = new Map<string, { count: number, value: number }>()
  for (const row of quoteRows) {
    const entry = quotesByStatus.get(row.status) ?? { count: 0, value: 0 }
    entry.count++
    entry.value += Number(row.total)
    quotesByStatus.set(row.status, entry)
  }
  const orderRows = await db.prepare(`
    SELECT currency, COUNT(*) AS count, COALESCE(SUM(total), 0) AS total FROM sales_orders
    WHERE created_at BETWEEN ? AND ? AND status != 'cancelled'
    GROUP BY currency
  `).all(from, to) as { currency: string, count: number | string, total: number | string }[]

  // ── Project money (per currency) ──────────────────────────────────────────
  // Payments/costs dated inside the range; "outstanding" is as of today across all projects.
  const fromDay = from.slice(0, 10)
  const toDay = to.slice(0, 10)
  const entryRows = await db.prepare(`
    SELECT projects.currency AS currency, project_financial_entries.kind AS kind, SUM(project_financial_entries.amount) AS total
    FROM project_financial_entries
    JOIN projects ON projects.id = project_financial_entries.project_id
    WHERE project_financial_entries.entry_date BETWEEN ? AND ?
    GROUP BY projects.currency, project_financial_entries.kind
  `).all(fromDay, toDay) as { currency: string, kind: string, total: number | string }[]
  const outstandingRows = await db.prepare(`
    SELECT projects.currency AS currency, COUNT(*) AS projects_with_balance,
      SUM(projects.contract_value - COALESCE(paid.total, 0)) AS outstanding,
      SUM(projects.contract_value) AS contract_value
    FROM projects
    LEFT JOIN (
      SELECT project_id, SUM(amount) AS total FROM project_financial_entries WHERE kind = 'payment' GROUP BY project_id
    ) AS paid ON paid.project_id = projects.id
    WHERE projects.contract_value IS NOT NULL AND projects.status != 'cancelled'
      AND projects.contract_value - COALESCE(paid.total, 0) > 0
    GROUP BY projects.currency
  `).all() as { currency: string, projects_with_balance: number | string, outstanding: number | string, contract_value: number | string }[]

  const currencies = new Set([...entryRows.map(r => r.currency), ...outstandingRows.map(r => r.currency)])
  const projectFinancials = [...currencies].sort().map((currency) => {
    const sum = (kind: string) => Number(entryRows.find(r => r.currency === currency && r.kind === kind)?.total ?? 0)
    const outstanding = outstandingRows.find(r => r.currency === currency)
    return {
      currency,
      paymentsReceived: sum('payment'),
      costsIncurred: sum('cost'),
      outstandingDue: Number(outstanding?.outstanding ?? 0),
      projectsWithBalance: Number(outstanding?.projects_with_balance ?? 0),
    }
  })

  // ── Per-rep scorecard ─────────────────────────────────────────────────────
  const newLeadRows = await db.prepare(`
    SELECT lead_assignees.staff_id AS staff_id, COUNT(*) AS count
    FROM leads JOIN lead_assignees ON lead_assignees.lead_id = leads.id
    WHERE leads.created_at BETWEEN ? AND ?
    GROUP BY lead_assignees.staff_id
  `).all(from, to) as { staff_id: string, count: number | string }[]
  const newTenderRows = await db.prepare(`
    SELECT tender_assignees.staff_id AS staff_id, COUNT(*) AS count
    FROM tenders JOIN tender_assignees ON tender_assignees.tender_id = tenders.id
    WHERE tenders.created_at BETWEEN ? AND ?
    GROUP BY tender_assignees.staff_id
  `).all(from, to) as { staff_id: string, count: number | string }[]
  const wonRows = await db.prepare(`
    SELECT lead_assignees.staff_id AS staff_id, decisions.outcome AS outcome, COALESCE(leads.estimated_value, 0) AS value
    FROM (${dealDecisionsSql('lead')}) AS decisions
    JOIN leads ON leads.id = decisions.deal_id
    JOIN lead_assignees ON lead_assignees.lead_id = leads.id
    WHERE decisions.decided_at BETWEEN ? AND ?
    UNION ALL
    SELECT tender_assignees.staff_id AS staff_id, decisions.outcome AS outcome, COALESCE(tenders.estimated_value, 0) AS value
    FROM (${dealDecisionsSql('tender')}) AS decisions
    JOIN tenders ON tenders.id = decisions.deal_id
    JOIN tender_assignees ON tender_assignees.tender_id = tenders.id
    WHERE decisions.decided_at BETWEEN ? AND ?
  `).all(from, to, from, to) as { staff_id: string, outcome: string, value: number | string }[]
  const doneStatusId = await getDoneTaskStatusId()
  const tasksDoneRows = await db.prepare(`
    SELECT task_assignees.staff_id AS staff_id, COUNT(*) AS count
    FROM tasks JOIN task_assignees ON task_assignees.task_id = tasks.id
    WHERE tasks.status = ? AND tasks.type != 'epic' AND tasks.updated_at BETWEEN ? AND ?
    GROUP BY task_assignees.staff_id
  `).all(doneStatusId, from, to) as { staff_id: string, count: number | string }[]

  const countFor = (rows: { staff_id: string, count: number | string }[], id: string) => Number(rows.find(r => r.staff_id === id)?.count ?? 0)

  const reps = bdStaff
    .map((staff) => {
      const decided = wonRows.filter(r => r.staff_id === staff.id)
      const won = decided.filter(r => r.outcome === 'Won')
      return {
        staffId: staff.id,
        staffName: staff.name,
        newLeads: countFor(newLeadRows, staff.id),
        newTenders: countFor(newTenderRows, staff.id),
        dealsWon: won.length,
        dealsLost: decided.length - won.length,
        wonValue: Math.round(won.reduce((total, r) => total + Number(r.value), 0)),
        calendarActivities: eventsByStaff.get(staff.id) ?? 0,
        interactionsLogged: interactionsByStaff.get(staff.id) ?? 0,
        tasksCompleted: countFor(tasksDoneRows, staff.id),
      }
    })
    .sort((a, b) => b.wonValue - a.wonValue || b.calendarActivities - a.calendarActivities || a.staffName.localeCompare(b.staffName))

  // ── Coming up ─────────────────────────────────────────────────────────────
  const tenderDeadlineRows = await db.prepare(`
    SELECT id, title, stage, submission_deadline, estimated_value
    FROM tenders
    WHERE submission_deadline IS NOT NULL AND submission_deadline >= ? AND submission_deadline <= ?
      AND stage NOT IN ('won', 'lost', 'submitted', 'evaluation')
    ORDER BY submission_deadline ASC
  `).all(nowIso.slice(0, 10), upcomingEnd) as { id: string, title: string, stage: string, submission_deadline: string, estimated_value: number | string | null }[]

  // ── Tasks ─────────────────────────────────────────────────────────────────
  // Epics are containers, not work items, so they're left out of every task count.
  const today = nowIso.slice(0, 10)
  const statusRows = await db.prepare('SELECT id, label FROM task_statuses ORDER BY position ASC').all() as { id: string, label: string }[]
  const statusLabel = new Map(statusRows.map(r => [r.id, r.label]))
  const createdTasksRow = await db.prepare(`SELECT COUNT(*) AS count FROM tasks WHERE type != 'epic' AND created_at BETWEEN ? AND ?`).get(from, to) as { count: number | string }
  const completedTasksRow = await db.prepare(`SELECT COUNT(*) AS count FROM tasks WHERE type != 'epic' AND status = ? AND updated_at BETWEEN ? AND ?`).get(doneStatusId, from, to) as { count: number | string }
  const openByStatusRows = await db.prepare(`SELECT status, COUNT(*) AS count FROM tasks WHERE type != 'epic' AND status != ? GROUP BY status`).all(doneStatusId) as { status: string, count: number | string }[]
  const openByPriorityRows = await db.prepare(`SELECT priority, COUNT(*) AS count FROM tasks WHERE type != 'epic' AND status != ? GROUP BY priority`).all(doneStatusId) as { priority: string, count: number | string }[]
  const overdueTaskRows = await db.prepare(`
    SELECT tasks.id, tasks.title, tasks.status, tasks.priority, tasks.due_date, projects.name AS project_name
    FROM tasks
    LEFT JOIN projects ON projects.id = tasks.project_id
    WHERE tasks.type != 'epic' AND tasks.status != ? AND tasks.due_date IS NOT NULL AND tasks.due_date < ?
    ORDER BY tasks.due_date ASC
  `).all(doneStatusId, today) as { id: string, title: string, status: string, priority: string, due_date: string, project_name: string | null }[]
  const overdueAssigneeRows = overdueTaskRows.length
    ? await db.prepare(`SELECT task_id, staff_id FROM task_assignees WHERE task_id IN (${overdueTaskRows.map(() => '?').join(',')})`).all(...overdueTaskRows.map(r => r.id)) as { task_id: string, staff_id: string }[]
    : []

  // ── Projects list (every project that isn't finished, plus any created in the range) ──
  const projectRows = await db.prepare(`
    SELECT projects.id, projects.name, projects.status, projects.start_date, projects.end_date, projects.created_at,
      projects.currency, projects.contract_value, clients.name AS client_name,
      (SELECT COALESCE(SUM(amount), 0) FROM project_financial_entries WHERE project_id = projects.id AND kind = 'cost') AS cost_total,
      (SELECT COALESCE(SUM(amount), 0) FROM project_financial_entries WHERE project_id = projects.id AND kind = 'payment') AS paid_total,
      (SELECT COUNT(*) FROM tasks WHERE tasks.project_id = projects.id AND tasks.type != 'epic') AS task_count,
      (SELECT COUNT(*) FROM tasks WHERE tasks.project_id = projects.id AND tasks.type != 'epic' AND tasks.status = ?) AS done_task_count
    FROM projects
    LEFT JOIN clients ON clients.id = projects.client_id
    WHERE projects.status IN ('planned', 'active', 'on_hold') OR projects.created_at BETWEEN ? AND ?
    ORDER BY projects.created_at DESC
  `).all(doneStatusId, from, to) as {
    id: string
    name: string
    status: string
    start_date: string | null
    end_date: string | null
    created_at: string
    currency: string | null
    contract_value: number | string | null
    client_name: string | null
    cost_total: number | string
    paid_total: number | string
    task_count: number | string
    done_task_count: number | string
  }[]

  // ── Deals won + new clients in the range ─────────────────────────────────
  const wonDealRows = await db.prepare(`
    SELECT 'lead' AS kind, leads.id AS id, leads.name AS name, leads.estimated_value AS value, decisions.decided_at AS decided_at
    FROM (${dealDecisionsSql('lead')}) AS decisions JOIN leads ON leads.id = decisions.deal_id
    WHERE decisions.outcome = 'Won' AND decisions.decided_at BETWEEN ? AND ?
    UNION ALL
    SELECT 'tender' AS kind, tenders.id AS id, tenders.title AS name, tenders.estimated_value AS value, decisions.decided_at AS decided_at
    FROM (${dealDecisionsSql('tender')}) AS decisions JOIN tenders ON tenders.id = decisions.deal_id
    WHERE decisions.outcome = 'Won' AND decisions.decided_at BETWEEN ? AND ?
    ORDER BY decided_at DESC
  `).all(from, to, from, to) as { kind: 'lead' | 'tender', id: string, name: string, value: number | string | null, decided_at: string }[]
  const leadAssigneeRows = await db.prepare('SELECT lead_id AS deal_id, staff_id FROM lead_assignees').all() as { deal_id: string, staff_id: string }[]
  const tenderAssigneeRows = await db.prepare('SELECT tender_id AS deal_id, staff_id FROM tender_assignees').all() as { deal_id: string, staff_id: string }[]
  const namesFor = (rows: { deal_id: string, staff_id: string }[], id: string) =>
    rows.filter(r => r.deal_id === id).map(r => staffName.get(r.staff_id)).filter((n): n is string => !!n)

  const newClientRows = await db.prepare(`
    SELECT id, name, stage, created_at FROM clients WHERE created_at BETWEEN ? AND ? ORDER BY created_at DESC
  `).all(from, to) as { id: string, name: string, stage: string, created_at: string }[]

  return {
    calendar: {
      totalCount: events.length,
      completedCount: events.filter(e => e.end_at < nowIso).length,
      scheduledCount: events.filter(e => e.end_at >= nowIso).length,
      linkedCount: events.filter(e => e.regarding_type).length,
      byType: countBy(events, e => e.activity_type || 'Other').map(r => ({ type: r.key, count: r.count })),
      byRegarding: countBy(events, e => e.regarding_type ?? 'unlinked').map(r => ({ regardingType: r.key, count: r.count })),
      events: events.slice(0, MAX_EVENT_ROWS).map(toEventItem),
      truncated: events.length > MAX_EVENT_ROWS,
    },
    interactions: {
      totalCount: interactionRows.length,
      byType: countBy(interactionRows, r => r.type).map(r => ({ type: r.key, count: r.count })),
    },
    quotes: {
      createdCount: quoteRows.length,
      byStatus: [...quotesByStatus.entries()].map(([status, v]) => ({ status, count: v.count, value: Math.round(v.value) })),
      ordersByCurrency: orderRows.map(r => ({ currency: r.currency, count: Number(r.count), total: Number(r.total) })),
    },
    projectFinancials,
    reps,
    upcoming: {
      events: upcomingEvents.map(toEventItem),
      tenderDeadlines: tenderDeadlineRows.map(r => ({
        id: r.id,
        title: r.title,
        stage: r.stage,
        submissionDeadline: r.submission_deadline,
        estimatedValue: r.estimated_value === null ? undefined : Number(r.estimated_value),
      })),
    },
    tasks: {
      createdCount: Number(createdTasksRow.count),
      completedCount: Number(completedTasksRow.count),
      overdueCount: overdueTaskRows.length,
      openByStatus: openByStatusRows
        .map(r => ({ status: r.status, label: statusLabel.get(r.status) ?? r.status, count: Number(r.count) }))
        .sort((a, b) => b.count - a.count),
      openByPriority: openByPriorityRows.map(r => ({ priority: r.priority, count: Number(r.count) })),
      overdue: overdueTaskRows.slice(0, MAX_LIST_ROWS).map(r => ({
        id: r.id,
        title: r.title,
        status: statusLabel.get(r.status) ?? r.status,
        priority: r.priority,
        dueDate: r.due_date,
        projectName: r.project_name ?? undefined,
        assignees: overdueAssigneeRows.filter(a => a.task_id === r.id).map(a => staffName.get(a.staff_id)).filter((n): n is string => !!n),
      })),
    },
    projectList: projectRows.slice(0, MAX_LIST_ROWS).map((r) => {
      const contractValue = r.contract_value === null ? undefined : Number(r.contract_value)
      const cost = Number(r.cost_total)
      const paid = Number(r.paid_total)
      return {
        id: r.id,
        name: r.name,
        clientName: r.client_name ?? undefined,
        status: r.status,
        startDate: r.start_date ?? undefined,
        endDate: r.end_date ?? undefined,
        createdInRange: r.created_at >= from && r.created_at <= to,
        currency: r.currency ?? 'GHS',
        contractValue,
        totalCost: cost,
        amountPaid: paid,
        margin: contractValue === undefined ? undefined : contractValue - cost,
        amountDue: contractValue === undefined ? undefined : contractValue - paid,
        taskCount: Number(r.task_count),
        doneTaskCount: Number(r.done_task_count),
      }
    }),
    wonDeals: wonDealRows.slice(0, MAX_LIST_ROWS).map(r => ({
      kind: r.kind,
      id: r.id,
      name: r.name,
      value: r.value === null ? undefined : Number(r.value),
      decidedAt: r.decided_at,
      reps: namesFor(r.kind === 'lead' ? leadAssigneeRows : tenderAssigneeRows, r.id),
    })),
    newClients: newClientRows.slice(0, MAX_LIST_ROWS).map(r => ({ id: r.id, name: r.name, stage: r.stage, createdAt: r.created_at })),
  }
}
