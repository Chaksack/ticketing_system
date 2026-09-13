import type { BudgetRow } from '../../utils/budgets'

interface NewBudgetBody {
  periodId?: string
  accountCode?: string
  amount?: number
  notes?: string
}

const PERIOD_ID_PATTERN = /^\d{4}-\d{2}$/

export default defineEventHandler(async (event) => {
  await requireFinance(event)

  const body = await readBody<NewBudgetBody>(event)

  if (!body?.periodId?.trim() || !PERIOD_ID_PATTERN.test(body.periodId.trim())) {
    throw createError({ statusCode: 400, statusMessage: 'periodId must be in YYYY-MM form' })
  }
  if (!body.accountCode?.trim() || typeof body.amount !== 'number' || Number.isNaN(body.amount)) {
    throw createError({ statusCode: 400, statusMessage: 'accountCode and a numeric amount are required' })
  }

  await ensureDb()
  const db = useDatabase()

  const periodId = body.periodId.trim()
  const accountCode = body.accountCode.trim()

  const account = await db.prepare('SELECT code FROM accounts WHERE code = ?').get(accountCode)
  if (!account) {
    throw createError({ statusCode: 400, statusMessage: `Unknown account code: ${accountCode}` })
  }

  const existing = await db.prepare('SELECT id FROM budgets WHERE period_id = ? AND account_code = ?').get(periodId, accountCode)
  if (existing) {
    throw createError({ statusCode: 409, statusMessage: 'A budget already exists for this account and period — edit it instead' })
  }

  const id = await nextBudgetId()
  const now = new Date().toISOString()

  await db.prepare(`
    INSERT INTO budgets (id, period_id, account_code, amount, notes, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(id, periodId, accountCode, body.amount, body.notes?.trim() || null, now, now)

  const row = await db.prepare(`
    SELECT budgets.*, accounts.name AS account_name
    FROM budgets LEFT JOIN accounts ON accounts.code = budgets.account_code
    WHERE budgets.id = ?
  `).get(id) as BudgetRow

  setResponseStatus(event, 201)
  return { budget: mapBudgetRow(row) }
})
