const HOUR_MS = 60 * 60 * 1000

interface ExportClientRow {
  id: string
  name: string
  contact_name: string | null
  contact_email: string | null
  contact_phone: string | null
  stage: string
  estimated_value: number | string | null
  created_at: string
  updated_at: string
}

export default defineEventHandler(async (event) => {
  const apiKey = await requireApiKey(event, 'clients')

  const limit = await checkRateLimit('erp-export', apiKey.id, 300, HOUR_MS)
  if (!limit.allowed) {
    throw createError({ statusCode: 429, statusMessage: 'Too many requests — please slow down.' })
  }

  await ensureDb()
  const db = useDatabase()
  const rows = await db.prepare(`
    SELECT id, name, contact_name, contact_email, contact_phone, stage, estimated_value, created_at, updated_at
    FROM clients
    ORDER BY created_at DESC
  `).all() as ExportClientRow[]

  const items = rows.map(row => ({
    id: row.id,
    name: row.name,
    contactName: row.contact_name ?? undefined,
    contactEmail: row.contact_email ?? undefined,
    contactPhone: row.contact_phone ?? undefined,
    stage: row.stage,
    estimatedValue: row.estimated_value === null ? undefined : Number(row.estimated_value),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }))

  return { resource: 'clients', count: items.length, items }
})
