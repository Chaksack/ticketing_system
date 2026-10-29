import type { TagWithUsage } from '../../../app/types/supportDesk'

/** Tags with how many tickets and chats use each. */
export default defineEventHandler(async (event): Promise<{ tags: TagWithUsage[] }> => {
  await requireServiceStaff(event)
  await ensureDb()
  const rows = await useTenantDb().prepare(`
    SELECT tags.id, tags.name, tags.color,
      (SELECT COUNT(*) FROM ticket_tags WHERE ticket_tags.tag_id = tags.id) AS tickets,
      (SELECT COUNT(*) FROM live_chat_tags WHERE live_chat_tags.tag_id = tags.id) AS chats
    FROM tags ORDER BY tags.name
  `).all() as { id: string, name: string, color: string, tickets: string | number, chats: string | number }[]
  return { tags: rows.map(r => ({ id: r.id, name: r.name, color: r.color, tickets: Number(r.tickets), chats: Number(r.chats) })) }
})
