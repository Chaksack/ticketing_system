export type IntegrationProvider = 'slack'

export interface IntegrationStatus {
  provider: IntegrationProvider
  label: string
  connected: boolean
  externalAccountLabel?: string
  connectedAt?: string
}
