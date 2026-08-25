import type { TicketPriority, TicketStatus } from '../../../app/types/ticket'
import type { MacroRow } from '../../utils/mappers'

interface NewMacroBody {
  name?: string
  body?: string
  setStatus?: TicketStatus
  setPriority?: TicketPriority
  addTagId?: string
}

export default defineEventHandler(async (event) => {
  await requireAdmin(event)

  const payload = await readBody<NewMacroBody>(event)

  if (!payload?.name?.trim() || !payload?.body?.trim()) {
    throw createError({ statusCode: 400, statusMessage: 'name and body are required' })
  }

  await ensureDb()
  const db = useDatabase()

  const id = await nextMacroId()
  const now = new Date().toISOString()

  await db.prepare(`
    INSERT INTO macros (id, name, body, set_status, set_priority, add_tag_id, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(id, payload.name.trim(), payload.body.trim(), payload.setStatus ?? null, payload.setPriority ?? null, payload.addTagId ?? null, now)

  const row = await db.prepare('SELECT * FROM macros WHERE id = ?').get(id) as MacroRow

  setResponseStatus(event, 201)
  return { macro: mapMacroRow(row) }
})
