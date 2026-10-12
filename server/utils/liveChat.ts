import type { LiveChatDetail, LiveChatMessage, LiveChatSummary } from '../../app/types/liveChat'
import { randomBytes } from 'node:crypto'

export interface LiveChatRow {
  id: string
  token: string
  visitor_name: string
  visitor_email: string
  client_id: string | null
  client_name?: string | null
  status: LiveChatSummary['status']
  assignee_id: string | null
  assignee_name: string | null
  ticket_id: string | null
  subject: string | null
  last_message?: string | null
  started_at: string
  first_response_at: string | null
  last_message_at: string
  closed_at: string | null
  care_handled: number | string
}

interface MessageRow {
  id: string
  author_type: LiveChatMessage['authorType']
  author_name: string
  body: string
  created_at: string
}

export const CHAT_SELECT = `
  SELECT live_chats.*, clients.name AS client_name,
    (SELECT body FROM live_chat_messages m WHERE m.chat_id = live_chats.id ORDER BY m.created_at DESC LIMIT 1) AS last_message
  FROM live_chats
  LEFT JOIN clients ON clients.id = live_chats.client_id
`

export function mapChatRow(row: LiveChatRow): LiveChatSummary {
  return {
    id: row.id,
    visitorName: row.visitor_name,
    visitorEmail: row.visitor_email,
    clientId: row.client_id ?? undefined,
    clientName: row.client_name ?? undefined,
    status: row.status,
    assigneeId: row.assignee_id ?? undefined,
    assigneeName: row.assignee_name ?? undefined,
    ticketId: row.ticket_id ?? undefined,
    subject: row.subject ?? undefined,
    lastMessage: row.last_message ?? undefined,
    lastMessageAt: row.last_message_at,
    startedAt: row.started_at,
    firstResponseAt: row.first_response_at ?? undefined,
    closedAt: row.closed_at ?? undefined,
    careHandled: Number(row.care_handled) === 1,
  }
}

export function mapMessageRow(row: MessageRow): LiveChatMessage {
  return { id: row.id, authorType: row.author_type, authorName: row.author_name, body: row.body, createdAt: row.created_at }
}

export function newChatToken() {
  return randomBytes(24).toString('hex')
}

export async function loadChatMessages(chatId: string, after?: string) {
  const db = useTenantDb()
  const rows = after
    ? await db.prepare('SELECT * FROM live_chat_messages WHERE chat_id = ? AND created_at > ? ORDER BY created_at').all(chatId, after) as MessageRow[]
    : await db.prepare('SELECT * FROM live_chat_messages WHERE chat_id = ? ORDER BY created_at').all(chatId) as MessageRow[]
  return rows.map(mapMessageRow)
}

/** Match the visitor's email to a client: the client's main contact email, extra emails, or a named contact. */
export async function identifyVisitor(email: string) {
  const db = useTenantDb()
  const normalized = email.trim().toLowerCase()
  const direct = await db.prepare('SELECT id, name, stage, contact_name FROM clients WHERE LOWER(contact_email) = ? LIMIT 1').get(normalized) as { id: string, name: string, stage: string, contact_name: string | null } | undefined
  if (direct)
    return { clientId: direct.id, clientName: direct.name, contactName: direct.contact_name ?? undefined, stage: direct.stage }
  const contact = await db.prepare(`
    SELECT clients.id, clients.name, clients.stage, client_contacts.name AS contact_name, client_contacts.title AS contact_title
    FROM client_contacts JOIN clients ON clients.id = client_contacts.client_id
    WHERE LOWER(client_contacts.email) = ? LIMIT 1
  `).get(normalized) as { id: string, name: string, stage: string, contact_name: string, contact_title: string | null } | undefined
  if (contact)
    return { clientId: contact.id, clientName: contact.name, contactName: contact.contact_name, contactTitle: contact.contact_title ?? undefined, stage: contact.stage }
  const extra = await db.prepare(`
    SELECT clients.id, clients.name, clients.stage FROM client_contact_emails JOIN clients ON clients.id = client_contact_emails.client_id
    WHERE LOWER(client_contact_emails.email) = ? LIMIT 1
  `).get(normalized) as { id: string, name: string, stage: string } | undefined
  return extra ? { clientId: extra.id, clientName: extra.name, stage: extra.stage } : undefined
}

export async function loadChatDetail(id: string): Promise<LiveChatDetail | null> {
  const row = await useTenantDb().prepare(`${CHAT_SELECT} WHERE live_chats.id = ?`).get(id) as LiveChatRow | undefined
  if (!row)
    return null
  return { ...mapChatRow(row), messages: await loadChatMessages(id), identified: await identifyVisitor(row.visitor_email) }
}

export async function addChatMessage(chatId: string, message: { authorType: LiveChatMessage['authorType'], authorId?: string, authorName: string, body: string }) {
  const db = useTenantDb()
  const id = await nextPrefixedId('live_chat_message', 'CM', 6)
  const now = new Date().toISOString()
  await db.prepare('INSERT INTO live_chat_messages (id, chat_id, author_type, author_id, author_name, body, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .run(id, chatId, message.authorType, message.authorId ?? null, message.authorName, message.body, now)
  await db.prepare('UPDATE live_chats SET last_message_at = ? WHERE id = ?').run(now, chatId)
  return now
}

/** An agent's reply: claims an unassigned chat for them and records the first response time. */
export async function addAgentChatMessage(chatId: string, agent: { id: string, name: string }, body: string, options: { care?: boolean } = {}) {
  const db = useTenantDb()
  const chat = await db.prepare('SELECT status, assignee_id, first_response_at FROM live_chats WHERE id = ?').get(chatId) as { status: string, assignee_id: string | null, first_response_at: string | null } | undefined
  if (!chat)
    throw createError({ statusCode: 404, statusMessage: 'Chat not found' })
  if (chat.status === 'closed')
    throw createError({ statusCode: 409, statusMessage: 'This chat has ended' })

  const at = await addChatMessage(chatId, { authorType: 'agent', authorId: agent.id, authorName: agent.name, body })
  await db.prepare(`
    UPDATE live_chats SET status = 'active',
      assignee_id = COALESCE(assignee_id, ?), assignee_name = COALESCE(assignee_name, ?),
      first_response_at = COALESCE(first_response_at, ?), care_handled = CASE WHEN ? = 1 THEN 1 ELSE care_handled END
    WHERE id = ?
  `).run(agent.id, agent.name, at, options.care ? 1 : 0, chatId)
}

/** Turns the transcript into a ticket (so it gets an SLA, follow-ups and email replies) and links them. */
export async function createTicketFromChat(chatId: string, actor: { id: string, name: string }, options: { category?: string, priority?: 'low' | 'medium' | 'high' | 'urgent' } = {}) {
  const db = useTenantDb()
  const chat = await loadChatDetail(chatId)
  if (!chat)
    throw createError({ statusCode: 404, statusMessage: 'Chat not found' })
  if (chat.ticketId)
    return chat.ticketId

  const transcript = chat.messages.map(m => `[${new Date(m.createdAt).toISOString().slice(11, 16)}] ${m.authorName}: ${m.body}`).join('\n')
  const id = await nextTicketId()
  const now = new Date().toISOString()
  const priority = options.priority ?? 'medium'
  const { dueAt, firstResponseDueAt } = await computeSlaDeadlines(priority, now)

  await db.prepare(`
    INSERT INTO tickets (id, subject, description, requester, requester_email, category, status, priority, created_at, updated_at, assignee_id, due_at, first_response_due_at, first_response_at)
    VALUES (?, ?, ?, ?, ?, ?, 'open', ?, ?, ?, ?, ?, ?, ?)
  `).run(id, (chat.subject ?? `Live chat with ${chat.visitorName}`).slice(0, 200), `From live chat ${chat.id}:\n\n${transcript}`, chat.visitorName, chat.visitorEmail, options.category ?? 'Live chat', priority, now, now, chat.assigneeId ?? actor.id, dueAt ?? null, firstResponseDueAt ?? null, chat.firstResponseAt ?? null)
  await logTicketActivity({ ticketId: id, type: 'created_from_chat', actorId: actor.id, actorName: actor.name, message: `${actor.name} created this ticket from live chat ${chat.id}` })
  await db.prepare('UPDATE live_chats SET ticket_id = ? WHERE id = ?').run(id, chatId)
  await addChatMessage(chatId, { authorType: 'system', authorName: 'System', body: `We've opened case ${id} for this. You'll get updates by email.` })
  return id
}

export async function liveChatQueueStats() {
  const db = useTenantDb()
  const waiting = await db.prepare('SELECT started_at FROM live_chats WHERE status = \'waiting\' ORDER BY started_at').all() as { started_at: string }[]
  const active = await db.prepare('SELECT COUNT(*) AS count FROM live_chats WHERE status = \'active\'').get() as { count: string | number }
  const agents = await db.prepare('SELECT id, role, roles, last_active_at, presence_override FROM staff WHERE status = \'active\'').all() as { id: string, role: string, roles: string | null, last_active_at: string | null, presence_override: string }[]
  const deskAgents = agents.filter(a => parseStaffRoles(a).some(r => r === 'agent' || r === 'admin'))
  return {
    waiting: waiting.length,
    longestWaitSeconds: waiting[0] ? Math.round((Date.now() - new Date(waiting[0].started_at).getTime()) / 1000) : 0,
    activeChats: Number(active.count),
    agentsOnline: deskAgents.filter(a => derivePresenceState(a) === 'online').length,
    agentsTotal: deskAgents.length,
  }
}
