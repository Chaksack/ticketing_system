import type { AccountRow } from '../../utils/accounts'

interface UpdateAccountBody {
  name?: string
  description?: string | null
  isActive?: boolean
}

export default defineEventHandler(async (event) => {
  await requireFinance(event)

  const code = getRouterParam(event, 'code')
  const body = await readBody<UpdateAccountBody>(event)

  if (!code) {
    throw createError({ statusCode: 400, statusMessage: 'Missing account code' })
  }

  await ensureDb()
  const db = useDatabase()

  const existing = await db.prepare('SELECT * FROM accounts WHERE code = ?').get(code) as AccountRow | undefined
  if (!existing) {
    throw createError({ statusCode: 404, statusMessage: 'Account not found' })
  }

  const name = body.name?.trim() || existing.name
  const description = body.description !== undefined ? body.description : existing.description
  const isActive = body.isActive === undefined ? existing.is_active : Number(body.isActive)

  await db.prepare('UPDATE accounts SET name = ?, description = ?, is_active = ?, updated_at = ? WHERE code = ?')
    .run(name, description, isActive, new Date().toISOString(), code)

  const row = await db.prepare('SELECT * FROM accounts WHERE code = ?').get(code) as AccountRow
  const balances = await getAccountBalances()
  return { account: mapAccountRow(row, balances.get(code) ?? 0) }
})
