import type { AuditEntry, ClientOnboarding, Organization, OrgApp, OrgPlan, OrgStatus, SlaTier, TenantSummary } from '~/types/organization'

export interface ConsoleOverview {
  tenants: { total: number, active: number, suspended: number, newThisWeek: number, selfServe: number, staffLed: number }
  onboardings: { draft: number, signed: number, provisioned: number }
  recentTenants: Organization[]
  recentAudit: AuditEntry[]
}

export type OnboardingPatch = Partial<Pick<ClientOnboarding, 'clientName' | 'slug' | 'sector' | 'country' | 'usersEstimate' | 'contactName' | 'contactEmail' | 'plan' | 'apps' | 'csa' | 'sla' | 'agreement' | 'checklist'>>

/** Canopy staff console (home-workspace admins): tenants and staff-led client onboarding. */
export function useConsole() {
  const fetchOverview = () => $fetch<ConsoleOverview>('/api/console/overview')

  const fetchTenants = async () => (await $fetch<{ tenants: TenantSummary[] }>('/api/console/tenants')).tenants

  const fetchTenant = (id: string) => $fetch<{ tenant: TenantSummary, onboarding: ClientOnboarding | null, audit: AuditEntry[] }>(`/api/console/tenants/${id}`)

  const updateTenant = async (id: string, patch: { status?: OrgStatus, plan?: OrgPlan, apps?: OrgApp[], slaTier?: SlaTier | null }) =>
    (await $fetch<{ tenant: Organization }>(`/api/console/tenants/${id}`, { method: 'PATCH', body: patch })).tenant

  const fetchOnboardings = async () => (await $fetch<{ onboardings: ClientOnboarding[] }>('/api/console/onboardings')).onboardings

  const createOnboarding = async (clientName: string) =>
    (await $fetch<{ onboarding: ClientOnboarding }>('/api/console/onboardings', { method: 'POST', body: { clientName } })).onboarding

  const fetchOnboarding = async (id: string) => (await $fetch<{ onboarding: ClientOnboarding }>(`/api/console/onboardings/${id}`)).onboarding

  const updateOnboarding = async (id: string, patch: OnboardingPatch) =>
    (await $fetch<{ onboarding: ClientOnboarding }>(`/api/console/onboardings/${id}`, { method: 'PATCH', body: patch })).onboarding

  const provisionOnboarding = (id: string) =>
    $fetch<{ onboarding: ClientOnboarding, tenant: Organization, inviteSent: boolean, inviteUrl?: string }>(`/api/console/onboardings/${id}/provision`, { method: 'POST' })

  return { fetchOverview, fetchTenants, fetchTenant, updateTenant, fetchOnboardings, createOnboarding, fetchOnboarding, updateOnboarding, provisionOnboarding }
}
