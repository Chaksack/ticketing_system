import type { AiProvider, AiSettings } from '~/types/ai-provider'

export function useAiProviders() {
  const settings = useState<AiSettings | null>('ai-provider-settings', () => null)

  async function fetchAiSettings() {
    const { settings: result } = await $fetch<{ settings: AiSettings }>('/api/ai-providers')
    settings.value = result
  }

  /** Gemini: full-page redirect to Google's sign-in, which returns to Settings → Integrations. */
  function connectGemini() {
    window.location.href = '/api/ai-providers/gemini/connect'
  }

  async function saveApiKey(provider: 'openai' | 'anthropic', apiKey: string) {
    const { settings: result } = await $fetch<{ settings: AiSettings }>(`/api/ai-providers/${provider}/key`, { method: 'POST', body: { apiKey } })
    settings.value = result
  }

  async function disconnectAi(provider: AiProvider) {
    const { settings: result } = await $fetch<{ settings: AiSettings }>(`/api/ai-providers/${provider}`, { method: 'DELETE' })
    settings.value = result
  }

  async function setPreferred(provider: AiProvider | null) {
    const { settings: result } = await $fetch<{ settings: AiSettings }>('/api/ai-providers/preferred', { method: 'PUT', body: { provider } })
    settings.value = result
  }

  return { settings, fetchAiSettings, connectGemini, saveApiKey, disconnectAi, setPreferred }
}
