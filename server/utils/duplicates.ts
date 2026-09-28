export type DuplicateCheckTable = 'leads' | 'tenders' | 'clients'
export type DuplicateReason = 'name' | 'email' | 'phone'

export interface DuplicateMatch {
  id: string
  label: string
  stage: string
  entity: DuplicateCheckTable
  reason: DuplicateReason
}

const TABLE_NAME_COLUMN: Record<DuplicateCheckTable, string> = {
  leads: 'name',
  tenders: 'title',
  clients: 'name',
}

// A new lead is checked against existing clients too (and vice versa) — the same company showing up
// as both is the most common way duplicates creep in. Tenders are titles, not company names.
const TABLES_TO_CHECK: Record<DuplicateCheckTable, DuplicateCheckTable[]> = {
  leads: ['leads', 'clients'],
  clients: ['clients', 'leads'],
  tenders: ['tenders'],
}

const ENTITY_LABEL: Record<DuplicateCheckTable, string> = {
  leads: 'lead',
  tenders: 'tender',
  clients: 'client',
}

// Trailing legal-form words that don't make two companies different ("Acme Ltd" = "ACME Limited").
const COMPANY_SUFFIXES = new Set(['ltd', 'limited', 'llc', 'inc', 'incorporated', 'plc', 'co', 'company', 'corp', 'corporation'])

/** Comparison key for a company/person name: case, accents, punctuation, spacing and legal suffixes ignored. */
export function normalizeName(name: string): string {
  const words = name
    .toLowerCase()
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .split(' ')
    .filter(Boolean)
  while (words.length > 1 && COMPANY_SUFFIXES.has(words.at(-1)!))
    words.pop()
  return words.join(' ')
}

/** Last 9 digits — so "+233 24 123 4567", "0241234567" and "024-123-4567" all match. */
function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, '')
  return digits.length >= 9 ? digits.slice(-9) : digits
}

interface CandidateRow {
  id: string
  label: string
  stage: string
  contact_email: string | null
  contact_phone: string | null
  converted_client_id?: string | null
}

async function loadCandidates(table: DuplicateCheckTable): Promise<CandidateRow[]> {
  const db = useDatabase()
  // Converted leads are skipped — the client they became is already checked directly.
  const convertedColumn = table === 'leads' ? ', converted_client_id' : ''
  return await db.prepare(`
    SELECT id, ${TABLE_NAME_COLUMN[table]} AS label, stage, contact_email, contact_phone${convertedColumn}
    FROM ${table}
    ORDER BY created_at DESC
  `).all() as CandidateRow[]
}

export async function findDuplicates(
  table: DuplicateCheckTable,
  options: { name?: string, email?: string, phone?: string, excludeId?: string },
): Promise<DuplicateMatch[]> {
  const nameKey = options.name?.trim() ? normalizeName(options.name) : ''
  const email = options.email?.trim().toLowerCase()
  const phoneKey = options.phone?.trim() ? normalizePhone(options.phone) : ''

  if (!nameKey && !email && phoneKey.length < 7)
    return []

  const matches: DuplicateMatch[] = []
  for (const entity of TABLES_TO_CHECK[table]) {
    for (const row of await loadCandidates(entity)) {
      if ((entity === table && row.id === options.excludeId) || row.converted_client_id)
        continue

      let reason: DuplicateReason | undefined
      if (nameKey && normalizeName(row.label ?? '') === nameKey)
        reason = 'name'
      else if (email && row.contact_email?.trim().toLowerCase() === email)
        reason = 'email'
      else if (phoneKey.length >= 7 && row.contact_phone && normalizePhone(row.contact_phone) === phoneKey)
        reason = 'phone'

      if (reason)
        matches.push({ id: row.id, label: row.label, stage: row.stage, entity, reason })
    }
  }

  // Same-table name matches first — those are the ones that block saving.
  return matches
    .sort((a, b) => Number(!(a.entity === table && a.reason === 'name')) - Number(!(b.entity === table && b.reason === 'name')))
    .slice(0, 5)
}

/** The existing record of the same kind with the same (normalized) name, if any. */
export async function findSameNameRecord(table: 'clients' | 'leads', name: string, excludeId?: string) {
  const nameKey = normalizeName(name)
  if (!nameKey)
    return undefined
  const rows = await loadCandidates(table)
  return rows.find(row => row.id !== excludeId && normalizeName(row.label ?? '') === nameKey)
}

/**
 * Hard stop for creating/renaming a client or lead to a name that already exists on another
 * record of the same kind. Email/phone matches and lead↔client matches stay warnings only
 * (a new lead for an existing client is legitimate repeat business).
 */
export async function assertNoDuplicateName(table: 'clients' | 'leads', name: string, excludeId?: string) {
  const existing = await findSameNameRecord(table, name, excludeId)
  if (existing) {
    throw createError({
      statusCode: 409,
      statusMessage: `A ${ENTITY_LABEL[table]} named "${existing.label}" already exists (${existing.id})`,
      data: { duplicateId: existing.id },
    })
  }
}
