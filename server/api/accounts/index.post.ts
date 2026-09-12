import type { AccountType } from '../../../app/types/account'
import type { AccountRow } from '../../utils/accounts'

interface NewAccountBody {
  code?: string
  name?: string
  type?: AccountType
  parentCode?: string
  description?: string
}

const VALID_TYPES: AccountType[] = ['asset', 'liability', 'equity', 'revenue', 'expense']

export default defineEventHandler(async (event) => {
  await requireFinance(event)

  const body = await readBody<NewAccountBody>(event)

  if (!body?.code?.trim() || !body?.name?.trim() || !body.type || !VALID_TYPES.includes(body.type)) {
    throw createError({ statusCode: 400, statusMessage: 'code, name and a valid type are required' })
  }

  await ensureDb()
  const db = useDatabase()

  const code = body.code.trim()
  const existing = await db.prepare('SELECT code FROM accounts WHERE code = ?').get(code)
  if (existing) {
    throw createError({ statusCode: 409, statusMessage: `Account ${code} already exists` })
  }

  if (body.parentCode) {
    const parent = await db.prepare('SELECT code FROM accounts WHERE code = ?').get(body.parentCode)
    if (!parent) {
      throw createError({ statusCode: 400, statusMessage: `Parent account ${body.parentCode} does not exist` })
    }
  }

  const now = new Date().toISOString()

  await db.prepare(`
    INSERT INTO accounts (code, name, type, parent_code, is_active, description, created_at, updated_at)
    VALUES (?, ?, ?, ?, 1, ?, ?, ?)
  `).run(code, body.name.trim(), body.type, body.parentCode ?? null, body.description?.trim() || null, now, now)

  const row = await db.prepare('SELECT * FROM accounts WHERE code = ?').get(code) as AccountRow

  setResponseStatus(event, 201)
  return { account: mapAccountRow(row) }
})
