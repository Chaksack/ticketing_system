export type ErpAuthType = 'none' | 'bearer' | 'api_key' | 'basic'

export interface ErpConnection {
  id: string
  name: string
  baseUrl: string
  authType: ErpAuthType
  authHeader?: string
  username?: string
  hasCredential: boolean
  createdBy?: string
  createdAt: string
  updatedAt: string
  lastSyncedAt?: string
  lastSyncStatus?: string
}

export interface ErpImportRecord {
  id: string
  connectionId: string
  path: string
  rawJson: unknown
  fetchedAt: string
}
