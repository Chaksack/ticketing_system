/** Start a Canopy Care engagement for an existing client company. */
export default defineEventHandler(async (event) => {
  const user = await requirePlatformStaff(event)
  const { orgId } = await readBody<{ orgId?: string }>(event) ?? {}
  const org = orgId ? await getOrganization(orgId) : null
  if (!org || org.isHome)
    throw createError({ statusCode: 400, statusMessage: 'Pick a client company' })
  await ensureCareTables()
  if (await engagementForOrg(org.id))
    throw createError({ statusCode: 409, statusMessage: `${org.name} already has a Canopy Care engagement` })

  const id = careId()
  const now = new Date().toISOString()
  await useControlDb().prepare('INSERT INTO cp_care_engagements (id, org_id, stage, model, details, agent_ids, created_at, updated_at) VALUES (?, ?, \'scope\', \'dedicated\', ?, \'[]\', ?, ?)').run(id, org.id, JSON.stringify(defaultEngagementDetails(org.name)), now, now)
  await recordAudit({ actorId: user.id, actorName: user.name, orgId: org.id, action: 'care.engagement_created' })
  setResponseStatus(event, 201)
  return { engagement: await loadEngagement(id) }
})
