import type { Lead, LeadActivityType } from '../../app/types/lead'
import type { LeadActivityRow, LeadContactEmailRow, LeadContactPhoneRow, LeadRow } from './mappers'

const LEAD_SELECT = 'SELECT * FROM leads WHERE id = ?'

export async function loadFullLead(id: string): Promise<Lead> {
  const db = useDatabase()

  const row = await db.prepare(LEAD_SELECT).get(id) as LeadRow | undefined
  if (!row) {
    throw createError({ statusCode: 404, statusMessage: 'Lead not found' })
  }

  const activityRows = await db.prepare('SELECT * FROM lead_activity WHERE lead_id = ? ORDER BY created_at ASC').all(id) as LeadActivityRow[]
  const assignees = await getLeadAssignees(id)
  const emailRows = await db.prepare('SELECT * FROM lead_contact_emails WHERE lead_id = ? ORDER BY created_at ASC').all(id) as LeadContactEmailRow[]
  const phoneRows = await db.prepare('SELECT * FROM lead_contact_phones WHERE lead_id = ? ORDER BY created_at ASC').all(id) as LeadContactPhoneRow[]

  return mapLeadRow(
    row,
    activityRows.map(activityRow => mapLeadActivityRow(activityRow)),
    assignees,
    emailRows.map(emailRow => mapLeadContactEmailRow(emailRow)),
    phoneRows.map(phoneRow => mapLeadContactPhoneRow(phoneRow)),
  )
}

export async function logLeadActivity(options: {
  leadId: string
  type: LeadActivityType
  actorId?: string
  actorName?: string
  fromValue?: string
  toValue?: string
  message?: string
}) {
  const db = useDatabase()
  const id = await nextLeadActivityId()
  const now = new Date().toISOString()

  await db.prepare(`
    INSERT INTO lead_activity (id, lead_id, type, actor_id, actor_name, from_value, to_value, message, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, options.leadId, options.type, options.actorId ?? null, options.actorName ?? null, options.fromValue ?? null, options.toValue ?? null, options.message ?? null, now)
}
