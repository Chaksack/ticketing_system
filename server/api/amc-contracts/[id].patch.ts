import type { AmcContractStatus } from '../../../app/types/amc'
import type { ContractRow } from '../../utils/mappers'

export default defineEventHandler(async (event) => {
  const user = await requireBd(event)

  const id = getRouterParam(event, 'id')
  const body = await readBody<{ status?: AmcContractStatus }>(event)

  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'Missing contract id' })
  }

  if (!body?.status) {
    throw createError({ statusCode: 400, statusMessage: 'status is required' })
  }

  await ensureDb()
  const db = useDatabase()

  const existing = await db.prepare('SELECT * FROM client_amc_contracts WHERE id = ?').get(id) as ContractRow | undefined
  if (!existing) {
    throw createError({ statusCode: 404, statusMessage: 'Contract not found' })
  }

  await db.prepare('UPDATE client_amc_contracts SET status = ? WHERE id = ?').run(body.status, id)

  if (body.status === 'cancelled') {
    await logClientActivity({
      clientId: existing.client_id,
      type: 'amc_cancelled',
      actorId: user.id,
      actorName: user.name,
    })
    await touchClient(existing.client_id)
  }

  const client = await loadFullClient(existing.client_id)
  return { client }
})
