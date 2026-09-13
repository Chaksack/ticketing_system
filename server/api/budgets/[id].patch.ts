import type { BudgetRow } from '../../utils/budgets'

interface UpdateBudgetBody {
  amount?: number
  notes?: string | null
}

export default defineEventHandler(async (event) => {
  await requireFinance(event)

  const id = getRouterParam(event, 'id')
  const body = await readBody<UpdateBudgetBody>(event)

  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'Missing budget id' })
  }

  await ensureDb()
  const db = useDatabase()

  const existing = await db.prepare('SELECT * FROM budgets WHERE id = ?').get(id) as BudgetRow | undefined
  if (!existing) {
    throw createError({ statusCode: 404, statusMessage: 'Budget not found' })
  }

  if (body.amount !== undefined && Number.isNaN(body.amount)) {
    throw createError({ statusCode: 400, statusMessage: 'amount must be a number' })
  }

  const amount = body.amount ?? Number(existing.amount)
  const notes = body.notes !== undefined ? body.notes : existing.notes

  await db.prepare('UPDATE budgets SET amount = ?, notes = ?, updated_at = ? WHERE id = ?')
    .run(amount, notes?.trim() || null, new Date().toISOString(), id)

  const row = await db.prepare(`
    SELECT budgets.*, accounts.name AS account_name
    FROM budgets LEFT JOIN accounts ON accounts.code = budgets.account_code
    WHERE budgets.id = ?
  `).get(id) as BudgetRow

  return { budget: mapBudgetRow(row) }
})
