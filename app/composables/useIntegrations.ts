import type { IntegrationProvider, IntegrationStatus } from '~/types/integration'

export function useIntegrations() {
  const integrations = useState<IntegrationStatus[]>('integrations-status', () => [])

  async function fetchIntegrations() {
    const { integrations: result } = await $fetch<{ integrations: IntegrationStatus[] }>('/api/integrations')
    integrations.value = result
  }

  function connect(provider: IntegrationProvider) {
    window.location.href = `/api/integrations/${provider}/connect`
  }

  async function disconnect(provider: IntegrationProvider) {
    const { status } = await $fetch<{ status: IntegrationStatus }>(`/api/integrations/${provider}`, { method: 'DELETE' })
    const index = integrations.value.findIndex(i => i.provider === provider)
    if (index !== -1)
      integrations.value[index] = status
  }

  async function sendSlackTestMessage() {
    await $fetch('/api/slack/test', { method: 'POST' })
  }

  return { integrations, fetchIntegrations, connect, disconnect, sendSlackTestMessage }
}
