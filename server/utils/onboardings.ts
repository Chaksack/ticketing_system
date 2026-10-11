import type { AgreementStatus, ClientOnboarding, CsaTerms, OrgApp, OrgPlan, SlaTerms, SlaTier } from '../../app/types/organization'
import { randomBytes } from 'node:crypto'
import { ONBOARDING_CHECKLIST, SLA_TIER_DEFAULTS, SUPPORT_HOURS } from '../../app/types/organization'

// Canopy staff's client onboardings (cp_onboardings in the control plane).

interface OnboardingRow {
  id: string
  client_name: string
  slug: string | null
  sector: string | null
  country: string | null
  users_estimate: number | null
  contact_name: string | null
  contact_email: string | null
  plan: string
  apps: string
  csa: string
  sla: string
  agreement: string
  checklist: string
  owner_id: string | null
  owner_name: string | null
  status: string
  org_id: string | null
  created_at: string
  updated_at: string
}

function mapRow(row: OnboardingRow): ClientOnboarding {
  return {
    id: row.id,
    clientName: row.client_name,
    slug: row.slug ?? undefined,
    sector: row.sector ?? undefined,
    country: row.country ?? undefined,
    usersEstimate: row.users_estimate ?? undefined,
    contactName: row.contact_name ?? undefined,
    contactEmail: row.contact_email ?? undefined,
    plan: row.plan as OrgPlan,
    apps: JSON.parse(row.apps) as OrgApp[],
    csa: JSON.parse(row.csa) as CsaTerms,
    sla: JSON.parse(row.sla) as SlaTerms,
    agreement: JSON.parse(row.agreement) as AgreementStatus,
    checklist: JSON.parse(row.checklist) as Record<string, boolean>,
    ownerId: row.owner_id ?? undefined,
    ownerName: row.owner_name ?? undefined,
    status: row.status as ClientOnboarding['status'],
    orgId: row.org_id ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export function defaultSlaTerms(tier: SlaTier = 'gold'): SlaTerms {
  return { ...structuredClone(SLA_TIER_DEFAULTS[tier]), serviceCredits: 'Below the uptime commitment: [X]% of the monthly fee credited; below [Y]%: [Z]%. Applied to the next invoice on request within 30 days.' }
}

export async function listOnboardings(): Promise<ClientOnboarding[]> {
  await ensureControlDb()
  const rows = await useControlDb().prepare('SELECT * FROM cp_onboardings ORDER BY updated_at DESC').all() as OnboardingRow[]
  return rows.map(mapRow)
}

export async function getOnboarding(id: string): Promise<ClientOnboarding> {
  await ensureControlDb()
  const row = await useControlDb().prepare('SELECT * FROM cp_onboardings WHERE id = ?').get(id) as OnboardingRow | undefined
  if (!row)
    throw createError({ statusCode: 404, statusMessage: 'Onboarding not found' })
  return mapRow(row)
}

export async function createOnboarding(input: { clientName: string, owner: { id: string, name: string } }): Promise<ClientOnboarding> {
  await ensureControlDb()
  const id = `ONB-${randomBytes(3).toString('hex').toUpperCase()}`
  const now = new Date().toISOString()
  const csa: CsaTerms = {
    channels: ['In-app tickets & email'],
    hours: SUPPORT_HOURS[0],
    term: '12 months, auto-renew',
    contacts: '',
    escalationPath: ['Tier 1 support', 'Tier 2 engineer', 'Support manager', 'Head of Customer Success'],
    attachDpa: true,
  }
  const agreement: AgreementStatus = { draftCreated: 'done', legalReview: 'pending', clientSigned: 'pending', canopyCountersigned: 'pending' }
  const checklist = Object.fromEntries(ONBOARDING_CHECKLIST.map(item => [item, false]))
  await useControlDb().prepare(`
    INSERT INTO cp_onboardings (id, client_name, plan, apps, csa, sla, agreement, checklist, owner_id, owner_name, status, created_at, updated_at)
    VALUES (?, ?, 'professional', ?, ?, ?, ?, ?, ?, ?, 'draft', ?, ?)
  `).run(id, input.clientName.trim(), JSON.stringify(['service', 'sales']), JSON.stringify(csa), JSON.stringify(defaultSlaTerms()), JSON.stringify(agreement), JSON.stringify(checklist), input.owner.id, input.owner.name, now, now)
  return await getOnboarding(id)
}

export type OnboardingPatch = Partial<Pick<ClientOnboarding, 'clientName' | 'slug' | 'sector' | 'country' | 'usersEstimate' | 'contactName' | 'contactEmail' | 'plan' | 'apps' | 'csa' | 'sla' | 'agreement' | 'checklist'>>

export async function updateOnboarding(id: string, patch: OnboardingPatch): Promise<ClientOnboarding> {
  const current = await getOnboarding(id)
  if (current.status === 'provisioned' && (patch.slug || patch.plan || patch.apps))
    throw createError({ statusCode: 409, statusMessage: 'This client is already provisioned. Change plan and apps from Tenants instead.' })

  const next = { ...current, ...patch }
  // Both signatures in → the agreement is signed (provisioning unlocks).
  const signed = next.agreement.clientSigned === 'done' && next.agreement.canopyCountersigned === 'done'
  if (signed && !next.agreement.signedAt)
    next.agreement = { ...next.agreement, signedAt: new Date().toISOString() }
  if (signed)
    next.checklist = { ...next.checklist, 'CSA & SLA signed': true }
  const status = current.status === 'provisioned' ? 'provisioned' : signed ? 'signed' : 'draft'

  await useControlDb().prepare(`
    UPDATE cp_onboardings SET client_name = ?, slug = ?, sector = ?, country = ?, users_estimate = ?, contact_name = ?, contact_email = ?,
      plan = ?, apps = ?, csa = ?, sla = ?, agreement = ?, checklist = ?, status = ?, updated_at = ?
    WHERE id = ?
  `).run(
    next.clientName.trim(),
    next.slug ? normalizeSlug(next.slug) : null,
    next.sector ?? null,
    next.country ?? null,
    next.usersEstimate ?? null,
    next.contactName?.trim() || null,
    next.contactEmail?.trim().toLowerCase() || null,
    next.plan,
    JSON.stringify(next.apps),
    JSON.stringify(next.csa),
    JSON.stringify(next.sla),
    JSON.stringify(next.agreement),
    JSON.stringify(next.checklist),
    status,
    new Date().toISOString(),
    id,
  )
  return await getOnboarding(id)
}

export async function markOnboardingProvisioned(id: string, orgId: string) {
  const current = await getOnboarding(id)
  await useControlDb().prepare(`UPDATE cp_onboardings SET status = 'provisioned', org_id = ?, checklist = ?, updated_at = ? WHERE id = ?`).run(orgId, JSON.stringify({ ...current.checklist, 'Tenant provisioned': true, 'Sector template chosen': !!current.sector }), new Date().toISOString(), id)
  return await getOnboarding(id)
}
