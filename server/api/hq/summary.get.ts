import type { Organization } from '../../../app/types/organization'

interface ClientHealth {
  orgId: string
  name: string
  slug: string
  status: Organization['status']
  plan: string
  openTickets: number | null
  breachedTickets: number | null
  waitingChats: number | null
  care: string | null
}

/**
 * Canopy HQ home: the whole platform at a glance. HQ admins see every client
 * company, onboarding and SLA health; Care agents see the Care queues they're assigned to.
 */
export default defineEventHandler(async (event) => {
  const user = await requireCareStaff(event)
  const isPlatform = user.hqRole === 'admin'

  await ensureCareTables()
  const engagements = await listEngagements()
  const mine = engagements.filter(e => (e.stage === 'pilot' || e.stage === 'live') && (isPlatform || e.agentIds.includes(user.id)))
  const engagementByOrg = new Map(engagements.map(e => [e.orgId, e]))

  const orgs = isPlatform ? (await listOrganizations()).filter(org => !org.isHome) : []
  const now = new Date().toISOString()
  const readHealth = async (org: Organization): Promise<ClientHealth> => {
    const base = { orgId: org.id, name: org.name, slug: org.slug, status: org.status, plan: org.plan, care: engagementByOrg.get(org.id)?.stage ?? null }
    if (org.status !== 'active')
      return { ...base, openTickets: null, breachedTickets: null, waitingChats: null }
    try {
      return await runWithTenant(org.id, async () => {
        await ensureDb()
        const db = useTenantDb()
        const tickets = await db.prepare(`SELECT COUNT(*) AS open, COUNT(*) FILTER (WHERE due_at < ?) AS breached FROM tickets WHERE status IN ('open', 'in-progress')`).get(now) as { open: string | number, breached: string | number }
        const chats = await db.prepare(`SELECT COUNT(*) AS count FROM live_chats WHERE status = 'waiting'`).get() as { count: string | number }
        return { ...base, openTickets: Number(tickets.open), breachedTickets: Number(tickets.breached), waitingChats: Number(chats.count) }
      })
    }
    catch (error) {
      console.error(`[hq] could not read ${org.id}`, error)
      return { ...base, openTickets: null, breachedTickets: null, waitingChats: null }
    }
  }
  const health = await Promise.all(orgs.map(readHealth))

  // Care queues for the engagements this person works on.
  let careWaiting = 0
  for (const engagement of mine) {
    const known = health.find(h => h.orgId === engagement.orgId)
    if (known?.waitingChats != null) {
      careWaiting += known.waitingChats
      continue
    }
    const org = await getOrganization(engagement.orgId)
    if (org)
      careWaiting += (await readHealth(org)).waitingChats ?? 0
  }

  const onboardings = isPlatform ? await listOnboardings() : []
  const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString()

  return {
    isPlatform,
    clients: isPlatform
      ? {
          total: orgs.length,
          active: orgs.filter(o => o.status === 'active').length,
          suspended: orgs.filter(o => o.status === 'suspended').length,
          newThisWeek: orgs.filter(o => o.createdAt >= weekAgo).length,
        }
      : null,
    health: health.sort((a, b) => (b.breachedTickets ?? 0) - (a.breachedTickets ?? 0) || (b.openTickets ?? 0) - (a.openTickets ?? 0)),
    onboarding: onboardings.filter(o => o.status !== 'provisioned').map(o => ({ id: o.id, clientName: o.clientName, status: o.status, plan: o.plan, ownerName: o.ownerName, updatedAt: o.updatedAt })),
    care: {
      engagements: engagements.length,
      live: engagements.filter(e => e.stage === 'live').length,
      inSetup: engagements.filter(e => ['scope', 'agreement', 'transition', 'pilot'].includes(e.stage)).length,
      myClients: mine.length,
      waiting: careWaiting,
    },
    recentAudit: isPlatform ? await listAudit(undefined, 8) : [],
  }
})
