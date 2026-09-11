import type { BdAutomationRuleRow } from '../../utils/bdAutomation'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  await ensureDb()

  const db = useDatabase()
  const rows = await db.prepare('SELECT * FROM bd_automation_rules ORDER BY created_at ASC').all() as BdAutomationRuleRow[]

  return { rules: rows.map(row => mapBdAutomationRuleRow(row)) }
})
