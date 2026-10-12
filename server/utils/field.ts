import type { FieldAsset, Technician, TechnicianUnavailability, WorkOrder, WorkOrderStatus } from '../../app/types/field'
import type { TicketPriority } from '../../app/types/ticket'

export const TECHNICIAN_ROLES = ['engineer', 'engineering_coordinator', 'engineering_lead']
const DISPATCHER_ROLES = ['admin', 'agent', 'engineering_coordinator', 'engineering_lead']

/** Anyone who works with field service: dispatchers and technicians. */
export async function requireFieldStaff(event: Parameters<typeof requireSessionUser>[0]) {
  const user = await requireSessionUser(event)
  if (!user.roles.some(role => DISPATCHER_ROLES.includes(role) || TECHNICIAN_ROLES.includes(role)))
    throw createError({ statusCode: 403, statusMessage: 'Forbidden' })
  return user
}

export function isDispatcher(user: { roles: string[] }) {
  return user.roles.some(role => DISPATCHER_ROLES.includes(role))
}

export async function requireDispatcher(event: Parameters<typeof requireSessionUser>[0]) {
  const user = await requireFieldStaff(event)
  if (!isDispatcher(user))
    throw createError({ statusCode: 403, statusMessage: 'Only dispatchers (coordinators, leads, service desk and admins) can do that' })
  return user
}

export interface WorkOrderRow {
  id: string
  title: string
  description: string | null
  client_id: string | null
  client_name?: string | null
  ticket_id: string | null
  asset_id: string | null
  asset_name?: string | null
  location: string | null
  priority: TicketPriority
  skill: string | null
  duration_minutes: number | string
  sla_due_at: string | null
  status: WorkOrderStatus
  technician_id: string | null
  technician_name?: string | null
  scheduled_start: string | null
  tasks: string
  photos: string
  signature_url: string | null
  signed_by: string | null
  resolution_notes: string | null
  travel_started_at: string | null
  started_at: string | null
  completed_at: string | null
  created_at: string
  updated_at: string
}

export const WORK_ORDER_SELECT = `
  SELECT work_orders.*, clients.name AS client_name, field_assets.name AS asset_name, technician.name AS technician_name
  FROM work_orders
  LEFT JOIN clients ON clients.id = work_orders.client_id
  LEFT JOIN field_assets ON field_assets.id = work_orders.asset_id
  LEFT JOIN staff technician ON technician.id = work_orders.technician_id
`

function parseJson<T>(value: string | null, fallback: T): T {
  try {
    return value ? JSON.parse(value) as T : fallback
  }
  catch {
    return fallback
  }
}

export function mapWorkOrderRow(row: WorkOrderRow): WorkOrder {
  return {
    id: row.id,
    title: row.title,
    description: row.description ?? undefined,
    clientId: row.client_id ?? undefined,
    clientName: row.client_name ?? undefined,
    ticketId: row.ticket_id ?? undefined,
    assetId: row.asset_id ?? undefined,
    assetName: row.asset_name ?? undefined,
    location: row.location ?? undefined,
    priority: row.priority,
    skill: row.skill ?? undefined,
    durationMinutes: Number(row.duration_minutes),
    slaDueAt: row.sla_due_at ?? undefined,
    status: row.status,
    technicianId: row.technician_id ?? undefined,
    technicianName: row.technician_name ?? undefined,
    scheduledStart: row.scheduled_start ?? undefined,
    tasks: parseJson(row.tasks, []),
    photos: parseJson(row.photos, []),
    signatureUrl: row.signature_url ?? undefined,
    signedBy: row.signed_by ?? undefined,
    resolutionNotes: row.resolution_notes ?? undefined,
    travelStartedAt: row.travel_started_at ?? undefined,
    startedAt: row.started_at ?? undefined,
    completedAt: row.completed_at ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export async function loadWorkOrder(id: string) {
  const row = await useTenantDb().prepare(`${WORK_ORDER_SELECT} WHERE work_orders.id = ?`).get(id) as WorkOrderRow | undefined
  return row ? mapWorkOrderRow(row) : null
}

export async function listTechnicians(): Promise<Technician[]> {
  const rows = await useTenantDb().prepare('SELECT id, name, role, roles, avatar_url, skills FROM staff WHERE status = \'active\' ORDER BY name').all() as { id: string, name: string, role: string, roles: string | null, avatar_url: string | null, skills: string | null }[]
  return rows
    .filter(row => parseStaffRoles(row).some(role => TECHNICIAN_ROLES.includes(role)))
    .map(row => ({ id: row.id, name: row.name, avatarUrl: row.avatar_url ?? undefined, skills: (row.skills ?? '').split(',').map(s => s.trim()).filter(Boolean) }))
}

export async function listUnavailability(from: string, to: string): Promise<TechnicianUnavailability[]> {
  const rows = await useTenantDb().prepare('SELECT * FROM technician_unavailability WHERE end_at > ? AND start_at < ? ORDER BY start_at').all(from, to) as { id: string, technician_id: string, start_at: string, end_at: string, reason: string | null }[]
  return rows.map(row => ({ id: row.id, technicianId: row.technician_id, startAt: row.start_at, endAt: row.end_at, reason: row.reason ?? undefined }))
}

export interface AssetRow {
  id: string
  client_id: string | null
  client_name: string | null
  name: string
  model: string | null
  serial: string | null
  location: string | null
  installed_at: string | null
  notes: string | null
  work_order_count: number | string
  last_serviced_at: string | null
  created_at: string
}

export const ASSET_SELECT = `
  SELECT field_assets.*, clients.name AS client_name,
    (SELECT COUNT(*) FROM work_orders w WHERE w.asset_id = field_assets.id) AS work_order_count,
    (SELECT MAX(completed_at) FROM work_orders w WHERE w.asset_id = field_assets.id) AS last_serviced_at
  FROM field_assets
  LEFT JOIN clients ON clients.id = field_assets.client_id
`

export function mapAssetRow(row: AssetRow): FieldAsset {
  return {
    id: row.id,
    clientId: row.client_id ?? undefined,
    clientName: row.client_name ?? undefined,
    name: row.name,
    model: row.model ?? undefined,
    serial: row.serial ?? undefined,
    location: row.location ?? undefined,
    installedAt: row.installed_at ?? undefined,
    notes: row.notes ?? undefined,
    workOrderCount: Number(row.work_order_count),
    lastServicedAt: row.last_serviced_at ?? undefined,
    createdAt: row.created_at,
  }
}

/** Do two [start, start + minutes) ranges overlap? */
export function overlaps(aStart: number, aMinutes: number, bStart: number, bMinutes: number) {
  return aStart < bStart + bMinutes * 60000 && bStart < aStart + aMinutes * 60000
}
