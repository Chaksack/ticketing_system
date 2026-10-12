/** The client approves recommendations from their Canopy Care success manager. */
export default defineEventHandler(async (event) => {
  const user = await requireAdmin(event)
  const { ids } = await readBody<{ ids?: string[] }>(event) ?? {}
  const engagement = await engagementForOrg(currentOrgId())
  if (!engagement)
    throw createError({ statusCode: 404, statusMessage: 'No Canopy Care engagement' })
  const now = new Date().toISOString()
  engagement.recommendations = engagement.recommendations.map(r => ids?.includes(r.id) && !r.approvedAt ? { ...r, approvedAt: now, approvedBy: user.name } : r)
  await saveEngagement(engagement)
  await recordAudit({ actorId: user.id, actorName: user.name, orgId: engagement.orgId, action: 'care.recommendations_approved', detail: `${ids?.length ?? 0} approved` })
  return { recommendations: engagement.recommendations }
})
