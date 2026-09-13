import type { JournalEntry, JournalEntryLine, JournalEntrySource } from '../../app/types/journal-entry'

export interface JournalEntryRow {
  id: string
  period_id: string
  entry_date: string
  memo: string | null
  source: string
  source_id: string | null
  posted_by: string | null
  posted_by_name?: string | null
  created_at: string
}

export interface JournalEntryLineRow {
  id: string
  entry_id: string
  account_code: string
  account_name?: string | null
  debit: number | string
  credit: number | string
  memo: string | null
  created_at: string
}

export function mapJournalEntryLineRow(row: JournalEntryLineRow): JournalEntryLine {
  return {
    id: row.id,
    accountCode: row.account_code,
    accountName: row.account_name ?? undefined,
    debit: Number(row.debit),
    credit: Number(row.credit),
    memo: row.memo ?? undefined,
  }
}

export function mapJournalEntryRow(row: JournalEntryRow, lines: JournalEntryLine[] = []): JournalEntry {
  return {
    id: row.id,
    periodId: row.period_id,
    entryDate: row.entry_date,
    memo: row.memo ?? undefined,
    source: row.source as JournalEntrySource,
    sourceId: row.source_id ?? undefined,
    lines,
    totalDebit: lines.reduce((sum, line) => sum + line.debit, 0),
    totalCredit: lines.reduce((sum, line) => sum + line.credit, 0),
    postedBy: row.posted_by ?? undefined,
    postedByName: row.posted_by_name ?? undefined,
    createdAt: row.created_at,
  }
}

export interface NewJournalLine {
  accountCode: string
  debit?: number
  credit?: number
  memo?: string
}

export interface NewJournalEntry {
  entryDate: string
  memo?: string
  source?: JournalEntrySource
  sourceId?: string
  postedBy?: string
  lines: NewJournalLine[]
}

/**
 * Creates a journal entry, enforcing the one rule that makes this a real ledger: total debits
 * must equal total credits. Resolves (and, if needed, auto-creates) the entry date's fiscal
 * period, refusing to post into one that's already closed.
 */
export async function postJournalEntry(input: NewJournalEntry): Promise<JournalEntry> {
  if (!input.lines.length) {
    throw createError({ statusCode: 400, statusMessage: 'At least one line is required' })
  }

  let totalDebit = 0
  let totalCredit = 0
  for (const line of input.lines) {
    const debit = line.debit ?? 0
    const credit = line.credit ?? 0
    if (debit < 0 || credit < 0) {
      throw createError({ statusCode: 400, statusMessage: 'Debit and credit amounts must be non-negative' })
    }
    if (debit > 0 && credit > 0) {
      throw createError({ statusCode: 400, statusMessage: 'A line cannot have both a debit and a credit' })
    }
    if (debit === 0 && credit === 0) {
      throw createError({ statusCode: 400, statusMessage: 'Each line needs a debit or a credit amount' })
    }
    totalDebit += debit
    totalCredit += credit
  }

  if (Math.round(totalDebit * 100) !== Math.round(totalCredit * 100)) {
    throw createError({ statusCode: 400, statusMessage: `Entry is not balanced: debits ${totalDebit} ≠ credits ${totalCredit}` })
  }

  const db = useDatabase()

  const accountCodes = [...new Set(input.lines.map(line => line.accountCode))]
  const accountRows = await db.prepare(`SELECT code FROM accounts WHERE code = ANY(?)`).all(accountCodes as unknown as string) as { code: string }[]
  const knownCodes = new Set(accountRows.map(row => row.code))
  const unknownCode = accountCodes.find(code => !knownCodes.has(code))
  if (unknownCode) {
    throw createError({ statusCode: 400, statusMessage: `Unknown account code: ${unknownCode}` })
  }

  const period = await resolveOpenPeriodForDate(input.entryDate)

  const id = await nextJournalEntryId()
  const now = new Date().toISOString()

  await db.prepare(`
    INSERT INTO journal_entries (id, period_id, entry_date, memo, source, source_id, posted_by, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, period.id, input.entryDate, input.memo?.trim() || null, input.source ?? 'manual', input.sourceId ?? null, input.postedBy ?? null, now)

  for (const line of input.lines) {
    const lineId = await nextJournalEntryLineId()
    await db.prepare(`
      INSERT INTO journal_entry_lines (id, entry_id, account_code, debit, credit, memo, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(lineId, id, line.accountCode, line.debit ?? 0, line.credit ?? 0, line.memo?.trim() || null, now)
  }

  return loadFullJournalEntry(id)
}

export async function loadFullJournalEntry(id: string): Promise<JournalEntry> {
  const db = useDatabase()

  const row = await db.prepare(`
    SELECT journal_entries.*, staff.name AS posted_by_name
    FROM journal_entries
    LEFT JOIN staff ON staff.id = journal_entries.posted_by
    WHERE journal_entries.id = ?
  `).get(id) as JournalEntryRow | undefined

  if (!row) {
    throw createError({ statusCode: 404, statusMessage: 'Journal entry not found' })
  }

  const lineRows = await db.prepare(`
    SELECT journal_entry_lines.*, accounts.name AS account_name
    FROM journal_entry_lines
    LEFT JOIN accounts ON accounts.code = journal_entry_lines.account_code
    WHERE journal_entry_lines.entry_id = ?
    ORDER BY journal_entry_lines.created_at ASC
  `).all(id) as JournalEntryLineRow[]

  return mapJournalEntryRow(row, lineRows.map(lineRow => mapJournalEntryLineRow(lineRow)))
}

export async function getAllJournalEntries(): Promise<JournalEntry[]> {
  const db = useDatabase()

  const rows = await db.prepare(`
    SELECT journal_entries.*, staff.name AS posted_by_name
    FROM journal_entries
    LEFT JOIN staff ON staff.id = journal_entries.posted_by
    ORDER BY journal_entries.entry_date DESC, journal_entries.created_at DESC
  `).all() as JournalEntryRow[]

  const entries: JournalEntry[] = []
  for (const row of rows)
    entries.push(await loadFullJournalEntry(row.id))

  return entries
}

export async function deleteJournalEntry(id: string) {
  const db = useDatabase()
  await db.prepare('DELETE FROM journal_entry_lines WHERE entry_id = ?').run(id)
  await db.prepare('DELETE FROM journal_entries WHERE id = ?').run(id)
}

export async function deleteJournalEntryBySource(source: JournalEntrySource, sourceId: string) {
  const db = useDatabase()
  const row = await db.prepare('SELECT id FROM journal_entries WHERE source = ? AND source_id = ?').get(source, sourceId) as { id: string } | undefined
  if (row)
    await deleteJournalEntry(row.id)
}

const CASH_ACCOUNT_CODE = '1010'
const ACCOUNTS_RECEIVABLE_CODE = '1200'
const ACCOUNTS_PAYABLE_CODE = '2010'

/** Posts Debit Cash / Credit Accounts Receivable for a receipt recorded against a client invoice. */
export async function postReceiptToLedger(receipt: { id: string, amount: number, receivedAt: string, recordedBy?: string }, invoice: { id: string, description?: string }) {
  await postJournalEntry({
    entryDate: receipt.receivedAt,
    memo: `Payment received for invoice ${invoice.id}`,
    source: 'receipt',
    sourceId: receipt.id,
    postedBy: receipt.recordedBy,
    lines: [
      { accountCode: CASH_ACCOUNT_CODE, debit: receipt.amount, memo: `Receipt ${receipt.id}` },
      { accountCode: ACCOUNTS_RECEIVABLE_CODE, credit: receipt.amount, memo: `Invoice ${invoice.id}` },
    ],
  })
}

/** Posts Debit [expense account] / Credit Accounts Payable the moment a vendor bill is recorded — unlike client invoices, a vendor bill posts to the GL immediately, since AP has no equivalent of AR's deferred-posting shortcut. */
export async function postVendorBillToLedger(bill: { id: string, expenseAccountCode: string, total: number, billDate: string, createdBy?: string }) {
  await postJournalEntry({
    entryDate: bill.billDate,
    memo: `Vendor bill ${bill.id}`,
    source: 'vendor_bill',
    sourceId: bill.id,
    postedBy: bill.createdBy,
    lines: [
      { accountCode: bill.expenseAccountCode, debit: bill.total, memo: `Bill ${bill.id}` },
      { accountCode: ACCOUNTS_PAYABLE_CODE, credit: bill.total, memo: `Bill ${bill.id}` },
    ],
  })
}

/** Posts Debit Accounts Payable / Credit Cash for a payment recorded against a vendor bill. */
export async function postVendorPaymentToLedger(payment: { id: string, billId: string, amount: number, paidDate: string, recordedBy?: string }) {
  await postJournalEntry({
    entryDate: payment.paidDate,
    memo: `Payment for bill ${payment.billId}`,
    source: 'vendor_payment',
    sourceId: payment.id,
    postedBy: payment.recordedBy,
    lines: [
      { accountCode: ACCOUNTS_PAYABLE_CODE, debit: payment.amount, memo: `Payment ${payment.id}` },
      { accountCode: CASH_ACCOUNT_CODE, credit: payment.amount, memo: `Bill ${payment.billId}` },
    ],
  })
}
