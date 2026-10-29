// The signed-in person's own company (Admin → Organisation).
export default defineEventHandler(async (event) => {
  await requireSessionUser(event)
  await ensureDb()
  return { organization: await currentOrganization(), timeZone: await workspaceTimeZone() }
})
