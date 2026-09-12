import type { IntegrationProvider } from '../../../app/types/integration'

export default defineEventHandler(async (event) => {
  const user = await requireSessionUser(event)
  await ensureDb()

  const integrations = await Promise.all(
    (Object.keys(INTEGRATION_PROVIDERS) as IntegrationProvider[]).map(id => getStaffIntegrationStatus(user.id, id)),
  )

  return { integrations }
})
