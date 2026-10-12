import { markdownToText } from '../../../../app/lib/markdown'

const SYSTEM = `You help a customer-support agent write their next email reply on a support ticket. Write the reply body only (no subject, no sign-off), in plain friendly English, 2–5 sentences.
Use the knowledge-base articles and earlier resolutions if relevant. Never promise times, prices or visits that aren't in the ticket; if information is missing, ask the customer for it.`

/** "Draft with Assist" in the ticket workspace. Needs a connected AI. */
export default defineEventHandler(async (event) => {
  const user = await requireServiceStaff(event)
  const id = getRouterParam(event, 'id') ?? ''
  await ensureDb()
  const db = useTenantDb()

  const ticket = await db.prepare('SELECT subject, description, requester FROM tickets WHERE id = ?').get(id) as { subject: string, description: string, requester: string } | undefined
  if (!ticket)
    throw createError({ statusCode: 404, statusMessage: 'Ticket not found' })
  const replies = await db.prepare('SELECT author, author_type, message, internal FROM ticket_replies WHERE ticket_id = ? ORDER BY created_at').all(id) as { author: string, author_type: string, message: string, internal: number }[]
  const articles = await searchKbArticles(`${ticket.subject} ${ticket.description}`.slice(0, 800), { limit: 2 })

  const prompt = [
    articles.length ? `Knowledge-base articles:\n${articles.map(a => `# ${a.title}\n${markdownToText(a.body)}`).join('\n\n')}` : 'No matching knowledge-base articles.',
    `Ticket from ${ticket.requester}: ${ticket.subject}\n${ticket.description}`,
    replies.length ? `Thread so far:\n${replies.map(r => `${r.internal ? '[internal note] ' : ''}${r.author_type === 'staff' ? 'Support' : 'Customer'} (${r.author}): ${r.message}`).join('\n')}` : '',
  ].join('\n\n').slice(0, 12000)

  const suggestion = await generateAiText(user, SYSTEM, prompt, 400)
  if (!suggestion)
    throw createError({ statusCode: 400, statusMessage: 'Connect an AI in Settings → Integrations to draft replies with Assist.' })
  return { suggestion }
})
