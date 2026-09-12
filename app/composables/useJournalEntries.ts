import type { JournalEntry } from '~/types/journal-entry'

export interface NewJournalLine {
  accountCode: string
  debit?: number
  credit?: number
  memo?: string
}

export interface NewJournalEntry {
  entryDate: string
  memo?: string
  lines: NewJournalLine[]
}

export function useJournalEntries() {
  const entries = useState<JournalEntry[]>('journal-entries-list', () => [])

  async function fetchEntries() {
    const { entries: rows } = await $fetch('/api/journal-entries')
    entries.value = rows
  }

  async function addEntry(payload: NewJournalEntry) {
    const { entry } = await $fetch('/api/journal-entries', { method: 'POST', body: payload })
    entries.value.unshift(entry)
    return entry
  }

  async function removeEntry(id: string) {
    await $fetch(`/api/journal-entries/${id}`, { method: 'DELETE' })
    entries.value = entries.value.filter(e => e.id !== id)
  }

  return { entries, fetchEntries, addEntry, removeEntry }
}
