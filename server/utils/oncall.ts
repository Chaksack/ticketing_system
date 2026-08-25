import type { Ticket } from '../../app/types/ticket'
import type { StaffRow } from './mappers'

export async function pageOnCallForTicket(ticket: Ticket) {
  await ensureDb()
  const db = useDatabase()

  const onCallStaff = await db.prepare(
    'SELECT * FROM staff WHERE on_call = 1 AND status = \'active\'',
  ).all() as StaffRow[]

  for (const member of onCallStaff) {
    const pageId = await nextPageId()
    const now = new Date().toISOString()

    await db.prepare(`
      INSERT INTO pages (id, ticket_id, ticket_subject, staff_id, staff_name, created_at, acknowledged)
      VALUES (?, ?, ?, ?, ?, ?, 0)
    `).run(pageId, ticket.id, ticket.subject, member.id, member.name, now)

    await sendPushToStaff(member.id, {
      title: `Paging ${member.name}`,
      body: `[${ticket.priority.toUpperCase()}] ${ticket.id}: ${ticket.subject}`,
      url: '/tickets',
      type: 'page',
      tag: pageId,
    })
  }

  return onCallStaff.length
}
