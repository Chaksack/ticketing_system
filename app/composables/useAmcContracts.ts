import type { Client } from '~/types/client'

export function useAmcContracts() {
  const clients = useState<Client[]>('clients-list', () => [])

  function replaceClient(client: Client) {
    const index = clients.value.findIndex(c => c.id === client.id)
    if (index !== -1)
      clients.value[index] = client
  }

  async function cancelContract(contractId: string) {
    const { client } = await $fetch(`/api/amc-contracts/${contractId}`, { method: 'PATCH', body: { status: 'cancelled' } })
    replaceClient(client)
    return client
  }

  return { cancelContract }
}
