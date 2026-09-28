const HOUR_MS = 60 * 60 * 1000

interface ExportProjectRow {
  id: string
  name: string
  description: string | null
  client_id: string
  client_name: string | null
  status: string
  start_date: string | null
  end_date: string | null
  created_at: string
  updated_at: string
}

export default defineEventHandler(async (event) => {
  const apiKey = await requireApiKey(event, 'projects')

  const limit = await checkRateLimit('erp-export', apiKey.id, 300, HOUR_MS)
  if (!limit.allowed) {
    throw createError({ statusCode: 429, statusMessage: 'Too many requests — please slow down.' })
  }

  await ensureDb()
  const db = useDatabase()
  const rows = await db.prepare(`
    SELECT projects.id, projects.name, projects.description, projects.client_id,
      clients.name AS client_name, projects.status, projects.start_date, projects.end_date,
      projects.created_at, projects.updated_at
    FROM projects
    LEFT JOIN clients ON clients.id = projects.client_id
    ORDER BY projects.created_at DESC
  `).all() as ExportProjectRow[]

  const items = rows.map(row => ({
    id: row.id,
    name: row.name,
    description: row.description ?? undefined,
    clientId: row.client_id,
    clientName: row.client_name ?? undefined,
    status: row.status,
    startDate: row.start_date ?? undefined,
    endDate: row.end_date ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }))

  return { resource: 'projects', count: items.length, items }
})
