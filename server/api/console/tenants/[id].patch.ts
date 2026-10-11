import type { OrgApp, OrgPlan, OrgStatus, SlaTier } from '../../../../app/types/organization'

// Suspend / reactivate a company, or change its plan, apps or SLA tier. Every change is audited.
export default defineEventHandler(async (event) => {
  const staff = await requirePlatformStaff(event)

  const id = getRouterParam(event, 'id')!
  if (id === HOME_ORG_ID)
    throw createError({ statusCode: 400, statusMessage: 'Canopy\'s own workspace can\'t be changed here' })

  const body = await readBody<{ status?: OrgStatus, plan?: OrgPlan, apps?: OrgApp[], slaTier?: SlaTier | null }>(event)
  if (body?.status && body.status !== 'active' && body.status !== 'suspended')
    throw createError({ statusCode: 400, statusMessage: 'status must be active or suspended' })
  if (body?.apps && !body.apps.length)
    throw createError({ statusCode: 400, statusMessage: 'Keep at least one app switched on' })

  const before = await getOrganization(id, { fresh: true })
  if (!before)
    throw createError({ statusCode: 404, statusMessage: 'Tenant not found' })

  const tenant = await updateOrganization(id, { status: body?.status, plan: body?.plan, apps: body?.apps, slaTier: body?.slaTier })

  const changes = [
    body?.status && body.status !== before.status ? `status ${before.status} → ${body.status}` : null,
    body?.plan && body.plan !== before.plan ? `plan ${before.plan} → ${body.plan}` : null,
    body?.apps ? `apps: ${tenant.apps.join(', ')}` : null,
    body?.slaTier !== undefined && body.slaTier !== (before.slaTier ?? null) ? `SLA tier → ${body.slaTier ?? 'none'}` : null,
  ].filter(Boolean).join('; ')
  if (changes)
    await recordAudit({ actorId: staff.id, actorName: staff.name, orgId: id, action: body?.status === 'suspended' ? 'tenant.suspended' : body?.status === 'active' && before.status === 'suspended' ? 'tenant.reactivated' : 'tenant.updated', detail: changes })

  return { tenant }
})
