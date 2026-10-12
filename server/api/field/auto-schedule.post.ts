import type { ScheduleSuggestion } from '../../../app/types/field'
import type { WorkOrderRow } from '../../utils/field'

const SLOT_MS = 30 * 60 * 1000
const PRIORITY_RANK: Record<string, number> = { urgent: 0, high: 1, medium: 2, low: 3 }

/**
 * Proposes slots for every unscheduled work order inside one working day (`dayStart`–`dayEnd`,
 * from the browser so it's the dispatcher's local day). Most urgent first (SLA due, then
 * priority); each goes to the technician with the matching skill who can finish it soonest,
 * around existing jobs and time off. Nothing is saved — the board shows these as suggestions.
 */
export default defineEventHandler(async (event) => {
  await requireDispatcher(event)
  const body = await readBody<{ dayStart?: string, dayEnd?: string }>(event)
  const dayStart = new Date(body?.dayStart ?? '').getTime()
  const dayEnd = new Date(body?.dayEnd ?? '').getTime()
  if (!Number.isFinite(dayStart) || !Number.isFinite(dayEnd) || dayEnd <= dayStart || dayEnd - dayStart > 24 * 3600 * 1000)
    throw createError({ statusCode: 400, statusMessage: 'dayStart and dayEnd must bound one working day' })
  await ensureDb()
  const db = useTenantDb()

  const technicians = await listTechnicians()
  const from = new Date(dayStart).toISOString()
  const to = new Date(dayEnd).toISOString()
  const scheduled = await db.prepare(`${WORK_ORDER_SELECT} WHERE work_orders.scheduled_start >= ? AND work_orders.scheduled_start < ? AND work_orders.status <> 'cancelled'`).all(from, to) as WorkOrderRow[]
  const blocked = await listUnavailability(from, to)
  const unscheduled = (await db.prepare(`${WORK_ORDER_SELECT} WHERE work_orders.status = 'unscheduled'`).all() as WorkOrderRow[]).map(mapWorkOrderRow)

  // Busy ranges per technician, in ms.
  const busy = new Map<string, { start: number, minutes: number }[]>(technicians.map(t => [t.id, []]))
  for (const row of scheduled.map(mapWorkOrderRow)) {
    if (row.technicianId && row.scheduledStart)
      busy.get(row.technicianId)?.push({ start: new Date(row.scheduledStart).getTime(), minutes: row.durationMinutes })
  }
  for (const block of blocked) {
    const start = new Date(block.startAt).getTime()
    busy.get(block.technicianId)?.push({ start, minutes: (new Date(block.endAt).getTime() - start) / 60000 })
  }

  // Never propose a slot that has already started today.
  const earliest = Math.max(dayStart, Math.ceil(Date.now() / SLOT_MS) * SLOT_MS)

  const ordered = unscheduled.sort((a, b) =>
    (a.slaDueAt ?? '9999').localeCompare(b.slaDueAt ?? '9999')
    || (PRIORITY_RANK[a.priority] ?? 9) - (PRIORITY_RANK[b.priority] ?? 9)
    || a.createdAt.localeCompare(b.createdAt))

  const suggestions: (ScheduleSuggestion & { lateForSla: boolean })[] = []
  const unplaced: { workOrderId: string, reason: string }[] = []

  for (const order of ordered) {
    const skill = order.skill?.toLowerCase()
    const candidates = technicians.filter(t => !skill || t.skills.some(s => s.toLowerCase() === skill))
    if (!candidates.length) {
      unplaced.push({ workOrderId: order.id, reason: `No technician has the "${order.skill}" skill` })
      continue
    }

    let best: { technicianId: string, start: number, bookedMinutes: number } | null = null
    for (const technician of candidates) {
      const ranges = busy.get(technician.id) ?? []
      for (let start = earliest; start + order.durationMinutes * 60000 <= dayEnd; start += SLOT_MS) {
        if (ranges.some(r => overlaps(start, order.durationMinutes, r.start, r.minutes)))
          continue
        const bookedMinutes = ranges.reduce((sum, r) => sum + r.minutes, 0)
        if (!best || start < best.start || (start === best.start && bookedMinutes < best.bookedMinutes))
          best = { technicianId: technician.id, start, bookedMinutes }
        break
      }
    }

    if (!best) {
      unplaced.push({ workOrderId: order.id, reason: 'No free slot long enough today' })
      continue
    }
    busy.get(best.technicianId)!.push({ start: best.start, minutes: order.durationMinutes })
    const end = best.start + order.durationMinutes * 60000
    suggestions.push({
      workOrderId: order.id,
      technicianId: best.technicianId,
      scheduledStart: new Date(best.start).toISOString(),
      lateForSla: !!order.slaDueAt && end > new Date(order.slaDueAt).getTime(),
    })
  }

  return { suggestions, unplaced }
})
