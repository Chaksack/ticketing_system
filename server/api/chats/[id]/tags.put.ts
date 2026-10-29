/** Sets the chat's tags (the same tags as tickets). */
export default defineEventHandler(async (event) => {
  await requireServiceStaff(event)
  await ensureDb()
  const id = getRouterParam(event, 'id') ?? ''
  const { tagIds } = await readBody<{ tagIds?: string[] }>(event) ?? {}
  const db = useTenantDb()
  if (!(await db.prepare('SELECT id FROM live_chats WHERE id = ?').get(id)))
    throw createError({ statusCode: 404, statusMessage: 'Chat not found' })
  const wanted = [...new Set((tagIds ?? []).map(String))].slice(0, 20)
  const known = wanted.length ? (await db.prepare(`SELECT id FROM tags WHERE id IN (${wanted.map(() => '?').join(', ')})`).all(...wanted) as { id: string }[]).map(r => r.id) : []
  await db.prepare('DELETE FROM live_chat_tags WHERE chat_id = ?').run(id)
  for (const tagId of known)
    await db.prepare('INSERT INTO live_chat_tags (chat_id, tag_id) VALUES (?, ?)').run(id, tagId)
  return { tags: (await chatTags([id])).get(id) ?? [] }
})
