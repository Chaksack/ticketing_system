import type { SupportCustomerDetail } from '../../../../app/types/supportDesk'
import type { LiveChatRow } from '../../../utils/liveChat'

/** One customer: their details, tickets, chats and satisfaction ratings. */
export default defineEventHandler(async (event): Promise<{ customer: SupportCustomerDetail }> => {
  await requireServiceStaff(event)
  await ensureDb()
  const email = decodeURIComponent(getRouterParam(event, 'email') ?? '').trim().toLowerCase()
  const summary = (await listSupportCustomers(email)).find(c => c.email === email)
  if (!summary)
    throw createError({ statusCode: 404, statusMessage: 'No tickets or chats from this email' })

  const db = useTenantDb()
  const profile = await db.prepare('SELECT notes, updated_by FROM customer_profiles WHERE email = ?').get(email) as { notes: string | null, updated_by: string | null } | undefined
  const tickets = await db.prepare('SELECT id, subject, status, priority, created_at, updated_at FROM tickets WHERE LOWER(requester_email) = ? ORDER BY created_at DESC LIMIT 100').all(email) as { id: string, subject: string, status: string, priority: string, created_at: string, updated_at: string | null }[]
  const chats = await db.prepare(`${CHAT_SELECT} WHERE LOWER(live_chats.visitor_email) = ? ORDER BY live_chats.started_at DESC LIMIT 100`).all(email) as LiveChatRow[]
  const surveys = await db.prepare('SELECT ticket_id, rating, comment, responded_at FROM ticket_surveys WHERE LOWER(email) = ? AND rating IS NOT NULL ORDER BY responded_at DESC').all(email) as { ticket_id: string, rating: number | string, comment: string | null, responded_at: string }[]

  return {
    customer: {
      ...summary,
      notes: profile?.notes ?? undefined,
      updatedBy: profile?.updated_by ?? undefined,
      tickets: tickets.map(t => ({ id: t.id, subject: t.subject, status: t.status, priority: t.priority, createdAt: t.created_at, updatedAt: t.updated_at ?? t.created_at })),
      chats: chats.map(mapChatRow).map(c => ({ id: c.id, subject: c.subject, status: c.status, startedAt: c.startedAt, aiAgentName: c.aiAgentName, assigneeName: c.assigneeName, ticketId: c.ticketId })),
      surveys: surveys.map(s => ({ ticketId: s.ticket_id, rating: Number(s.rating), comment: s.comment ?? undefined, respondedAt: s.responded_at })),
    },
  }
})
