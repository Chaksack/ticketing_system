export default defineEventHandler(async (event) => {
  await requireDispatcher(event)
  const body = await readBody<{ technicianId?: string, startAt?: string, endAt?: string, reason?: string }>(event)
  await ensureDb()
  if (!(await listTechnicians()).some(t => t.id === body?.technicianId))
    throw createError({ statusCode: 400, statusMessage: 'Pick a technician' })
  const start = new Date(body?.startAt ?? '')
  const end = new Date(body?.endAt ?? '')
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start)
    throw createError({ statusCode: 400, statusMessage: 'The end must be after the start' })

  const id = await nextPrefixedId('technician_unavailability', 'OFF', 5)
  await useTenantDb().prepare('INSERT INTO technician_unavailability (id, technician_id, start_at, end_at, reason, created_at) VALUES (?, ?, ?, ?, ?, ?)').run(id, body!.technicianId!, start.toISOString(), end.toISOString(), body?.reason?.trim().slice(0, 120) || null, new Date().toISOString())
  setResponseStatus(event, 201)
  return { ok: true, id }
})
