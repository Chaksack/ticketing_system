import type { JourneyStep, JourneyTrigger } from '../../../../../app/types/marketing'

const TIME = /^(?:[01]\d|2[0-3]):[0-5]\d$/

/** Save the builder, and publish / pause. A journey can't go live without an audience and an email. */
export default defineEventHandler(async (event) => {
  await requireMarketing(event)
  const id = getRouterParam(event, 'id') ?? ''
  const body = await readBody<{ name?: string, trigger?: JourneyTrigger, segmentId?: string | null, steps?: JourneyStep[], quietStart?: string | null, quietEnd?: string | null, exitAfterDays?: number | null, action?: 'publish' | 'pause' }>(event) ?? {}
  await ensureDb()
  const db = useTenantDb()
  const journey = (await loadJourneys(id))[0]
  if (!journey)
    throw createError({ statusCode: 404, statusMessage: 'Journey not found' })

  const steps = body.steps ? validateSteps(body.steps) : journey.steps
  const trigger = body.trigger ?? journey.trigger
  const segmentId = body.segmentId !== undefined ? body.segmentId : journey.segmentId ?? null
  if (segmentId && !(await loadSegment(segmentId)))
    throw createError({ statusCode: 400, statusMessage: 'Pick an existing segment' })
  const quietStart = body.quietStart !== undefined ? body.quietStart : journey.quietStart ?? null
  const quietEnd = body.quietEnd !== undefined ? body.quietEnd : journey.quietEnd ?? null
  if ((quietStart && !TIME.test(quietStart)) || (quietEnd && !TIME.test(quietEnd)))
    throw createError({ statusCode: 400, statusMessage: 'Quiet hours must be times like 20:00' })

  let status = journey.status
  let publishedAt = journey.publishedAt ?? null
  if (body.action === 'publish') {
    if (trigger === 'segment' && !segmentId)
      throw createError({ statusCode: 400, statusMessage: 'Choose the segment this journey sends to' })
    const hasEmail = JSON.stringify(steps).includes('"type":"email"')
    if (!hasEmail)
      throw createError({ statusCode: 400, statusMessage: 'Add at least one email step before publishing' })
    status = 'active'
    publishedAt = publishedAt ?? new Date().toISOString()
  }
  else if (body.action === 'pause') {
    status = 'paused'
  }

  await db.prepare(`
    UPDATE marketing_journeys SET name = ?, status = ?, trigger_type = ?, segment_id = ?, steps = ?, quiet_start = ?, quiet_end = ?, exit_after_days = ?, published_at = ?, updated_at = ?
    WHERE id = ?
  `).run((body.name?.trim() || journey.name).slice(0, 120), status, trigger === 'demo_request' ? 'demo_request' : 'segment', trigger === 'segment' ? segmentId : null, JSON.stringify(steps), quietStart, quietEnd, body.exitAfterDays !== undefined ? (body.exitAfterDays ? Math.min(365, Math.max(1, Math.round(body.exitAfterDays))) : null) : journey.exitAfterDays ?? null, publishedAt, new Date().toISOString(), id)

  // Publishing starts it straight away rather than waiting for the next scheduled run.
  if (body.action === 'publish')
    await runJourneys().catch(error => console.error('[journeys] first run failed', error))

  return { journey: journeyResponse((await loadJourneys(id))[0]) }
})
