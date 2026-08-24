import type { AutomationRuleRow } from '../../utils/automation'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  await ensureDb()

  const db = useDatabase()
  const rows = await db.prepare('SELECT * FROM automation_rules ORDER BY created_at ASC').all() as AutomationRuleRow[]

  return { rules: rows.map(row => mapAutomationRuleRow(row)) }
})
