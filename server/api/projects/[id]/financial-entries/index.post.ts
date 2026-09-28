import type { ProjectFinancialEntryKind } from '../../../../../app/types/project'

interface NewFinancialEntryBody {
  kind?: ProjectFinancialEntryKind
  amount?: number
  entryDate?: string
  description?: string
  reference?: string
}

// Records a cost incurred on the project, or a payment received from the client.
export default defineEventHandler(async (event) => {
  const user = await requireBd(event)

  const projectId = getRouterParam(event, 'id')
  if (!projectId) {
    throw createError({ statusCode: 400, statusMessage: 'Missing project id' })
  }

  const body = await readBody<NewFinancialEntryBody>(event)

  if (body?.kind !== 'cost' && body?.kind !== 'payment') {
    throw createError({ statusCode: 400, statusMessage: 'kind must be "cost" or "payment"' })
  }
  const amount = Number(body.amount)
  if (!Number.isFinite(amount) || amount <= 0) {
    throw createError({ statusCode: 400, statusMessage: 'amount must be greater than 0' })
  }
  if (body.kind === 'cost' && !body.description?.trim()) {
    throw createError({ statusCode: 400, statusMessage: 'description is required for a cost (what was it for?)' })
  }

  await ensureDb()
  const db = useDatabase()

  const project = await db.prepare('SELECT id FROM projects WHERE id = ?').get(projectId)
  if (!project) {
    throw createError({ statusCode: 404, statusMessage: 'Project not found' })
  }

  const id = await nextProjectFinancialEntryId()
  const now = new Date().toISOString()
  const entryDate = body.entryDate && /^\d{4}-\d{2}-\d{2}$/.test(body.entryDate) ? body.entryDate : now.slice(0, 10)

  await db.prepare(`
    INSERT INTO project_financial_entries (id, project_id, kind, description, amount, entry_date, reference, recorded_by, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, projectId, body.kind, body.description?.trim() || null, amount, entryDate, body.reference?.trim() || null, user.id, now)

  setResponseStatus(event, 201)
  return { project: await loadFullProject(projectId) }
})
