import type { AmcContractStatus } from '../../../app/types/amc'
import type { ContractRow } from '../../utils/mappers'

interface UpdateContractBody {
  status?: AmcContractStatus
  nextStep?: string | null
  nextStepAt?: string | null
}

const STATUS_LABELS: Record<AmcContractStatus, string> = {
  submitted: 'Submitted',
  negotiating: 'Negotiating',
  active: 'Active',
  lost: 'Lost',
  cancelled: 'Cancelled',
  expired: 'Expired',
}

export default defineEventHandler(async (event) => {
  const user = await requireBd(event)

  const id = getRouterParam(event, 'id')
  const body = await readBody<UpdateContractBody>(event)

  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'Missing contract id' })
  }

  await ensureDb()
  const db = useDatabase()

  const existing = await db.prepare('SELECT * FROM client_amc_contracts WHERE id = ?').get(id) as ContractRow | undefined
  if (!existing) {
    throw createError({ statusCode: 404, statusMessage: 'Contract not found' })
  }

  const status = body.status ?? existing.status as AmcContractStatus
  const nextStep = body.nextStep !== undefined ? body.nextStep : existing.next_step
  const nextStepAt = body.nextStepAt !== undefined ? body.nextStepAt : existing.next_step_at
  // Changing the reminder time re-arms it so a new push can fire for the new time.
  const nextStepReminderSent = body.nextStepAt !== undefined && body.nextStepAt !== existing.next_step_at ? 0 : existing.next_step_reminder_sent

  await db.prepare(`
    UPDATE client_amc_contracts
    SET status = ?, next_step = ?, next_step_at = ?, next_step_reminder_sent = ?
    WHERE id = ?
  `).run(status, nextStep, nextStepAt, nextStepReminderSent, id)

  if (status !== existing.status) {
    await logClientActivity({
      clientId: existing.client_id,
      type: status === 'cancelled' ? 'amc_cancelled' : 'amc_assigned',
      actorId: user.id,
      actorName: user.name,
      fromValue: STATUS_LABELS[existing.status as AmcContractStatus],
      toValue: STATUS_LABELS[status],
      message: `AMC contract moved from ${STATUS_LABELS[existing.status as AmcContractStatus]} to ${STATUS_LABELS[status]}`,
    })
    await touchClient(existing.client_id)
  }

  const client = await loadFullClient(existing.client_id)
  const project = existing.project_id ? await loadFullProject(existing.project_id) : null
  return { client, project }
})
