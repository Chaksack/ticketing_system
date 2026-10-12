import { CARE_SHRINKAGE } from '../../../app/types/care'

/**
 * Workforce planning for one day: agents needed per hour (from the last four weeks' contact
 * volume across Care clients, same weekday) against agents scheduled, plus each client's
 * service level today and who's on the floor right now.
 */
export default defineEventHandler(async (event) => {
  await requirePlatformStaff(event)
  await ensureCareTables()
  const date = String(getQuery(event).date ?? new Date().toISOString().slice(0, 10))
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date))
    throw createError({ statusCode: 400, statusMessage: 'date must be YYYY-MM-DD' })
  const weekday = new Date(`${date}T12:00:00Z`).getUTCDay()
  const engagements = await runningEngagements()

  const contactsByHour = Array.from({ length: 24 }, () => 0)
  let ahtWeighted = 0
  let totalContacts = 0
  const clients: { orgId: string, orgName: string, model: string, waiting: number, answered: number, withinTarget: number, targetSeconds: number }[] = []
  const since = new Date(Date.now() - 28 * 86400000).toISOString()
  const dayStart = `${date}T00:00:00.000Z`
  const dayEnd = `${date}T23:59:59.999Z`

  for (const engagement of engagements) {
    await runWithTenant(engagement.orgId, async () => {
      await ensureDb()
      const db = useTenantDb()
      const rows = await db.prepare(`
        SELECT started_at AS at FROM live_chats WHERE started_at >= ?
        UNION ALL SELECT created_at AS at FROM tickets WHERE created_at >= ?
      `).all(since, since) as { at: string }[]
      for (const row of rows) {
        const at = new Date(row.at)
        if (at.getUTCDay() === weekday) {
          contactsByHour[at.getUTCHours()]! += 1 / 4 // four weeks → average per week
          totalContacts++
        }
      }
      ahtWeighted += engagement.ahtMinutes * rows.length
      const today = await db.prepare('SELECT started_at, first_response_at, status FROM live_chats WHERE started_at BETWEEN ? AND ?').all(dayStart, dayEnd) as { started_at: string, first_response_at: string | null, status: string }[]
      const answered = today.filter(c => c.first_response_at)
      clients.push({
        orgId: engagement.orgId,
        orgName: engagement.orgName ?? engagement.orgId,
        model: engagement.model,
        waiting: (await db.prepare('SELECT COUNT(*) AS count FROM live_chats WHERE status = \'waiting\'').get() as { count: string | number }).count as number,
        answered: answered.length,
        withinTarget: answered.filter(c => (new Date(c.first_response_at!).getTime() - new Date(c.started_at).getTime()) / 1000 <= engagement.replyTargetSeconds).length,
        targetSeconds: engagement.replyTargetSeconds,
      })
    })
  }

  const aht = totalContacts ? ahtWeighted / Math.max(1, totalContacts) : 6
  // Erlang-free approximation: workload hours per hour, grossed up for shrinkage.
  const needed = contactsByHour.map(contacts => Math.ceil((contacts * aht) / 60 / (1 - CARE_SHRINKAGE)))
  const shifts = (await useControlDb().prepare('SELECT * FROM cp_care_shifts WHERE date = ? ORDER BY start_hour').all(date) as Record<string, any>[]).map(mapShiftRow)
  const scheduled = Array.from({ length: 24 }, (_, hour) => shifts.filter(s => s.startHour <= hour && hour < s.endHour).length)

  const agentIds = [...new Set(engagements.flatMap(e => e.agentIds))]
  const staff = agentIds.length
    ? await useTenantDb().prepare(`SELECT id, name, last_active_at, presence_override FROM staff WHERE id IN (${agentIds.map(() => '?').join(', ')})`).all(...agentIds) as { id: string, name: string, last_active_at: string | null, presence_override: string }[]
    : []

  return {
    date,
    hours: Array.from({ length: 24 }, (_, hour) => ({ hour, needed: needed[hour]!, scheduled: scheduled[hour]!, contacts: Math.round(contactsByHour[hour]! * 10) / 10 })),
    shifts,
    clients: clients.map(c => ({ ...c, waiting: Number(c.waiting), serviceLevel: c.answered ? Math.round((c.withinTarget / c.answered) * 100) : null })),
    floor: {
      agents: staff.length,
      online: staff.filter(s => derivePresenceState(s) === 'online').length,
      away: staff.filter(s => derivePresenceState(s) === 'away' || derivePresenceState(s) === 'in_meeting').length,
    },
    agents: staff.map(s => ({ id: s.id, name: s.name })),
  }
})
