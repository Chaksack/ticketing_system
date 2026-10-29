/** The weekly support rota. */
export default defineEventHandler(async (event) => {
  await requireServiceStaff(event)
  await ensureDb()
  const timeZone = await workspaceTimeZone()
  return { shifts: await listSupportShifts(), timeZone, now: supportClock(timeZone) }
})
