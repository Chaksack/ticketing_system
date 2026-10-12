const SYSTEM = `You write customer-facing knowledge-base articles for a support team, from a resolved support ticket.
Write in plain, friendly English. Never include the customer's name, email, phone number or any other personal detail.
Use this Markdown only: a first line "TITLE: <short title describing the problem>", then sections that start with **Symptom.**, **Cause.** and **Fix.**, and numbered steps ("1. ") for the fix. No other headings, no HTML.`

/**
 * Turns a ticket into a draft article. With an AI connected (Settings → Integrations) it writes
 * the draft from the whole thread; without one, it lays the ticket out in the same structure for
 * the author to finish. Either way the result is a Draft, never published automatically.
 */
export default defineEventHandler(async (event) => {
  const user = await requireServiceStaff(event)
  const { ticketId } = await readBody<{ ticketId?: string }>(event) ?? {}
  if (!ticketId)
    throw createError({ statusCode: 400, statusMessage: 'ticketId is required' })

  await ensureDb()
  const db = useTenantDb()
  const ticket = await db.prepare('SELECT id, subject, description, category FROM tickets WHERE id = ?').get(ticketId) as { id: string, subject: string, description: string, category: string } | undefined
  if (!ticket)
    throw createError({ statusCode: 404, statusMessage: 'Ticket not found' })
  const replies = await db.prepare('SELECT author_type, message FROM ticket_replies WHERE ticket_id = ? AND internal = 0 ORDER BY created_at').all(ticketId) as { author_type: string, message: string }[]

  const thread = [`Category: ${ticket.category}`, `Problem reported: ${ticket.subject}\n${ticket.description}`, ...replies.map(r => `${r.author_type === 'staff' ? 'Support' : 'Customer'}: ${r.message}`)].join('\n\n')
  // If the AI is unavailable or fails, still give the author a structured draft to finish.
  let aiError: string | undefined
  const generated = await generateAiText(user, SYSTEM, thread.slice(0, 12000)).catch((error: any) => {
    aiError = error?.statusMessage ?? 'The AI could not write the draft.'
    return null
  })

  let title = ticket.subject
  let body: string
  if (generated) {
    const titleLine = generated.match(/^TITLE: ?(\S.*)$/m)
    if (titleLine?.[1])
      title = titleLine[1].trim()
    body = generated.replace(/^TITLE:.*$/m, '').trim()
  }
  else {
    const lastStaffReply = [...replies].reverse().find(r => r.author_type === 'staff')?.message
    body = [
      `**Symptom.** ${ticket.description.trim()}`,
      '**Cause.** ',
      `**Fix.** ${lastStaffReply?.trim() ?? ''}`,
      '1. ',
    ].join('\n\n')
  }

  const id = await nextPrefixedId('kb_article', 'KB')
  const now = new Date().toISOString()
  await db.prepare(`
    INSERT INTO kb_articles (id, title, body, status, visibility, source_ticket_id, author_id, author_name, created_at, updated_at)
    VALUES (?, ?, ?, 'draft', 'internal', ?, ?, ?, ?, ?)
  `).run(id, title.slice(0, 200), body, ticketId, user.id, user.name, now, now)

  setResponseStatus(event, 201)
  return { article: await loadKbArticle(id), aiWritten: !!generated, aiError }
})
