import type { AmcContractStatus } from '~/types/amc'
import type { Project, ProjectStatus } from '~/types/project'

export interface NewProject {
  clientId: string
  name: string
  description?: string
  status?: ProjectStatus
  startDate?: string
  endDate?: string
}

export interface ProjectPatch {
  name?: string
  description?: string | null
  status?: ProjectStatus
  startDate?: string | null
  endDate?: string | null
}

export function useProjects() {
  const projects = useState<Project[]>('projects-list', () => [])

  function replaceProject(project: Project) {
    const index = projects.value.findIndex(p => p.id === project.id)
    if (index === -1)
      projects.value.unshift(project)
    else
      projects.value[index] = project
  }

  async function fetchProjects() {
    const { projects: rows } = await $fetch('/api/projects')
    projects.value = rows
  }

  async function fetchProject(id: string) {
    const { project } = await $fetch<{ project: Project }>(`/api/projects/${id}`)
    replaceProject(project)
    return project
  }

  async function addProject(payload: NewProject) {
    const { project } = await $fetch('/api/projects', { method: 'POST', body: payload })
    projects.value.unshift(project)
    return project
  }

  async function updateProject(id: string, patch: ProjectPatch) {
    const { project } = await $fetch<{ project: Project }>(`/api/projects/${id}`, { method: 'PATCH', body: patch })
    replaceProject(project)
    return project
  }

  async function removeProject(id: string) {
    await $fetch<{ success: true }>(`/api/projects/${id}`, { method: 'DELETE' })
    projects.value = projects.value.filter(p => p.id !== id)
  }

  async function assignAmc(projectId: string, payload: { planId: string, startDate: string, endDate: string, status?: AmcContractStatus }) {
    const { project } = await $fetch<{ project: Project }>(`/api/projects/${projectId}/amc-contracts`, { method: 'POST', body: payload })
    replaceProject(project)
    return project
  }

  function projectsForClient(clientId: string) {
    return projects.value.filter(p => p.clientId === clientId)
  }

  return { projects, fetchProjects, fetchProject, addProject, updateProject, removeProject, assignAmc, projectsForClient }
}
