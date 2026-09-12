export type JournalEntrySource = 'manual' | 'receipt'

export interface JournalEntryLine {
  id: string
  accountCode: string
  accountName?: string
  debit: number
  credit: number
  memo?: string
}

export interface JournalEntry {
  id: string
  periodId: string
  entryDate: string
  memo?: string
  source: JournalEntrySource
  sourceId?: string
  lines: JournalEntryLine[]
  totalDebit: number
  totalCredit: number
  postedBy?: string
  postedByName?: string
  createdAt: string
}
