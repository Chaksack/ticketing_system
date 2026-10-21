import type { StaffRow } from '../../../utils/mappers'

/** Canopy's own people with their HQ access, and the Care clients each one answers for. */
export default defineEventHandler(async (event) => {
  await requirePlatformStaff(event)
  await ensureDb()
  await ensureCareTables()

  const rows = await useTenantDb().prepare('SELECT * FROM staff ORDER BY created_at DESC').all() as StaffRow[]
  const engagements = (await listEngagements()).filter(e => e.stage !== 'ended')

  return {
    staff: rows.map(mapStaffRow),
    engagements: engagements.map(e => ({ id: e.id, orgName: e.orgName, stage: e.stage, agentIds: e.agentIds })),
  }
})
