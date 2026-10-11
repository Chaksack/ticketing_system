/** The apps a company can switch on; each controls which sidebar sections its staff see. */
export const ORG_APPS = [
  { id: 'service', label: 'Customer Service', description: 'Tickets, SLAs, queues, automations and macros.' },
  { id: 'sales', label: 'Sales', description: 'Leads, tenders, clients, quotes, products and quotas.' },
  { id: 'projects', label: 'Projects & Delivery', description: 'Projects, AMC contracts, tasks, sprints and timesheets.' },
  { id: 'insights', label: 'Insights', description: 'BD & SM, support and executive reports.' },
] as const

export type OrgApp = typeof ORG_APPS[number]['id']

export const ORG_PLANS = [
  { id: 'essentials', label: 'Essentials' },
  { id: 'professional', label: 'Professional' },
  { id: 'enterprise', label: 'Enterprise' },
] as const

export type OrgPlan = typeof ORG_PLANS[number]['id']

export const ORG_SECTORS = [
  { name: 'Real estate', hint: 'Properties, leases, tenants' },
  { name: 'Healthcare', hint: 'Patients, referrals, care' },
  { name: 'Financial services', hint: 'Clients, holdings, KYC' },
  { name: 'Manufacturing', hint: 'Distributors, quotes, assets' },
  { name: 'Public sector', hint: 'Citizens, permits, cases' },
  { name: 'Retail', hint: 'Loyalty, stores, orders' },
  { name: 'Education', hint: 'Applicants, students, alumni' },
  { name: 'Other', hint: 'Core CRM only' },
] as const

/** Sectors offered on the website's sector tabs and "Book a demo" form. */
export const DEMO_SECTORS = ['Real estate', 'Healthcare', 'Financial services', 'Manufacturing', 'Public sector', 'Retail', 'Education', 'Nonprofit', 'Other'] as const
export type DemoSector = typeof DEMO_SECTORS[number]

export const ORG_SIZES = ['1–10 people', '11–50 people', '51–250 people', '251–1,000 people', '1,000+ people'] as const

/** Workspace addresses that can't be claimed. */
export const RESERVED_SLUGS = ['canopy', 'www', 'app', 'api', 'admin', 'console', 'portal', 'docs', 'support', 'help', 'login', 'signup', 'status', 'mail', 'static', 'assets']

export type OrgStatus = 'provisioning' | 'active' | 'suspended'
export type SlaTier = 'standard' | 'gold' | 'platinum'

export interface Organization {
  id: string
  slug: string
  name: string
  sector?: string
  country?: string
  size?: string
  plan: OrgPlan
  apps: OrgApp[]
  status: OrgStatus
  source: 'home' | 'self_serve' | 'staff'
  slaTier?: SlaTier
  /** Canopy's own workspace — its admins are the Canopy staff who run the console. */
  isHome: boolean
  createdAt: string
  updatedAt: string
}

/** A tenant as listed in the staff console, with counts read from its own database. */
export interface TenantSummary extends Organization {
  staffCount: number | null
  openTicketCount: number | null
}

// ── Staff-led onboarding (CSA & SLA) ─────────────────────────────────────────

export const SUPPORT_CHANNELS = ['In-app tickets & email', 'Phone hotline', 'WhatsApp', 'Dedicated success manager'] as const
export const SUPPORT_HOURS = ['Mon–Fri, 08:00–18:00 GMT', 'Mon–Sat, 07:00–21:00 GMT', '24 × 7 for P1, business hours otherwise', '24 × 7 all priorities'] as const
export const AGREEMENT_TERMS = ['12 months, auto-renew', '24 months', '36 months'] as const

export interface SlaPriorityRow {
  priority: 'P1' | 'P2' | 'P3' | 'P4'
  definition: string
  firstResponse: string
  resolution: string
}

export interface SlaTerms {
  tier: SlaTier
  uptime: string
  maintenance: string
  recovery: string
  rows: SlaPriorityRow[]
  serviceCredits: string
}

const PRIORITY_DEFINITIONS = [
  'System down or unusable for most users',
  'Major feature failing, no workaround',
  'Feature impaired, workaround exists',
  'Question or minor issue',
]

function tierRows(targets: [string, string][]): SlaPriorityRow[] {
  return targets.map(([firstResponse, resolution], index) => ({
    priority: `P${index + 1}` as SlaPriorityRow['priority'],
    definition: PRIORITY_DEFINITIONS[index]!,
    firstResponse,
    resolution,
  }))
}

/** Default targets per tier; staff can edit any cell to negotiate. */
export const SLA_TIER_DEFAULTS: Record<SlaTier, Omit<SlaTerms, 'serviceCredits'>> = {
  standard: { tier: 'standard', uptime: '99.5%', maintenance: 'Weekends, 48 h notice', recovery: '24 h / 24 h', rows: tierRows([['2 h', '1 business day'], ['8 h', '3 business days'], ['1 business day', '10 business days'], ['2 business days', 'Next release']]) },
  gold: { tier: 'gold', uptime: '99.9%', maintenance: 'Sundays 00–04, 7 days notice', recovery: '4 h / 8 h', rows: tierRows([['30 min', '8 h'], ['2 h', '1 business day'], ['8 h', '5 business days'], ['1 business day', 'Next release']]) },
  platinum: { tier: 'platinum', uptime: '99.95%', maintenance: 'Agreed window, 14 days notice', recovery: '1 h / 4 h', rows: tierRows([['15 min, 24 × 7', '4 h'], ['1 h', '8 h'], ['4 h', '3 business days'], ['8 h', '10 business days']]) },
}

export interface CsaTerms {
  channels: string[]
  hours: string
  term: string
  contacts: string
  escalationPath: string[]
  attachDpa: boolean
}

export type AgreementStepStatus = 'pending' | 'done'

export interface AgreementStatus {
  draftCreated: AgreementStepStatus
  legalReview: AgreementStepStatus
  clientSigned: AgreementStepStatus
  canopyCountersigned: AgreementStepStatus
  signedAt?: string
}

export const ONBOARDING_CHECKLIST = [
  'Kickoff call held',
  'Sector template chosen',
  'CSA & SLA signed',
  'Tenant provisioned',
  'Client admin signed in',
  'Data migration signed off',
  'Admin training delivered',
] as const

export interface ClientOnboarding {
  id: string
  clientName: string
  slug?: string
  sector?: string
  country?: string
  usersEstimate?: number
  contactName?: string
  contactEmail?: string
  plan: OrgPlan
  apps: OrgApp[]
  csa: CsaTerms
  sla: SlaTerms
  agreement: AgreementStatus
  checklist: Record<string, boolean>
  ownerId?: string
  ownerName?: string
  status: 'draft' | 'signed' | 'provisioned'
  orgId?: string
  createdAt: string
  updatedAt: string
}

export interface AuditEntry {
  id: string
  at: string
  actorId?: string
  actorName?: string
  orgId?: string
  action: string
  detail?: string
}
