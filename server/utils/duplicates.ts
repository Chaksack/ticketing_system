export type DuplicateCheckTable = 'leads' | 'tenders' | 'clients'

export interface DuplicateMatch {
  id: string
  label: string
  stage: string
}

const TABLE_NAME_COLUMN: Record<DuplicateCheckTable, string> = {
  leads: 'name',
  tenders: 'title',
  clients: 'name',
}

export async function findDuplicates(table: DuplicateCheckTable, options: { name?: string, email?: string, phone?: string }): Promise<DuplicateMatch[]> {
  const name = options.name?.trim()
  const email = options.email?.trim()
  const phone = options.phone?.trim()

  if (!name && !email && !phone)
    return []

  const db = useDatabase()
  const nameColumn = TABLE_NAME_COLUMN[table]

  const conditions: string[] = []
  const params: string[] = []

  if (email) {
    conditions.push('LOWER(contact_email) = LOWER(?)')
    params.push(email)
  }
  if (phone) {
    conditions.push('contact_phone = ?')
    params.push(phone)
  }
  if (name) {
    conditions.push(`LOWER(${nameColumn}) = LOWER(?)`)
    params.push(name)
  }

  const rows = await db.prepare(`
    SELECT id, ${nameColumn} AS label, stage
    FROM ${table}
    WHERE ${conditions.join(' OR ')}
    ORDER BY created_at DESC
    LIMIT 5
  `).all(...params) as DuplicateMatch[]

  return rows
}
