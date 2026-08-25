import type { TicketPriority, TicketStatus } from '../../../app/types/ticket'
import type { MacroRow } from '../../utils/mappers'

interface UpdateMacroBody {
  name?: string
  body?: string
  setStatus?: TicketStatus | null
  setPriority?: TicketPriority | null
  addTagId?: string | null
}

export default defineEventHandler(async (event) => {
  await requireAdmin(event)

  const id = getRouterParam(event, 'id')
  const payload = await readBody<UpdateMacroBody>(event)

  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'Missing macro id' })
  }

  await ensureDb()
  const db = useDatabase()

  const existing = await db.prepare('SELECT * FROM macros WHERE id = ?').get(id) as MacroRow | undefined
  if (!existing) {
    throw createError({ statusCode: 404, statusMessage: 'Macro not found' })
  }

  const name = payload.name?.trim() || existing.name
  const body = payload.body?.trim() || existing.body
  const setStatus = payload.setStatus !== undefined ? payload.setStatus : existing.set_status
  const setPriority = payload.setPriority !== undefined ? payload.setPriority : existing.set_priority
  const addTagId = payload.addTagId !== undefined ? payload.addTagId : existing.add_tag_id

  await db.prepare(`
    UPDATE macros SET name = ?, body = ?, set_status = ?, set_priority = ?, add_tag_id = ? WHERE id = ?
  `).run(name, body, setStatus, setPriority, addTagId, id)

  const row = await db.prepare('SELECT * FROM macros WHERE id = ?').get(id) as MacroRow
  return { macro: mapMacroRow(row) }
})
