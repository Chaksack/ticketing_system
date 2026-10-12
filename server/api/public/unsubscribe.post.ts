/** Unsubscribe link in every journey email: adds the address to this company's suppression list. */
export default defineEventHandler(async (event) => {
  await useWorkspaceFromRequest(event)
  await ensureDb()
  const { messageId } = await readBody<{ messageId?: string }>(event) ?? {}
  if (!messageId || !/^[a-f0-9]{32}$/.test(messageId))
    throw createError({ statusCode: 400, statusMessage: 'This unsubscribe link is not valid' })
  const db = useTenantDb()
  const message = await db.prepare('SELECT email FROM journey_messages WHERE id = ?').get(messageId) as { email: string } | undefined
  if (!message)
    throw createError({ statusCode: 404, statusMessage: 'This unsubscribe link is not valid' })
  await db.prepare('INSERT INTO marketing_suppressions (email, reason, created_at) VALUES (?, \'unsubscribed\', ?) ON CONFLICT (email) DO NOTHING').run(message.email.toLowerCase(), new Date().toISOString())
  await db.prepare('UPDATE journey_enrollments SET status = \'unsubscribed\', updated_at = ? WHERE email = ? AND status = \'active\'').run(new Date().toISOString(), message.email.toLowerCase())
  return { ok: true }
})
