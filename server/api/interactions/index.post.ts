import type { InteractionDirection, InteractionType, RegardingType } from '../../../app/types/interaction'

interface NewInteractionBody {
  regardingType?: RegardingType
  regardingId?: string
  type?: InteractionType
  subject?: string
  body?: string
  direction?: InteractionDirection
  gmailMessageId?: string
  gmailThreadId?: string
  occurredAt?: string
}

const REGARDING_TYPES: RegardingType[] = ['lead', 'tender', 'client']
const INTERACTION_TYPES: InteractionType[] = ['email', 'call', 'meeting', 'note']

export default defineEventHandler(async (event) => {
  const user = await requireBd(event)
  const body = await readBody<NewInteractionBody>(event)

  if (!body?.regardingType || !REGARDING_TYPES.includes(body.regardingType)) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid regardingType' })
  }
  if (!body.regardingId?.trim()) {
    throw createError({ statusCode: 400, statusMessage: 'regardingId is required' })
  }
  if (!body.type || !INTERACTION_TYPES.includes(body.type)) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid interaction type' })
  }

  await ensureDb()
  const db = useDatabase()

  const tables: Record<RegardingType, string> = { lead: 'leads', tender: 'tenders', client: 'clients' }
  const record = await db.prepare(`SELECT id FROM ${tables[body.regardingType]} WHERE id = ?`).get(body.regardingId)
  if (!record) {
    throw createError({ statusCode: 404, statusMessage: `${body.regardingType} not found` })
  }

  await logInteraction({
    regardingType: body.regardingType,
    regardingId: body.regardingId,
    type: body.type,
    subject: body.subject?.trim() || undefined,
    body: body.body?.trim() || undefined,
    direction: body.direction,
    gmailMessageId: body.gmailMessageId,
    gmailThreadId: body.gmailThreadId,
    occurredAt: body.occurredAt,
    loggedBy: user.id,
  })

  setResponseStatus(event, 201)

  if (body.regardingType === 'lead') {
    return { lead: await loadFullLead(body.regardingId) }
  }
  if (body.regardingType === 'tender') {
    return { tender: await loadFullTender(body.regardingId) }
  }
  return { client: await loadFullClient(body.regardingId) }
})
