// The signed-in person's own company (Admin → Organisation).
export default defineEventHandler(async (event) => {
  await requireSessionUser(event)
  return { organization: await currentOrganization() }
})
