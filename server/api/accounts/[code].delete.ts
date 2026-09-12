export default defineEventHandler(async (event) => {
  await requireFinance(event)

  const code = getRouterParam(event, 'code')
  if (!code) {
    throw createError({ statusCode: 400, statusMessage: 'Missing account code' })
  }

  await ensureDb()
  const db = useDatabase()

  const inUse = await db.prepare('SELECT 1 FROM journal_entry_lines WHERE account_code = ? LIMIT 1').get(code)
  if (inUse) {
    throw createError({ statusCode: 409, statusMessage: 'Cannot delete an account with posted journal entries' })
  }

  await db.prepare('DELETE FROM accounts WHERE code = ?').run(code)

  return { success: true }
})
