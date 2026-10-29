import type { DirectoryClient, DirectoryProject } from '~/types/directory'

/** Client and project names for pickers — works for every role (see server/api/directory/customers.get.ts). */
export function useCustomerDirectory() {
  const clients = useState<DirectoryClient[]>('directory-clients', () => [])
  const projects = useState<DirectoryProject[]>('directory-projects', () => [])
  const loaded = useState('directory-loaded', () => false)

  async function fetchDirectory(force = false) {
    if (loaded.value && !force)
      return
    const data = await fetchUntyped<{ clients: DirectoryClient[], projects: DirectoryProject[] }>('/api/directory/customers')
    clients.value = data.clients
    projects.value = data.projects
    loaded.value = true
  }

  /** The client this email belongs to, if any. */
  function clientForEmail(email?: string) {
    const normalized = email?.trim().toLowerCase()
    return normalized ? clients.value.find(c => c.emails.includes(normalized)) ?? null : null
  }

  return { clients, projects, fetchDirectory, clientForEmail }
}
