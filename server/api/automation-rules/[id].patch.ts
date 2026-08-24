import type { AutomationRuleRow } from '../../utils/automation'

interface UpdateRuleBody {
  enabled?: boolean
  name?: string
}

export default defineEventHandler(async (event) => {
  await requireAdmin(event)

  const id = getRouterParam(event, 'id')
  const body = await readBody<UpdateRuleBody>(event)

  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'Missing rule id' })
  }

  await ensureDb()
  const db = useDatabase()

  const existing = await db.prepare('SELECT * FROM automation_rules WHERE id = ?').get(id) as AutomationRuleRow | undefined
  if (!existing) {
    throw createError({ statusCode: 404, statusMessage: 'Rule not found' })
  }

  const enabled = body.enabled === undefined ? existing.enabled : Number(body.enabled)
  const name = body.name?.trim() || existing.name

  await db.prepare('UPDATE automation_rules SET enabled = ?, name = ? WHERE id = ?').run(enabled, name, id)

  const row = await db.prepare('SELECT * FROM automation_rules WHERE id = ?').get(id) as AutomationRuleRow
  return { rule: mapAutomationRuleRow(row) }
})
