export const API_KEY_SCOPES = ['clients', 'invoices', 'projects', 'products', 'vendor_bills'] as const
export type ApiKeyScope = typeof API_KEY_SCOPES[number]

export interface ApiKey {
  id: string
  label: string
  keyPrefix: string
  scopes: ApiKeyScope[]
  createdBy?: string
  createdByName?: string
  createdAt: string
  lastUsedAt?: string
  revokedAt?: string
}
