import type { TenderDocumentRow } from '../../utils/mappers'
import { del } from '@vercel/blob'

export default defineEventHandler(async (event) => {
  await requireBd(event)

  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'Missing tender id' })
  }

  await ensureDb()
  const db = useDatabase()

  const documents = await db.prepare('SELECT * FROM tender_documents WHERE tender_id = ?').all(id) as TenderDocumentRow[]
  for (const document of documents)
    await del(document.url).catch(() => {})

  await db.prepare('DELETE FROM tender_documents WHERE tender_id = ?').run(id)
  await db.prepare('DELETE FROM tender_activity WHERE tender_id = ?').run(id)
  await db.prepare('DELETE FROM tender_assignees WHERE tender_id = ?').run(id)
  await db.prepare('DELETE FROM tenders WHERE id = ?').run(id)

  return { success: true }
})
