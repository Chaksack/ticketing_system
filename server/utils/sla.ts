import type { SlaPolicy } from '../../app/types/automation'
import type { TicketPriority } from '../../app/types/ticket'

export { getSlaStatus } from '../../app/lib/sla'

export interface SlaPolicyRow {
  id: string
  priority: string
  first_response_mins: number
  resolution_mins: number
  created_at: string
}

export function mapSlaPolicyRow(row: SlaPolicyRow): SlaPolicy {
  return {
    id: row.id,
    priority: row.priority as TicketPriority,
    firstResponseMins: row.first_response_mins,
    resolutionMins: row.resolution_mins,
  }
}

export async function getSlaPolicy(priority: TicketPriority): Promise<SlaPolicy | undefined> {
  const db = useTenantDb()
  const row = await db.prepare('SELECT * FROM sla_policies WHERE priority = ?').get(priority) as SlaPolicyRow | undefined
  return row ? mapSlaPolicyRow(row) : undefined
}

type SlaTargets = Partial<Record<TicketPriority, { firstResponseMins: number, resolutionMins: number }>>

/**
 * Deadlines for a ticket. When it's covered by an AMC contract whose plan sets targets for this
 * priority, those win; otherwise the company's SLA policy for the priority applies.
 */
export async function computeSlaDeadlines(priority: TicketPriority, createdAt: string, contractId?: string | null) {
  let targets: { firstResponseMins: number, resolutionMins: number } | undefined
  if (contractId) {
    const row = await useTenantDb().prepare(`
      SELECT amc_plans.sla_targets FROM client_amc_contracts JOIN amc_plans ON amc_plans.id = client_amc_contracts.plan_id
      WHERE client_amc_contracts.id = ?
    `).get(contractId) as { sla_targets: string | null } | undefined
    targets = row?.sla_targets ? (JSON.parse(row.sla_targets) as SlaTargets)[priority] : undefined
  }
  const policy = targets ?? await getSlaPolicy(priority)
  if (!policy)
    return { dueAt: undefined, firstResponseDueAt: undefined }

  const created = new Date(createdAt).getTime()
  return {
    dueAt: new Date(created + policy.resolutionMins * 60_000).toISOString(),
    firstResponseDueAt: new Date(created + policy.firstResponseMins * 60_000).toISOString(),
  }
}

/** The contract that covers a project today (active and in date), if any. */
export async function activeContractForProject(projectId: string) {
  const today = new Date().toISOString().slice(0, 10)
  const row = await useTenantDb().prepare(`
    SELECT id FROM client_amc_contracts
    WHERE project_id = ? AND status = 'active' AND start_date <= ? AND end_date >= ?
    ORDER BY end_date DESC LIMIT 1
  `).get(projectId, today, today) as { id: string } | undefined
  return row?.id ?? null
}

/**
 * Works out who a ticket is for. The client comes from the request (staff picked one) or from the
 * requester's email; the project likewise, or — when the client has exactly one project under an
 * active contract — that project. The contract is the project's active one.
 */
export async function resolveTicketCustomer(options: { email: string, clientId?: string | null, projectId?: string | null }) {
  const db = useTenantDb()
  let clientId = options.clientId || null
  let projectId = options.projectId || null

  if (projectId) {
    const project = await db.prepare('SELECT client_id FROM projects WHERE id = ?').get(projectId) as { client_id: string } | undefined
    if (!project)
      throw createError({ statusCode: 400, statusMessage: 'That project doesn\'t exist' })
    if (clientId && project.client_id !== clientId)
      throw createError({ statusCode: 400, statusMessage: 'That project belongs to a different client' })
    clientId = project.client_id
  }
  if (!clientId && options.email)
    clientId = (await identifyVisitor(options.email))?.clientId ?? null
  if (clientId && !projectId) {
    const today = new Date().toISOString().slice(0, 10)
    const covered = await db.prepare(`
      SELECT DISTINCT project_id FROM client_amc_contracts
      WHERE client_id = ? AND project_id IS NOT NULL AND status = 'active' AND start_date <= ? AND end_date >= ?
    `).all(clientId, today, today) as { project_id: string }[]
    if (covered.length === 1)
      projectId = covered[0]!.project_id
  }
  const contractId = projectId ? await activeContractForProject(projectId) : null
  return { clientId, projectId, contractId }
}
