export type AccountType = 'asset' | 'liability' | 'equity' | 'revenue' | 'expense'

export interface Account {
  code: string
  name: string
  type: AccountType
  parentCode?: string
  isActive: boolean
  description?: string
  balance: number
  createdAt: string
  updatedAt: string
}
