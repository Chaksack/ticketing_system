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
  const db = useDatabase()
  const row = await db.prepare('SELECT * FROM sla_policies WHERE priority = ?').get(priority) as SlaPolicyRow | undefined
  return row ? mapSlaPolicyRow(row) : undefined
}

export async function computeSlaDeadlines(priority: TicketPriority, createdAt: string) {
  const policy = await getSlaPolicy(priority)
  if (!policy)
    return { dueAt: undefined, firstResponseDueAt: undefined }

  const created = new Date(createdAt).getTime()
  return {
    dueAt: new Date(created + policy.resolutionMins * 60_000).toISOString(),
    firstResponseDueAt: new Date(created + policy.firstResponseMins * 60_000).toISOString(),
  }
}
