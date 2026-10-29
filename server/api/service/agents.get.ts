import type { SupportAgent } from '../../../app/types/supportDesk'

interface AgentRow { id: string, name: string, email: string, role: string, roles: string | null, status: string, on_call: number, last_active_at: string | null, presence_override: string }

/** The people on the support desk with their presence, rota and current load. */
export default defineEventHandler(async (event): Promise<{ agents: SupportAgent[] }> => {
  await requireServiceStaff(event)
  await ensureDb()
  const db = useTenantDb()
  const staff = (await db.prepare('SELECT id, name, email, role, roles, status, on_call, last_active_at, presence_override FROM staff WHERE status <> \'disabled\' ORDER BY name').all() as AgentRow[])
    .filter(row => parseStaffRoles(row).some(role => ['admin', 'agent', 'engineer', 'engineering_coordinator', 'engineering_lead'].includes(role)))
  const shifts = await listSupportShifts()
  const count = async (sql: string) => new Map((await db.prepare(sql).all() as { id: string, count: string | number }[]).map(r => [r.id, Number(r.count)]))
  const weekAgo = new Date(Date.now() - 7 * 86_400_000).toISOString()
  const openTickets = await count('SELECT assignee_id AS id, COUNT(*) AS count FROM tickets WHERE status IN (\'open\', \'in-progress\') AND assignee_id IS NOT NULL GROUP BY assignee_id')
  const activeChats = await count('SELECT assignee_id AS id, COUNT(*) AS count FROM live_chats WHERE status = \'active\' AND assignee_id IS NOT NULL GROUP BY assignee_id')
  const resolved = new Map((await db.prepare('SELECT assignee_id AS id, COUNT(*) AS count FROM tickets WHERE resolved_at >= ? AND assignee_id IS NOT NULL GROUP BY assignee_id').all(weekAgo).catch(() => []) as { id: string, count: string | number }[]).map(r => [r.id, Number(r.count)]))
  const ratings = new Map((await db.prepare('SELECT tickets.assignee_id AS id, AVG(ticket_surveys.rating) AS rating FROM ticket_surveys JOIN tickets ON tickets.id = ticket_surveys.ticket_id WHERE ticket_surveys.rating IS NOT NULL GROUP BY tickets.assignee_id').all() as { id: string, rating: string | number }[]).map(r => [r.id, Number(r.rating)]))
  const timeZone = await workspaceTimeZone()
  const { weekday } = supportClock(timeZone)

  return {
    agents: staff.map(row => ({
      id: row.id,
      name: row.name,
      email: row.email,
      roles: parseStaffRoles(row),
      status: row.status,
      presence: derivePresenceState(row),
      onCall: !!Number(row.on_call),
      onShift: isOnShift(shifts, row.id, timeZone),
      shiftToday: shifts.filter(s => s.staffId === row.id && s.weekday === weekday).map(s => `${s.startTime}–${s.endTime}`).join(', ') || undefined,
      openTickets: openTickets.get(row.id) ?? 0,
      activeChats: activeChats.get(row.id) ?? 0,
      resolvedThisWeek: resolved.get(row.id) ?? 0,
      rating: ratings.get(row.id),
    })),
  }
})
