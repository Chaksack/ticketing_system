export default defineEventHandler(async (event) => {
  await requirePlatformStaff(event)
  await ensureCareTables()
  const body = await readBody<{ staffId?: string, date?: string, startHour?: number, endHour?: number }>(event) ?? {}
  const member = await useTenantDb().prepare('SELECT id, name FROM staff WHERE id = ? AND status = \'active\'').get(body.staffId ?? '') as { id: string, name: string } | undefined
  if (!member)
    throw createError({ statusCode: 400, statusMessage: 'Pick a Canopy staff member' })
  const start = Math.round(Number(body.startHour))
  const end = Math.round(Number(body.endHour))
  if (!/^\d{4}-\d{2}-\d{2}$/.test(body.date ?? '') || !(start >= 0 && end <= 24 && end > start))
    throw createError({ statusCode: 400, statusMessage: 'Enter a date and a start before the end' })
  const id = careId()
  await useControlDb().prepare('INSERT INTO cp_care_shifts (id, staff_id, staff_name, date, start_hour, end_hour, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)').run(id, member.id, member.name, body.date!, start, end, new Date().toISOString())
  setResponseStatus(event, 201)
  return { ok: true, id }
})
