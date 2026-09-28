import type { ErpAuthType, ErpConnection, ErpImportRecord } from '~/types/erp-connection'

export interface NewErpConnection {
  name: string
  baseUrl: string
  authType: ErpAuthType
  authHeader?: string
  username?: string
  credential?: string
}

export function useErpConnections() {
  const connections = useState<ErpConnection[]>('erp-connections-list', () => [])
  const records = useState<ErpImportRecord[]>('erp-connection-records', () => [])

  async function fetchConnections() {
    const { connections: rows } = await $fetch<{ connections: ErpConnection[] }>('/api/erp-connections')
    connections.value = rows
  }

  function replaceConnection(connection: ErpConnection) {
    const index = connections.value.findIndex(c => c.id === connection.id)
    if (index === -1)
      connections.value.unshift(connection)
    else
      connections.value[index] = connection
  }

  async function addConnection(payload: NewErpConnection) {
    const { connection } = await $fetch<{ connection: ErpConnection }>('/api/erp-connections', { method: 'POST', body: payload })
    replaceConnection(connection)
    return connection
  }

  async function updateConnection(id: string, patch: Partial<NewErpConnection>) {
    const { connection } = await $fetch<{ connection: ErpConnection }>(`/api/erp-connections/${id}`, { method: 'PATCH', body: patch })
    replaceConnection(connection)
    return connection
  }

  async function removeConnection(id: string) {
    await $fetch(`/api/erp-connections/${id}`, { method: 'DELETE' })
    connections.value = connections.value.filter(c => c.id !== id)
  }

  async function testConnection(id: string) {
    return await $fetch<{ ok: boolean, status: number }>(`/api/erp-connections/${id}/test`, { method: 'POST' })
  }

  async function fetchFromConnection(id: string, path: string) {
    const result = await $fetch<{ data: unknown }>(`/api/erp-connections/${id}/fetch`, { method: 'POST', body: { path } })
    await fetchRecords(id)
    return result.data
  }

  async function fetchRecords(id: string) {
    const { records: rows } = await $fetch<{ records: ErpImportRecord[] }>(`/api/erp-connections/${id}/records`)
    records.value = rows
  }

  return { connections, records, fetchConnections, addConnection, updateConnection, removeConnection, testConnection, fetchFromConnection, fetchRecords }
}
