import type { LeadRow } from './mappers'

export async function checkLeadReminders() {
  await ensureDb()
  const db = useDatabase()
  const now = new Date().toISOString()

  const due = await db.prepare(`
    SELECT * FROM leads
    WHERE stage NOT IN ('won', 'lost') AND next_step_at IS NOT NULL AND next_step_at <= ? AND next_step_reminder_sent = 0
  `).all(now) as LeadRow[]

  for (const lead of due) {
    const assignees = await getLeadAssignees(lead.id)

    if (assignees.length) {
      const title = `Next step due: ${lead.name}`
      const body = lead.next_step || 'This lead needs your attention.'
      const url = `/leads?open=${lead.id}`

      for (const assignee of assignees) {
        await createNotification({ staffId: assignee.id, type: 'lead_reminder', title, body, url, leadId: lead.id })
        await sendPushToStaff(assignee.id, { title, body, url })
      }
    }

    await db.prepare('UPDATE leads SET next_step_reminder_sent = 1 WHERE id = ?').run(lead.id)
  }

  return { reminded: due.length }
}
