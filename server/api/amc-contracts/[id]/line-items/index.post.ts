import type { ContractRow } from '../../../../utils/mappers'

interface NewLineItemBody {
  productId?: string
  productName?: string
  unitPrice?: number
  currency?: string
  quantity?: number
}

export default defineEventHandler(async (event) => {
  await requireBd(event)

  const contractId = getRouterParam(event, 'id')
  const body = await readBody<NewLineItemBody>(event)

  if (!contractId) {
    throw createError({ statusCode: 400, statusMessage: 'Missing contract id' })
  }

  if (!body?.productName?.trim() || body.unitPrice === undefined || body.unitPrice < 0) {
    throw createError({ statusCode: 400, statusMessage: 'productName and a non-negative unitPrice are required' })
  }

  await ensureDb()
  const db = useDatabase()

  const existing = await db.prepare('SELECT * FROM client_amc_contracts WHERE id = ?').get(contractId) as ContractRow | undefined
  if (!existing) {
    throw createError({ statusCode: 404, statusMessage: 'Contract not found' })
  }

  const id = await nextContractLineItemId()
  const now = new Date().toISOString()
  const quantity = body.quantity && body.quantity > 0 ? body.quantity : 1

  await db.prepare(`
    INSERT INTO contract_line_items (id, contract_id, product_id, product_name, unit_price, currency, quantity, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, contractId, body.productId ?? null, body.productName.trim(), body.unitPrice, body.currency?.trim() || 'GHS', quantity, now)

  const client = await loadFullClient(existing.client_id)
  const project = existing.project_id ? await loadFullProject(existing.project_id) : null

  setResponseStatus(event, 201)
  return { client, project }
})
