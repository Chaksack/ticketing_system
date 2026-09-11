import type { AmcContractStatus } from '~/types/amc'
import type { Client } from '~/types/client'
import type { Project } from '~/types/project'

export interface ContractPatch {
  status?: AmcContractStatus
  nextStep?: string | null
  nextStepAt?: string | null
}

export function useAmcContracts() {
  const clients = useState<Client[]>('clients-list', () => [])
  const projects = useState<Project[]>('projects-list', () => [])

  function replaceClient(client: Client) {
    const index = clients.value.findIndex(c => c.id === client.id)
    if (index !== -1)
      clients.value[index] = client
  }

  function replaceProject(project: Project) {
    const index = projects.value.findIndex(p => p.id === project.id)
    if (index !== -1)
      projects.value[index] = project
  }

  async function updateContract(contractId: string, patch: ContractPatch) {
    const { client, project } = await $fetch<{ client: Client, project: Project | null }>(`/api/amc-contracts/${contractId}`, { method: 'PATCH', body: patch })
    replaceClient(client)
    if (project)
      replaceProject(project)
    return client
  }

  async function cancelContract(contractId: string) {
    return await updateContract(contractId, { status: 'cancelled' })
  }

  async function addLineItem(contractId: string, payload: { productId?: string, productName: string, unitPrice: number, currency: string, quantity?: number }) {
    const { client, project } = await $fetch<{ client: Client, project: Project | null }>(`/api/amc-contracts/${contractId}/line-items`, { method: 'POST', body: payload })
    replaceClient(client)
    if (project)
      replaceProject(project)
    return client
  }

  async function removeLineItem(contractId: string, itemId: string) {
    const { client, project } = await $fetch<{ client: Client, project: Project | null }>(`/api/amc-contracts/${contractId}/line-items/${itemId}`, { method: 'DELETE' })
    replaceClient(client)
    if (project)
      replaceProject(project)
    return client
  }

  return { updateContract, cancelContract, addLineItem, removeLineItem }
}
