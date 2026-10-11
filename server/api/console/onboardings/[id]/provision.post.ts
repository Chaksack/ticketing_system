// Creates the client's workspace once the CSA & SLA are signed, and invites their administrator.
export default defineEventHandler(async (event) => {
  const staff = await requirePlatformStaff(event)
  const id = getRouterParam(event, 'id')!
  const onboarding = await getOnboarding(id)

  if (onboarding.status === 'provisioned')
    throw createError({ statusCode: 409, statusMessage: 'This client already has a workspace' })
  if (onboarding.status !== 'signed')
    throw createError({ statusCode: 409, statusMessage: 'Provisioning unlocks once the client has signed and Canopy has countersigned' })
  if (!onboarding.slug || !onboarding.contactName || !onboarding.contactEmail)
    throw createError({ statusCode: 400, statusMessage: 'Add the workspace address and the client\'s admin contact first' })

  const { org, adminInviteToken } = await provisionOrganization({
    slug: onboarding.slug,
    name: onboarding.clientName,
    sector: onboarding.sector,
    country: onboarding.country,
    plan: onboarding.plan,
    apps: onboarding.apps,
    source: 'staff',
    slaTier: onboarding.sla.tier,
    admin: { name: onboarding.contactName, email: onboarding.contactEmail },
  })

  let inviteSent = false
  try {
    await runWithTenant(org.id, () => sendStaffInviteEmail({ to: onboarding.contactEmail!, name: onboarding.contactName!, token: adminInviteToken!, expiresIn: '7 days' }))
    inviteSent = true
  }
  catch (error) {
    console.error(`[console] Workspace ${org.id} created, but the admin invite email failed`, error)
  }

  const updated = await markOnboardingProvisioned(id, org.id)
  await recordAudit({ actorId: staff.id, actorName: staff.name, orgId: org.id, action: 'tenant.provisioned', detail: `${onboarding.id} · admin invite ${inviteSent ? 'sent' : 'NOT sent'} to ${onboarding.contactEmail}` })

  return { onboarding: updated, tenant: org, inviteSent, inviteUrl: inviteSent ? undefined : `${useRuntimeConfig().siteUrl.replace(/\/$/, '')}/invite/${adminInviteToken}` }
})
