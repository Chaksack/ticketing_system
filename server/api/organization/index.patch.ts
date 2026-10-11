import type { OrgApp } from '../../../app/types/organization'

// Company admins can rename the workspace and switch apps on or off. The address (slug) is
// fixed: it's the database name and every portal link.
export default defineEventHandler(async (event) => {
  const admin = await requireAdmin(event)
  const body = await readBody<{ name?: string, apps?: OrgApp[] }>(event)

  if (body?.apps && !body.apps.length)
    throw createError({ statusCode: 400, statusMessage: 'Keep at least one app switched on' })

  const organization = await updateOrganization(currentOrgId(), { name: body?.name, apps: body?.apps })
  await recordAudit({ actorId: admin.id, actorName: admin.name, orgId: organization.id, action: 'workspace.updated', detail: `Apps: ${organization.apps.join(', ')}` })
  return { organization }
})
