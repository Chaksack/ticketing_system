/** The weekly support rota. */
export default defineEventHandler(async (event) => {
  await requireServiceStaff(event)
  await ensureDb()
  return { shifts: await listSupportShifts(), timeZone: SUPPORT_TIME_ZONE, now: supportClock() }
})
