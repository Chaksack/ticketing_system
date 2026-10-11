import type { Organization, OrgApp, OrgStatus } from '../../app/types/organization'
import { randomBytes } from 'node:crypto'
import { ORG_APPS, RESERVED_SLUGS } from '../../app/types/organization'

/**
 * The control plane lives in the main database (beside the home organisation's own tables) and
 * is the only place that knows about more than one company:
 *   cp_organizations — every company, its workspace slug, apps, plan and status
 *   cp_directory     — which company each staff email belongs to (one company per person)
 *   cp_onboardings   — Canopy staff's client onboardings (details, plan, CSA & SLA, checklist)
 *   cp_audit_log     — every Canopy staff action on a tenant
 */

let controlReady: Promise<void> | null = null

export function ensureControlDb() {
  if (!controlReady) {
    controlReady = migrateControl().catch((error) => {
      controlReady = null
      throw error
    })
  }
  return controlReady
}

async function migrateControl() {
  const db = useControlDb()

  await db.exec(`
    CREATE TABLE IF NOT EXISTS cp_organizations (
      id TEXT PRIMARY KEY,
      slug TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      sector TEXT,
      country TEXT,
      size TEXT,
      plan TEXT NOT NULL DEFAULT 'professional',
      apps TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'active',
      source TEXT NOT NULL,
      sla_tier TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `)
  await db.exec(`
    CREATE TABLE IF NOT EXISTS cp_directory (
      email TEXT PRIMARY KEY,
      org_id TEXT NOT NULL,
      created_at TEXT NOT NULL
    )
  `)
  await db.exec('CREATE INDEX IF NOT EXISTS idx_cp_directory_org ON cp_directory (org_id)')
  await db.exec(`
    CREATE TABLE IF NOT EXISTS cp_onboardings (
      id TEXT PRIMARY KEY,
      client_name TEXT NOT NULL,
      slug TEXT,
      sector TEXT,
      country TEXT,
      users_estimate INTEGER,
      contact_name TEXT,
      contact_email TEXT,
      plan TEXT NOT NULL DEFAULT 'professional',
      apps TEXT NOT NULL,
      csa TEXT NOT NULL,
      sla TEXT NOT NULL,
      agreement TEXT NOT NULL,
      checklist TEXT NOT NULL,
      owner_id TEXT,
      owner_name TEXT,
      status TEXT NOT NULL DEFAULT 'draft',
      org_id TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `)
  await db.exec(`
    CREATE TABLE IF NOT EXISTS cp_audit_log (
      id TEXT PRIMARY KEY,
      at TEXT NOT NULL,
      actor_id TEXT,
      actor_name TEXT,
      org_id TEXT,
      action TEXT NOT NULL,
      detail TEXT
    )
  `)
  await db.exec('CREATE INDEX IF NOT EXISTS idx_cp_audit_org ON cp_audit_log (org_id, at)')

  // The original data is Canopy's own workspace — register it, and its existing staff, once.
  const now = new Date().toISOString()
  await db.prepare(`
    INSERT INTO cp_organizations (id, slug, name, sector, plan, apps, status, source, created_at, updated_at)
    VALUES (?, ?, 'Canopy', 'Other', 'enterprise', ?, 'active', 'home', ?, ?)
    ON CONFLICT (id) DO NOTHING
  `).run(HOME_ORG_ID, HOME_ORG_ID, JSON.stringify(ORG_APPS.map(app => app.id)), now, now)

  await runWithTenant(HOME_ORG_ID, () => ensureDb())
  await db.exec(`
    INSERT INTO cp_directory (email, org_id, created_at)
    SELECT LOWER(email), '${HOME_ORG_ID}', created_at FROM staff
    ON CONFLICT (email) DO NOTHING
  `)
}

// ── Organisations ──────────────────────────────────────────────────────────

interface OrgRow {
  id: string
  slug: string
  name: string
  sector: string | null
  country: string | null
  size: string | null
  plan: string
  apps: string
  status: string
  source: string
  sla_tier: string | null
  created_at: string
  updated_at: string
}

function mapOrgRow(row: OrgRow): Organization {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    sector: row.sector ?? undefined,
    country: row.country ?? undefined,
    size: row.size ?? undefined,
    plan: row.plan as Organization['plan'],
    apps: JSON.parse(row.apps) as OrgApp[],
    status: row.status as OrgStatus,
    source: row.source as Organization['source'],
    slaTier: (row.sla_tier as Organization['slaTier']) ?? undefined,
    isHome: row.id === HOME_ORG_ID,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

// Short-lived per-instance cache — the tenant middleware looks the org up on every request.
const orgCache = new Map<string, { org: Organization | null, at: number }>()
const ORG_CACHE_MS = 15_000

export async function getOrganization(orgId: string, options: { fresh?: boolean } = {}): Promise<Organization | null> {
  const cached = orgCache.get(orgId)
  if (!options.fresh && cached && Date.now() - cached.at < ORG_CACHE_MS)
    return cached.org
  await ensureControlDb()
  const row = await useControlDb().prepare('SELECT * FROM cp_organizations WHERE id = ?').get(orgId) as OrgRow | undefined
  const org = row ? mapOrgRow(row) : null
  orgCache.set(orgId, { org, at: Date.now() })
  return org
}

export async function getOrganizationBySlug(slug: string): Promise<Organization | null> {
  await ensureControlDb()
  const row = await useControlDb().prepare('SELECT * FROM cp_organizations WHERE slug = ?').get(slug.toLowerCase()) as OrgRow | undefined
  return row ? mapOrgRow(row) : null
}

export async function listOrganizations(): Promise<Organization[]> {
  await ensureControlDb()
  const rows = await useControlDb().prepare('SELECT * FROM cp_organizations ORDER BY created_at DESC').all() as OrgRow[]
  return rows.map(mapOrgRow)
}

export async function currentOrganization(): Promise<Organization> {
  const org = await getOrganization(currentOrgId())
  if (!org)
    throw createError({ statusCode: 404, statusMessage: 'Organisation not found' })
  return org
}

export async function updateOrganization(orgId: string, patch: { name?: string, apps?: OrgApp[], status?: OrgStatus, plan?: Organization['plan'], slaTier?: Organization['slaTier'] | null }) {
  const org = await getOrganization(orgId, { fresh: true })
  if (!org)
    throw createError({ statusCode: 404, statusMessage: 'Organisation not found' })
  const apps = patch.apps ? patch.apps.filter(app => ORG_APPS.some(a => a.id === app)) : org.apps
  await useControlDb().prepare(`
    UPDATE cp_organizations SET name = ?, apps = ?, status = ?, plan = ?, sla_tier = ?, updated_at = ? WHERE id = ?
  `).run(
    patch.name?.trim() || org.name,
    JSON.stringify(apps),
    patch.status ?? org.status,
    patch.plan ?? org.plan,
    patch.slaTier === null ? null : (patch.slaTier ?? org.slaTier ?? null),
    new Date().toISOString(),
    orgId,
  )
  orgCache.delete(orgId)
  return (await getOrganization(orgId, { fresh: true }))!
}

/** Active organisations, home first — what the scheduled jobs loop over. */
export async function listActiveOrgIds(): Promise<string[]> {
  await ensureControlDb()
  const rows = await useControlDb().prepare(`SELECT id FROM cp_organizations WHERE status = 'active' ORDER BY (id = '${HOME_ORG_ID}') DESC, created_at ASC`).all() as { id: string }[]
  return rows.map(row => row.id)
}

/**
 * Runs `fn` once per active company, inside that company's database. A failure in one company
 * is logged and doesn't stop the others. Used by the cron routes and the in-process sweep.
 */
export async function forEachActiveOrg<T>(label: string, fn: () => Promise<T>): Promise<Record<string, T | { error: string }>> {
  const results: Record<string, T | { error: string }> = {}
  for (const orgId of await listActiveOrgIds()) {
    try {
      results[orgId] = await runWithTenant(orgId, async () => {
        await ensureDb()
        return await fn()
      })
    }
    catch (error: any) {
      console.error(`[${label}] failed for ${orgId}`, error)
      results[orgId] = { error: error?.message ?? 'failed' }
    }
  }
  return results
}

/** What the signed-in UI needs to know about its own company. */
export async function sessionOrgSummary() {
  const org = await getOrganization(currentOrgId())
  return org
    ? { id: org.id, name: org.name, slug: org.slug, apps: org.apps, plan: org.plan, sector: org.sector, isHome: org.isHome }
    : null
}

// ── Workspace slugs ────────────────────────────────────────────────────────

export function normalizeSlug(value: string) {
  return value.toLowerCase().trim().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '').replace(/-{2,}/g, '-')
}

export async function checkSlugAvailable(raw: string): Promise<{ slug: string, available: boolean, reason?: string }> {
  const slug = normalizeSlug(raw)
  if (slug.length < 3 || slug.length > 30)
    return { slug, available: false, reason: 'Use 3–30 letters, numbers or hyphens.' }
  if (RESERVED_SLUGS.includes(slug))
    return { slug, available: false, reason: 'That address is reserved.' }
  if (await getOrganizationBySlug(slug))
    return { slug, available: false, reason: 'That address is already taken.' }
  return { slug, available: true }
}

// ── Directory (email → company) ────────────────────────────────────────────

export async function lookupOrgIdByEmail(email: string): Promise<string | null> {
  await ensureControlDb()
  const row = await useControlDb().prepare('SELECT org_id FROM cp_directory WHERE email = ?').get(email.trim().toLowerCase()) as { org_id: string } | undefined
  return row?.org_id ?? null
}

/** Claims an email for a company. Each person belongs to one company, so a clash is a 409. */
export async function registerDirectoryEmail(email: string, orgId: string) {
  const normalized = email.trim().toLowerCase()
  const existing = await lookupOrgIdByEmail(normalized)
  if (existing && existing !== orgId)
    throw createError({ statusCode: 409, statusMessage: 'This email already belongs to another Canopy workspace' })
  if (!existing) {
    await useControlDb().prepare('INSERT INTO cp_directory (email, org_id, created_at) VALUES (?, ?, ?) ON CONFLICT (email) DO NOTHING').run(normalized, orgId, new Date().toISOString())
  }
}

export async function unregisterDirectoryEmail(email: string, orgId: string) {
  await ensureControlDb()
  await useControlDb().prepare('DELETE FROM cp_directory WHERE email = ? AND org_id = ?').run(email.trim().toLowerCase(), orgId)
}

// ── Org-scoped tokens (invite / password reset links) ──────────────────────

/** A random token prefixed with the company, so a link opened while signed out finds the right database. */
export function newOrgToken(orgId = currentOrgId()) {
  return `${orgId}.${randomBytes(32).toString('hex')}`
}

/** The company a token belongs to; tokens issued before multi-company support belong to the home org. */
export function orgIdFromToken(token: string): string {
  const prefix = token.includes('.') ? token.slice(0, token.indexOf('.')) : ''
  return /^[a-z0-9][a-z0-9-]{1,40}$/.test(prefix) ? prefix : HOME_ORG_ID
}

/** Points the request at the token's company, refusing suspended or unknown companies. */
export async function useOrgFromToken(event: { context: Record<string, any> }, token: string) {
  const orgId = orgIdFromToken(token)
  const org = await getOrganization(orgId)
  if (!org || org.status !== 'active')
    throw createError({ statusCode: 404, statusMessage: 'This link is invalid or has expired' })
  setRequestOrg(event, orgId)
  return org
}

// ── Public, company-specific endpoints (portal) ────────────────────────────

/**
 * For public endpoints that act on behalf of one company — the support portal and embedded
 * contact forms pass `?workspace=<slug>` (or an `x-canopy-workspace` header). Without one, the
 * request keeps the company the tenant middleware chose (the signed-in person's, else home).
 */
export async function useWorkspaceFromRequest(event: Parameters<typeof getQuery>[0]) {
  const query = getQuery(event)
  const raw = (typeof query.workspace === 'string' ? query.workspace : undefined) ?? getHeader(event, 'x-canopy-workspace')
  if (!raw)
    return null
  const org = await getOrganizationBySlug(raw)
  if (!org || org.status !== 'active')
    throw createError({ statusCode: 404, statusMessage: 'This workspace was not found' })
  setRequestOrg(event, org.id)
  return org
}

// ── Audit log ──────────────────────────────────────────────────────────────

export async function recordAudit(entry: { actorId?: string, actorName?: string, orgId?: string, action: string, detail?: string }) {
  await ensureControlDb()
  await useControlDb().prepare(`
    INSERT INTO cp_audit_log (id, at, actor_id, actor_name, org_id, action, detail) VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(randomBytes(8).toString('hex'), new Date().toISOString(), entry.actorId ?? null, entry.actorName ?? null, entry.orgId ?? null, entry.action, entry.detail ?? null)
}

export async function listAudit(orgId?: string, limit = 100) {
  await ensureControlDb()
  const db = useControlDb()
  const rows = orgId
    ? await db.prepare('SELECT * FROM cp_audit_log WHERE org_id = ? ORDER BY at DESC LIMIT ?').all(orgId, limit)
    : await db.prepare('SELECT * FROM cp_audit_log ORDER BY at DESC LIMIT ?').all(limit)
  return (rows as { id: string, at: string, actor_id: string | null, actor_name: string | null, org_id: string | null, action: string, detail: string | null }[])
    .map(row => ({ id: row.id, at: row.at, actorId: row.actor_id ?? undefined, actorName: row.actor_name ?? undefined, orgId: row.org_id ?? undefined, action: row.action, detail: row.detail ?? undefined }))
}

// ── Provisioning ───────────────────────────────────────────────────────────

export interface ProvisionInput {
  slug: string
  name: string
  sector?: string
  country?: string
  size?: string
  plan?: Organization['plan']
  apps: OrgApp[]
  source: 'self_serve' | 'staff'
  slaTier?: Organization['slaTier']
  /** The company's first administrator. With a passwordHash they're active straight away; without, they get an invite link. */
  admin: { name: string, email: string, passwordHash?: string }
}

export interface ProvisionResult {
  org: Organization
  adminStaffId: string
  /** Set when the admin was invited rather than created with a password. */
  adminInviteToken?: string
}

/**
 * Creates a company: registry row → its own Postgres database → migrations → its first admin →
 * directory entry. Anything that fails part-way is rolled back (database dropped, rows removed).
 */
export async function provisionOrganization(input: ProvisionInput): Promise<ProvisionResult> {
  await ensureControlDb()
  const control = useControlDb()

  const slugCheck = await checkSlugAvailable(input.slug)
  if (!slugCheck.available)
    throw createError({ statusCode: 409, statusMessage: slugCheck.reason ?? 'That workspace address is not available' })
  const orgId = slugCheck.slug
  assertSafeOrgId(orgId)

  const adminEmail = input.admin.email.trim().toLowerCase()
  if (await lookupOrgIdByEmail(adminEmail))
    throw createError({ statusCode: 409, statusMessage: 'This email already belongs to a Canopy workspace. Sign in instead.' })

  const apps = input.apps.filter(app => ORG_APPS.some(a => a.id === app))
  const now = new Date().toISOString()
  await control.prepare(`
    INSERT INTO cp_organizations (id, slug, name, sector, country, size, plan, apps, status, source, sla_tier, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'provisioning', ?, ?, ?, ?)
  `).run(orgId, orgId, input.name.trim(), input.sector ?? null, input.country ?? null, input.size ?? null, input.plan ?? 'professional', JSON.stringify(apps.length ? apps : ['service', 'sales']), input.source, input.slaTier ?? null, now, now)

  let databaseCreated = false
  try {
    await control.exec(`CREATE DATABASE ${tenantDatabaseName(orgId)}`)
    databaseCreated = true

    const result = await runWithTenant(orgId, async () => {
      await ensureDb()
      await seedWorkspaceDefaults()
      const db = useTenantDb()
      const staffId = await nextStaffId()
      const roles = JSON.stringify(['admin'])
      if (input.admin.passwordHash) {
        await db.prepare(`
          INSERT INTO staff (id, name, email, role, roles, status, on_call, password_hash, password_changed_at, created_at)
          VALUES (?, ?, ?, 'admin', ?, 'active', 0, ?, ?, ?)
        `).run(staffId, input.admin.name.trim(), adminEmail, roles, input.admin.passwordHash, now, now)
        return { staffId }
      }
      const inviteToken = newOrgToken(orgId)
      const inviteExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
      await db.prepare(`
        INSERT INTO staff (id, name, email, role, roles, status, on_call, password_hash, invite_token, invite_expires_at, created_at)
        VALUES (?, ?, ?, 'admin', ?, 'pending', 0, NULL, ?, ?, ?)
      `).run(staffId, input.admin.name.trim(), adminEmail, roles, inviteToken, inviteExpiresAt, now)
      return { staffId, inviteToken }
    })

    await registerDirectoryEmail(adminEmail, orgId)
    await control.prepare(`UPDATE cp_organizations SET status = 'active', updated_at = ? WHERE id = ?`).run(new Date().toISOString(), orgId)
    orgCache.delete(orgId)

    return { org: (await getOrganization(orgId, { fresh: true }))!, adminStaffId: result.staffId, adminInviteToken: result.inviteToken }
  }
  catch (error) {
    console.error(`[provision] ${orgId} failed — rolling back`, error)
    if (databaseCreated)
      await control.exec(`DROP DATABASE IF EXISTS ${tenantDatabaseName(orgId)} WITH (FORCE)`).catch(() => {})
    await control.prepare('DELETE FROM cp_directory WHERE org_id = ?').run(orgId).catch(() => {})
    await control.prepare('DELETE FROM cp_organizations WHERE id = ?').run(orgId).catch(() => {})
    forgetTenantConnection(orgId)
    orgCache.delete(orgId)
    throw error
  }
}

/**
 * Permanently deletes a company: its database, directory entries and registry row. Not exposed
 * in the UI (suspend is); used for clean-up and tests. The home organisation can't be deleted.
 */
export async function deleteOrganization(orgId: string) {
  if (orgId === HOME_ORG_ID)
    throw createError({ statusCode: 400, statusMessage: 'The home workspace cannot be deleted' })
  assertSafeOrgId(orgId)
  const control = useControlDb()
  forgetTenantConnection(orgId)
  await control.exec(`DROP DATABASE IF EXISTS ${tenantDatabaseName(orgId)} WITH (FORCE)`)
  await control.prepare('DELETE FROM cp_directory WHERE org_id = ?').run(orgId)
  await control.prepare('DELETE FROM cp_organizations WHERE id = ?').run(orgId)
  orgCache.delete(orgId)
}
