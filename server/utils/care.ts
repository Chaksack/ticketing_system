import type { CareEngagement, CareEvaluation, CareShift } from '../../app/types/care'
import { randomBytes } from 'node:crypto'
import { DEFAULT_CARE_CHECKLIST, DEFAULT_SCORECARD } from '../../app/types/care'

let careReady: Promise<void> | null = null

/** Canopy Care's control-plane tables (main database), created once per process. */
export function ensureCareTables() {
  careReady ??= (async () => {
    await ensureControlDb()
    const db = useControlDb()
    await db.exec(`
      CREATE TABLE IF NOT EXISTS cp_care_engagements (
        id TEXT PRIMARY KEY,
        org_id TEXT NOT NULL UNIQUE,
        stage TEXT NOT NULL DEFAULT 'scope',
        model TEXT NOT NULL DEFAULT 'dedicated',
        details TEXT NOT NULL,
        agent_ids TEXT NOT NULL DEFAULT '[]',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )
    `)
    await db.exec(`
      CREATE TABLE IF NOT EXISTS cp_care_evaluations (
        id TEXT PRIMARY KEY,
        engagement_id TEXT NOT NULL,
        org_id TEXT NOT NULL,
        ref_type TEXT NOT NULL,
        ref_id TEXT NOT NULL,
        ref_title TEXT NOT NULL,
        agent_id TEXT,
        agent_name TEXT,
        evaluator_id TEXT,
        evaluator_name TEXT NOT NULL,
        scores TEXT NOT NULL,
        score INTEGER NOT NULL,
        note TEXT,
        shared INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL
      )
    `)
    await db.exec('CREATE INDEX IF NOT EXISTS idx_cp_care_evaluations_org ON cp_care_evaluations (org_id, created_at)')
    await db.exec(`
      CREATE TABLE IF NOT EXISTS cp_care_shifts (
        id TEXT PRIMARY KEY,
        staff_id TEXT NOT NULL,
        staff_name TEXT NOT NULL,
        date TEXT NOT NULL,
        start_hour INTEGER NOT NULL,
        end_hour INTEGER NOT NULL,
        created_at TEXT NOT NULL
      )
    `)
    await db.exec('CREATE INDEX IF NOT EXISTS idx_cp_care_shifts_date ON cp_care_shifts (date)')
  })().catch((error) => {
    careReady = null
    throw error
  })
  return careReady
}

export const careId = () => randomBytes(8).toString('hex')

interface EngagementRow { id: string, org_id: string, stage: CareEngagement['stage'], model: CareEngagement['model'], details: string, agent_ids: string, created_at: string, updated_at: string }

type EngagementDetails = Omit<CareEngagement, 'id' | 'orgId' | 'orgName' | 'orgSlug' | 'stage' | 'model' | 'agentIds' | 'createdAt' | 'updatedAt'>

export function defaultEngagementDetails(orgName: string): EngagementDetails {
  return {
    channels: ['Web chat', 'Email'],
    reasons: [{ label: 'General questions', inScope: true }, { label: 'Account & access', inScope: true }, { label: 'Billing', inScope: true }],
    hours: 'Mon–Sat 07:00–21:00',
    languages: 'English',
    monthlyContacts: 1000,
    ahtMinutes: 6,
    greeting: `Hello, thank you for contacting ${orgName}. How can I help?`,
    slaText: 'Reply to chats within 2 minutes',
    replyTargetSeconds: 120,
    dos: '',
    donts: '',
    checklist: DEFAULT_CARE_CHECKLIST.map(label => ({ label, done: false })),
    scorecard: DEFAULT_SCORECARD,
    recommendations: [],
  }
}

async function mapEngagement(row: EngagementRow): Promise<CareEngagement> {
  const org = await getOrganization(row.org_id)
  return {
    ...defaultEngagementDetails(org?.name ?? row.org_id),
    ...JSON.parse(row.details) as EngagementDetails,
    id: row.id,
    orgId: row.org_id,
    orgName: org?.name,
    orgSlug: org?.slug,
    stage: row.stage,
    model: row.model,
    agentIds: JSON.parse(row.agent_ids),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export async function listEngagements(): Promise<CareEngagement[]> {
  await ensureCareTables()
  const rows = await useControlDb().prepare('SELECT * FROM cp_care_engagements ORDER BY updated_at DESC').all() as EngagementRow[]
  return Promise.all(rows.map(mapEngagement))
}

export async function loadEngagement(id: string) {
  await ensureCareTables()
  const row = await useControlDb().prepare('SELECT * FROM cp_care_engagements WHERE id = ?').get(id) as EngagementRow | undefined
  return row ? mapEngagement(row) : null
}

export async function engagementForOrg(orgId: string) {
  await ensureCareTables()
  const row = await useControlDb().prepare('SELECT * FROM cp_care_engagements WHERE org_id = ?').get(orgId) as EngagementRow | undefined
  return row ? mapEngagement(row) : null
}

export async function saveEngagement(engagement: CareEngagement) {
  const { id, orgId, stage, model, agentIds, orgName: _n, orgSlug: _s, createdAt: _c, updatedAt: _u, ...details } = engagement
  await useControlDb().prepare('UPDATE cp_care_engagements SET stage = ?, model = ?, details = ?, agent_ids = ?, updated_at = ? WHERE id = ?').run(stage, model, JSON.stringify(details), JSON.stringify(agentIds), new Date().toISOString(), id)
  void orgId
  return loadEngagement(id)
}

/** Engagements Care agents work on now: pilot and live. */
export async function runningEngagements() {
  return (await listEngagements()).filter(e => e.stage === 'pilot' || e.stage === 'live')
}

/** Canopy staff who may use the Care screens: admins of Canopy's own workspace, or assigned Care agents. */
export async function requireCareStaff(event: Parameters<typeof requireSessionUser>[0]) {
  const user = await requireSessionUser(event)
  if (currentOrgId() !== HOME_ORG_ID)
    throw createError({ statusCode: 403, statusMessage: 'Forbidden' })
  if (user.roles.includes('admin'))
    return user
  const assigned = (await listEngagements()).some(e => e.agentIds.includes(user.id))
  if (!assigned)
    throw createError({ statusCode: 403, statusMessage: 'You are not assigned to any Canopy Care client' })
  return user
}

export function mapEvaluationRow(row: Record<string, any>): CareEvaluation {
  return {
    id: row.id,
    engagementId: row.engagement_id,
    orgId: row.org_id,
    refType: row.ref_type,
    refId: row.ref_id,
    refTitle: row.ref_title,
    agentId: row.agent_id ?? undefined,
    agentName: row.agent_name ?? undefined,
    evaluatorName: row.evaluator_name,
    scores: JSON.parse(row.scores),
    score: Number(row.score),
    note: row.note ?? undefined,
    shared: Number(row.shared) === 1,
    createdAt: row.created_at,
  }
}

export function mapShiftRow(row: Record<string, any>): CareShift {
  return { id: row.id, staffId: row.staff_id, staffName: row.staff_name, date: row.date, startHour: Number(row.start_hour), endHour: Number(row.end_hour) }
}

/** The author line Care agents reply under, so the client can always see who answered. */
export const careAuthorName = (name: string) => `${name} · Canopy Care`
