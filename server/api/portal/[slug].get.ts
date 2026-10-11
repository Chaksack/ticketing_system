interface SlaPolicyRow {
  priority: string
  first_response_mins: number | string
  resolution_mins: number | string
}

// Public: what a company's support portal (/portal/<slug>) shows — its name and its real
// first-response / resolution targets (Admin → SLA Policies). Only active workspaces.
export default defineEventHandler(async (event) => {
  const slug = getRouterParam(event, 'slug') ?? ''
  const org = await getOrganizationBySlug(slug)
  if (!org || org.status !== 'active')
    throw createError({ statusCode: 404, statusMessage: 'This support portal was not found' })

  const responseTargets = await runWithTenant(org.id, async () => {
    await ensureDb()
    const rows = await useTenantDb().prepare('SELECT priority, first_response_mins, resolution_mins FROM sla_policies').all() as SlaPolicyRow[]
    return rows.map(row => ({ priority: row.priority, firstResponseMins: Number(row.first_response_mins), resolutionMins: Number(row.resolution_mins) }))
  })

  return { workspace: { slug: org.slug, name: org.name, isHome: org.isHome }, responseTargets }
})
