/** What the customer's survey page shows. */
export default defineEventHandler(async (event) => {
  const org = await useWorkspaceFromRequest(event)
  await ensureDb()
  const survey = await useTenantDb().prepare(`
    SELECT ticket_surveys.rating, ticket_surveys.responded_at, tickets.subject
    FROM ticket_surveys JOIN tickets ON tickets.id = ticket_surveys.ticket_id
    WHERE ticket_surveys.token = ?
  `).get(getRouterParam(event, 'token') ?? '') as { rating: number | null, responded_at: string | null, subject: string } | undefined
  if (!survey)
    throw createError({ statusCode: 404, statusMessage: 'This survey link is not valid' })
  const workspace = org ?? await getOrganization(currentOrgId())
  return { subject: survey.subject, answered: !!survey.responded_at, rating: survey.rating ?? undefined, companyName: workspace && !workspace.isHome ? workspace.name : 'Canopy' }
})
