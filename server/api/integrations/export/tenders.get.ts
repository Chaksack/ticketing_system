const HOUR_MS = 60 * 60 * 1000

interface ExportTenderRow {
  id: string
  title: string
  issuing_authority: string | null
  reference_number: string | null
  contact_name: string | null
  contact_email: string | null
  contact_phone: string | null
  source: string | null
  stage: string
  estimated_value: number | string | null
  submission_deadline: string | null
  converted_client_id: string | null
  created_at: string
  updated_at: string
}

export default defineEventHandler(async (event) => {
  const apiKey = await requireApiKey(event, 'tenders')

  const limit = await checkRateLimit('erp-export', apiKey.id, 300, HOUR_MS)
  if (!limit.allowed) {
    throw createError({ statusCode: 429, statusMessage: 'Too many requests — please slow down.' })
  }

  await ensureDb()
  const db = useDatabase()
  const rows = await db.prepare(`
    SELECT id, title, issuing_authority, reference_number, contact_name, contact_email, contact_phone,
      source, stage, estimated_value, submission_deadline, converted_client_id, created_at, updated_at
    FROM tenders
    ORDER BY created_at DESC
  `).all() as ExportTenderRow[]

  const items = rows.map(row => ({
    id: row.id,
    title: row.title,
    issuingAuthority: row.issuing_authority ?? undefined,
    referenceNumber: row.reference_number ?? undefined,
    contactName: row.contact_name ?? undefined,
    contactEmail: row.contact_email ?? undefined,
    contactPhone: row.contact_phone ?? undefined,
    source: row.source ?? undefined,
    stage: row.stage,
    estimatedValue: row.estimated_value === null ? undefined : Number(row.estimated_value),
    submissionDeadline: row.submission_deadline ?? undefined,
    convertedClientId: row.converted_client_id ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }))

  return { resource: 'tenders', count: items.length, items }
})
