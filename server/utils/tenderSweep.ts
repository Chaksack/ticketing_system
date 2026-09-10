import type { TenderRow } from './mappers'

export async function checkTenderReminders() {
  await ensureDb()
  const db = useDatabase()
  const now = new Date().toISOString()

  const due = await db.prepare(`
    SELECT * FROM tenders
    WHERE stage NOT IN ('won', 'lost') AND submission_deadline IS NOT NULL AND submission_deadline <= ? AND deadline_reminder_sent = 0
  `).all(now) as TenderRow[]

  for (const tender of due) {
    const assignees = await getTenderAssignees(tender.id)

    if (assignees.length) {
      const title = `Tender deadline due: ${tender.title}`
      const body = `The submission deadline for ${tender.title} is due.`
      const url = `/tenders?open=${tender.id}`

      for (const assignee of assignees) {
        await createNotification({ staffId: assignee.id, type: 'tender_reminder', title, body, url })
        await sendPushToStaff(assignee.id, { title, body, url })
      }
    }

    await db.prepare('UPDATE tenders SET deadline_reminder_sent = 1 WHERE id = ?').run(tender.id)
  }

  return { reminded: due.length }
}
