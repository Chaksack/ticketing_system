import type { SegmentCondition } from '../../../../app/types/marketing'
import { SEGMENT_FIELDS } from '../../../../app/types/marketing'

function cleanConditions(conditions: SegmentCondition[] = []): SegmentCondition[] {
  return conditions.slice(0, 20).filter(c => SEGMENT_FIELDS.some(f => f.value === c.field)).map(c => ({
    id: String(c.id || Math.random().toString(36).slice(2, 10)).slice(0, 20),
    field: c.field,
    values: (c.values ?? []).map(v => String(v).slice(0, 80)).slice(0, 20),
    exclude: !!c.exclude,
  }))
}

/** Create (no `id`) or update a segment. */
export default defineEventHandler(async (event) => {
  const user = await requireMarketing(event)
  const body = await readBody<{ id?: string, name?: string, description?: string, conditions?: SegmentCondition[] }>(event) ?? {}
  const name = body.name?.trim()
  if (!name)
    throw createError({ statusCode: 400, statusMessage: 'Give the segment a name' })
  await ensureDb()
  const db = useTenantDb()
  const now = new Date().toISOString()
  const conditions = JSON.stringify(cleanConditions(body.conditions))

  let id = body.id
  if (id) {
    const updated = await db.prepare('UPDATE marketing_segments SET name = ?, description = ?, conditions = ?, updated_at = ? WHERE id = ? RETURNING id').get(name.slice(0, 120), body.description?.trim() || null, conditions, now, id)
    if (!updated)
      throw createError({ statusCode: 404, statusMessage: 'Segment not found' })
  }
  else {
    id = await nextPrefixedId('marketing_segment', 'SEG')
    await db.prepare('INSERT INTO marketing_segments (id, name, description, conditions, created_by, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)').run(id, name.slice(0, 120), body.description?.trim() || null, conditions, user.id, now, now)
    setResponseStatus(event, 201)
  }
  return { segment: await loadSegment(id) }
})
