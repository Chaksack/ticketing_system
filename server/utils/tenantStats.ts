import type { Organization, TenantSummary } from '../../app/types/organization'

/** Live counts read from a company's own database (null if it can't be reached). */
export async function tenantStats(org: Organization): Promise<Pick<TenantSummary, 'staffCount' | 'openTicketCount'>> {
  try {
    return await runWithTenant(org.id, async () => {
      await ensureDb()
      const db = useTenantDb()
      const staff = await db.prepare(`SELECT COUNT(*) AS count FROM staff WHERE status != 'disabled'`).get() as { count: number | string }
      const tickets = await db.prepare(`SELECT COUNT(*) AS count FROM tickets WHERE status NOT IN ('resolved', 'closed')`).get() as { count: number | string }
      return { staffCount: Number(staff.count), openTicketCount: Number(tickets.count) }
    })
  }
  catch (error) {
    console.error(`[console] Could not read stats for ${org.id}`, error)
    return { staffCount: null, openTicketCount: null }
  }
}
