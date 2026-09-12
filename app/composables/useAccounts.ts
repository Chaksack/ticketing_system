import type { Account, AccountType } from '~/types/account'

export interface NewAccount {
  code: string
  name: string
  type: AccountType
  parentCode?: string
  description?: string
}

export function useAccounts() {
  const accounts = useState<Account[]>('accounts-list', () => [])

  async function fetchAccounts() {
    const { accounts: rows } = await $fetch('/api/accounts')
    accounts.value = rows
  }

  async function addAccount(payload: NewAccount) {
    const { account } = await $fetch('/api/accounts', { method: 'POST', body: payload })
    accounts.value.push(account)
    return account
  }

  async function updateAccount(code: string, patch: { name?: string, description?: string | null, isActive?: boolean }) {
    const { account } = await $fetch<{ account: Account }>(`/api/accounts/${code}`, { method: 'PATCH', body: patch })
    const index = accounts.value.findIndex(a => a.code === code)
    if (index !== -1)
      accounts.value[index] = account
    return account
  }

  async function removeAccount(code: string) {
    await $fetch(`/api/accounts/${code}`, { method: 'DELETE' })
    accounts.value = accounts.value.filter(a => a.code !== code)
  }

  return { accounts, fetchAccounts, addAccount, updateAccount, removeAccount }
}
