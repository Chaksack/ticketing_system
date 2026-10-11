import type { MacroRow } from '../../utils/mappers'

export default defineEventHandler(async (event) => {
  await requireSessionUser(event)
  await ensureDb()

  const db = useTenantDb()
  const rows = await db.prepare('SELECT * FROM macros ORDER BY name ASC').all() as MacroRow[]

  return { macros: rows.map(row => mapMacroRow(row)) }
})
