import type { ApiKey, ApiKeyScope } from '~/types/api-key'

export interface NewApiKey {
  label: string
  scopes: ApiKeyScope[]
}

export function useApiKeys() {
  const keys = useState<ApiKey[]>('api-keys-list', () => [])

  async function fetchApiKeys() {
    const { keys: rows } = await $fetch<{ keys: ApiKey[] }>('/api/admin/api-keys')
    keys.value = rows
  }

  function replaceKey(key: ApiKey) {
    const index = keys.value.findIndex(k => k.id === key.id)
    if (index === -1)
      keys.value.unshift(key)
    else
      keys.value[index] = key
  }

  async function createApiKey(payload: NewApiKey) {
    const { apiKey, key } = await $fetch<{ apiKey: ApiKey, key: string }>('/api/admin/api-keys', { method: 'POST', body: payload })
    replaceKey(apiKey)
    return { apiKey, key }
  }

  async function revokeApiKey(id: string) {
    const { apiKey } = await $fetch<{ apiKey: ApiKey }>(`/api/admin/api-keys/${id}/revoke`, { method: 'POST' })
    replaceKey(apiKey)
    return apiKey
  }

  return { keys, fetchApiKeys, createApiKey, revokeApiKey }
}
