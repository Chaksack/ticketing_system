import type { ApiKeyScope } from '../../../../app/types/api-key'

export default defineEventHandler(async (event) => {
  const apiKey = await requireApiKey(event)
  const scopes = JSON.parse(apiKey.scopes) as ApiKeyScope[]

  return {
    resources: scopes.map(scope => ({
      scope,
      path: `/api/integrations/export/${scope.replace('_', '-')}`,
    })),
  }
})
