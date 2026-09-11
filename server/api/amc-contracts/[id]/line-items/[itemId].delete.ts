import type { ContractRow } from '../../../../utils/mappers'

export default defineEventHandler(async (event) => {
  await requireBd(event)

  const contractId = getRouterParam(event, 'id')
  const itemId = getRouterParam(event, 'itemId')

  if (!contractId || !itemId) {
    throw createError({ statusCode: 400, statusMessage: 'Missing contract or line item id' })
  }

  await ensureDb()
  const db = useDatabase()

  const existing = await db.prepare('SELECT * FROM client_amc_contracts WHERE id = ?').get(contractId) as ContractRow | undefined
  if (!existing) {
    throw createError({ statusCode: 404, statusMessage: 'Contract not found' })
  }

  await db.prepare('DELETE FROM contract_line_items WHERE id = ? AND contract_id = ?').run(itemId, contractId)

  const client = await loadFullClient(existing.client_id)
  const project = existing.project_id ? await loadFullProject(existing.project_id) : null

  return { client, project }
})
