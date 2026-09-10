import type { RegardingType } from '../../../app/types/interaction'
import type { InteractionRow } from '../../utils/mappers'

const REGARDING_TYPES: RegardingType[] = ['lead', 'tender', 'client']

export default defineEventHandler(async (event) => {
  await requireBd(event)

  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'Missing interaction id' })
  }

  await ensureDb()
  const db = useDatabase()

  const row = await db.prepare('SELECT * FROM interactions WHERE id = ?').get(id) as InteractionRow | undefined
  if (!row) {
    throw createError({ statusCode: 404, statusMessage: 'Interaction not found' })
  }

  const regardingType = row.regarding_type as RegardingType
  const regardingId = row.regarding_id

  if (!REGARDING_TYPES.includes(regardingType)) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid regardingType' })
  }

  await deleteInteraction(id)

  if (regardingType === 'lead') {
    return { lead: await loadFullLead(regardingId) }
  }
  if (regardingType === 'tender') {
    return { tender: await loadFullTender(regardingId) }
  }
  return { client: await loadFullClient(regardingId) }
})
