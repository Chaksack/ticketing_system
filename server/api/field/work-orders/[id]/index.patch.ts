import type { WorkOrderPhoto, WorkOrderTask } from '../../../../../app/types/field'
import type { TicketPriority } from '../../../../../app/types/ticket'

interface PatchBody {
  title?: string
  description?: string | null
  clientId?: string | null
  assetId?: string | null
  location?: string | null
  priority?: TicketPriority
  skill?: string | null
  durationMinutes?: number
  slaDueAt?: string | null
  /** Schedule (both) or unschedule (both null). */
  technicianId?: string | null
  scheduledStart?: string | null
  tasks?: WorkOrderTask[]
  addPhoto?: WorkOrderPhoto
  removePhotoUrl?: string
  signatureUrl?: string
  signedBy?: string
  resolutionNotes?: string
  action?: 'start_travel' | 'start_work' | 'complete' | 'cancel' | 'reopen'
}

const BLOB_HOST = '.public.blob.vercel-storage.com'
function isOurBlob(url: string) {
  try {
    return new URL(url).hostname.endsWith(BLOB_HOST)
  }
  catch {
    return false
  }
}

/**
 * Dispatchers can change anything. The assigned technician can work the job on site: status
 * steps, checklist, photos, signature and resolution notes — not reassign or reschedule it.
 */
export default defineEventHandler(async (event) => {
  const user = await requireFieldStaff(event)
  const id = getRouterParam(event, 'id') ?? ''
  const body = await readBody<PatchBody>(event) ?? {}
  await ensureDb()
  const db = useTenantDb()

  const workOrder = await loadWorkOrder(id)
  const dispatcher = isDispatcher(user)
  if (!workOrder || (!dispatcher && workOrder.technicianId !== user.id))
    throw createError({ statusCode: 404, statusMessage: 'Work order not found' })

  const planningKeys = ['title', 'description', 'clientId', 'assetId', 'location', 'priority', 'skill', 'durationMinutes', 'slaDueAt', 'technicianId', 'scheduledStart'] as const
  if (!dispatcher && planningKeys.some(key => body[key] !== undefined))
    throw createError({ statusCode: 403, statusMessage: 'Only a dispatcher can change the plan for this work order' })

  const sets: string[] = []
  const params: (string | number | null)[] = []
  const set = (column: string, value: string | number | null) => {
    sets.push(`${column} = ?`)
    params.push(value)
  }
  const now = new Date().toISOString()

  if (body.title !== undefined)
    set('title', body.title.trim().slice(0, 200))
  if (body.description !== undefined)
    set('description', body.description)
  if (body.clientId !== undefined)
    set('client_id', body.clientId || null)
  if (body.assetId !== undefined)
    set('asset_id', body.assetId || null)
  if (body.location !== undefined)
    set('location', body.location?.trim() || null)
  if (body.priority !== undefined)
    set('priority', body.priority)
  if (body.skill !== undefined)
    set('skill', body.skill?.trim() || null)
  if (body.durationMinutes !== undefined)
    set('duration_minutes', Math.min(720, Math.max(15, Math.round(body.durationMinutes))))
  if (body.slaDueAt !== undefined)
    set('sla_due_at', body.slaDueAt || null)

  if (body.technicianId !== undefined || body.scheduledStart !== undefined) {
    if (body.technicianId && body.scheduledStart) {
      const technician = (await listTechnicians()).find(t => t.id === body.technicianId)
      if (!technician)
        throw createError({ statusCode: 400, statusMessage: 'Pick an active technician' })
      const start = new Date(body.scheduledStart)
      if (Number.isNaN(start.getTime()))
        throw createError({ statusCode: 400, statusMessage: 'Invalid start time' })
      set('technician_id', technician.id)
      set('scheduled_start', start.toISOString())
      if (workOrder.status === 'unscheduled')
        set('status', 'scheduled')
      if (technician.id !== workOrder.technicianId && technician.id !== user.id) {
        const when = start.toLocaleString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
        await createNotification({ staffId: technician.id, type: 'work_order_assigned', title: `${id} assigned to you`, body: `${workOrder.title} · ${when}`, url: `/field/work-orders/${id}` })
      }
    }
    else {
      set('technician_id', null)
      set('scheduled_start', null)
      if (workOrder.status === 'scheduled')
        set('status', 'unscheduled')
    }
  }

  if (body.tasks !== undefined)
    set('tasks', JSON.stringify(body.tasks.slice(0, 40).map(t => ({ label: String(t.label).slice(0, 200), done: !!t.done }))))
  if (body.addPhoto) {
    if (!isOurBlob(body.addPhoto.url))
      throw createError({ statusCode: 400, statusMessage: 'Upload the photo first' })
    set('photos', JSON.stringify([...workOrder.photos, { url: body.addPhoto.url, name: String(body.addPhoto.name ?? 'Photo').slice(0, 120) }].slice(0, 30)))
  }
  if (body.removePhotoUrl)
    set('photos', JSON.stringify(workOrder.photos.filter(p => p.url !== body.removePhotoUrl)))
  if (body.signatureUrl !== undefined) {
    if (!isOurBlob(body.signatureUrl))
      throw createError({ statusCode: 400, statusMessage: 'Upload the signature first' })
    set('signature_url', body.signatureUrl)
    set('signed_by', body.signedBy?.trim().slice(0, 120) || null)
  }
  if (body.resolutionNotes !== undefined)
    set('resolution_notes', body.resolutionNotes.slice(0, 4000))

  switch (body.action) {
    case 'start_travel':
      if (!workOrder.technicianId)
        throw createError({ statusCode: 409, statusMessage: 'Schedule a technician first' })
      set('status', 'travelling')
      set('travel_started_at', now)
      break
    case 'start_work':
      if (!workOrder.technicianId)
        throw createError({ statusCode: 409, statusMessage: 'Schedule a technician first' })
      set('status', 'in_progress')
      set('started_at', workOrder.startedAt ?? now)
      break
    case 'complete': {
      const notes = body.resolutionNotes ?? workOrder.resolutionNotes
      if (!notes?.trim())
        throw createError({ statusCode: 400, statusMessage: 'Add a short note on what was done before completing' })
      set('status', 'completed')
      set('completed_at', now)
      if (workOrder.ticketId) {
        await logTicketActivity({ ticketId: workOrder.ticketId, type: 'work_order', actorId: user.id, actorName: user.name, message: `${user.name} completed work order ${id}: ${notes.trim().slice(0, 200)}` })
        await touchTicket(workOrder.ticketId)
      }
      break
    }
    case 'cancel':
      if (!dispatcher)
        throw createError({ statusCode: 403, statusMessage: 'Only a dispatcher can cancel a work order' })
      set('status', 'cancelled')
      break
    case 'reopen':
      if (!dispatcher)
        throw createError({ statusCode: 403, statusMessage: 'Only a dispatcher can reopen a work order' })
      set('status', workOrder.technicianId ? 'scheduled' : 'unscheduled')
      set('completed_at', null)
      break
  }

  if (sets.length) {
    set('updated_at', now)
    await db.prepare(`UPDATE work_orders SET ${sets.join(', ')} WHERE id = ?`).run(...params, id)
  }
  return { workOrder: await loadWorkOrder(id) }
})
