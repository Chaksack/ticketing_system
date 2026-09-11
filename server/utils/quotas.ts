import type { BdQuota, BdQuotaProgress } from '../../app/types/quota'
import type { StaffRow } from './mappers'
import { parseStaffRoles } from './mappers'

export interface BdQuotaRow {
  id: string
  staff_id: string
  staff_name?: string
  period: string
  target_value: number | string
  created_at: string
  updated_at: string
}

export function mapBdQuotaRow(row: BdQuotaRow): BdQuota {
  return {
    id: row.id,
    staffId: row.staff_id,
    staffName: row.staff_name ?? undefined,
    period: row.period,
    targetValue: Number(row.target_value),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function monthRange(period: string): { start: string, end: string } {
  const [year, month] = period.split('-').map(Number)
  const start = new Date(Date.UTC(year!, month! - 1, 1))
  const end = new Date(Date.UTC(year!, month!, 1))
  return { start: start.toISOString(), end: end.toISOString() }
}

async function getWonValueByStaff(period: string): Promise<Map<string, number>> {
  const db = useDatabase()
  const { start, end } = monthRange(period)

  const leadRows = await db.prepare(`
    SELECT lead_assignees.staff_id AS staff_id, SUM(leads.estimated_value) AS total
    FROM lead_activity
    JOIN leads ON leads.id = lead_activity.lead_id
    JOIN lead_assignees ON lead_assignees.lead_id = leads.id
    WHERE lead_activity.type = 'stage_changed' AND lead_activity.to_value = 'Won'
      AND lead_activity.created_at >= ? AND lead_activity.created_at < ?
    GROUP BY lead_assignees.staff_id
  `).all(start, end) as { staff_id: string, total: number | string }[]

  const tenderRows = await db.prepare(`
    SELECT tender_assignees.staff_id AS staff_id, SUM(tenders.estimated_value) AS total
    FROM tender_activity
    JOIN tenders ON tenders.id = tender_activity.tender_id
    JOIN tender_assignees ON tender_assignees.tender_id = tenders.id
    WHERE tender_activity.type = 'stage_changed' AND tender_activity.to_value = 'Won'
      AND tender_activity.created_at >= ? AND tender_activity.created_at < ?
    GROUP BY tender_assignees.staff_id
  `).all(start, end) as { staff_id: string, total: number | string }[]

  const totals = new Map<string, number>()
  for (const row of [...leadRows, ...tenderRows])
    totals.set(row.staff_id, (totals.get(row.staff_id) ?? 0) + Number(row.total))

  return totals
}

export async function getQuotaProgress(period: string): Promise<BdQuotaProgress[]> {
  const db = useDatabase()

  const staffRows = await db.prepare('SELECT * FROM staff WHERE status = \'active\'').all() as StaffRow[]
  const bdStaff = staffRows.filter(row => parseStaffRoles(row).some(role => role === 'bd' || role === 'sm'))

  const quotaRows = await db.prepare('SELECT * FROM bd_quotas WHERE period = ?').all(period) as BdQuotaRow[]
  const quotaByStaff = new Map(quotaRows.map(row => [row.staff_id, Number(row.target_value)]))

  const achievedByStaff = await getWonValueByStaff(period)

  return bdStaff.map((staff) => {
    const targetValue = quotaByStaff.get(staff.id) ?? null
    const achievedValue = achievedByStaff.get(staff.id) ?? 0
    return {
      staffId: staff.id,
      staffName: staff.name,
      targetValue,
      achievedValue,
      percent: targetValue ? Math.round((achievedValue / targetValue) * 100) : null,
    }
  })
}
