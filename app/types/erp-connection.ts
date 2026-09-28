export type ErpAuthType = 'none' | 'bearer' | 'api_key' | 'basic'

export type ErpSyncResource = 'customers' | 'projects'

/** App field → ERP field (dot notation for nested values, e.g. "contact.email"). */
export interface ErpCustomerFieldMap {
  name: string
  contactName?: string
  contactEmail?: string
  contactPhone?: string
}

export interface ErpProjectFieldMap {
  name: string
  /** ERP field holding the project's customer id (or a nested object with an `id`). */
  customerId: string
  description?: string
  status?: string
  startDate?: string
  endDate?: string
}

export interface ErpSyncResourceConfig<TFields> {
  enabled: boolean
  /** Path on the ERP's API, e.g. /api/customers/ */
  path: string
  /** Where the list lives in the response. Blank = auto-detect (bare array, or results/data/items). */
  listKey?: string
  /** ERP field holding each record's unique id. */
  idField: string
  fields: TFields
}

export interface ErpSyncConfig {
  customers: ErpSyncResourceConfig<ErpCustomerFieldMap>
  projects: ErpSyncResourceConfig<ErpProjectFieldMap>
}

export interface ErpSyncResourceResult {
  fetched: number
  created: number
  updated: number
  skipped: number
  errors: string[]
}

export interface ErpSyncSummary {
  startedAt: string
  finishedAt: string
  customers?: ErpSyncResourceResult
  projects?: ErpSyncResourceResult
}

export const DEFAULT_ERP_SYNC_CONFIG: ErpSyncConfig = {
  customers: {
    enabled: false,
    path: '/api/customers/',
    idField: 'id',
    fields: { name: 'name', contactName: 'contact_name', contactEmail: 'email', contactPhone: 'phone' },
  },
  projects: {
    enabled: false,
    path: '/api/projects/',
    idField: 'id',
    fields: { name: 'name', customerId: 'customer', description: 'description', status: 'status', startDate: 'start_date', endDate: 'end_date' },
  },
}

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
  syncConfig: ErpSyncConfig
  lastSyncSummary?: ErpSyncSummary
}

export interface ErpImportRecord {
  id: string
  connectionId: string
  path: string
  rawJson: unknown
  fetchedAt: string
}
