import type { BdAutomationRuleRow } from '../../utils/bdAutomation'

interface UpdateBdRuleBody {
  enabled?: boolean
  name?: string
}

export default defineEventHandler(async (event) => {
  await requireAdmin(event)

  const id = getRouterParam(event, 'id')
  const body = await readBody<UpdateBdRuleBody>(event)

  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'Missing rule id' })
  }

  await ensureDb()
  const db = useDatabase()

  const existing = await db.prepare('SELECT * FROM bd_automation_rules WHERE id = ?').get(id) as BdAutomationRuleRow | undefined
  if (!existing) {
    throw createError({ statusCode: 404, statusMessage: 'Rule not found' })
  }

  const enabled = body.enabled === undefined ? existing.enabled : Number(body.enabled)
  const name = body.name?.trim() || existing.name

  await db.prepare('UPDATE bd_automation_rules SET enabled = ?, name = ? WHERE id = ?').run(enabled, name, id)

  const row = await db.prepare('SELECT * FROM bd_automation_rules WHERE id = ?').get(id) as BdAutomationRuleRow
  return { rule: mapBdAutomationRuleRow(row) }
})
