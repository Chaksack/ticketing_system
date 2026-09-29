export type AiProvider = 'gemini' | 'openai' | 'anthropic'

/** How a person connects a provider: Gemini via Google sign-in; OpenAI/Anthropic only offer API keys to third-party apps. */
export type AiConnectMethod = 'google' | 'api_key'

export const AI_PROVIDERS: { id: AiProvider, label: string, method: AiConnectMethod, keyUrl?: string, keyPrefix?: string }[] = [
  { id: 'gemini', label: 'Google Gemini', method: 'google' },
  { id: 'openai', label: 'OpenAI (ChatGPT)', method: 'api_key', keyUrl: 'https://platform.openai.com/api-keys', keyPrefix: 'sk-' },
  { id: 'anthropic', label: 'Anthropic (Claude)', method: 'api_key', keyUrl: 'https://console.anthropic.com/settings/keys', keyPrefix: 'sk-ant-' },
]

export function isAiProvider(value: unknown): value is AiProvider {
  return AI_PROVIDERS.some(p => p.id === value)
}

export interface AiProviderStatus {
  provider: AiProvider
  label: string
  method: AiConnectMethod
  connected: boolean
  /** Google account email for Gemini; masked key (e.g. "sk-…4f2a") for API keys. */
  accountLabel?: string
  connectedAt?: string
  /** False when the server isn't set up for it (Gemini needs the Google OAuth client configured). */
  available: boolean
}

export interface AiSettings {
  providers: AiProviderStatus[]
  /** What the person picked; null = "use whatever I've connected, else the company default". */
  preferred: AiProvider | null
  /** What "Ask AI" will actually use for them right now. */
  active: { source: 'personal' | 'company' | 'none', provider?: AiProvider, label: string }
}
