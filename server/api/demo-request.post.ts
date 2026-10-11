import { DEMO_SECTORS } from '../../app/types/organization'

const REQUESTS_PER_IP_PER_HOUR = 5
const HOUR_MS = 60 * 60 * 1000

// Personal mailboxes say nothing about the company, so the lead is named after the address instead.
const PERSONAL_DOMAINS = new Set(['gmail.com', 'googlemail.com', 'yahoo.com', 'outlook.com', 'hotmail.com', 'live.com', 'icloud.com', 'aol.com', 'proton.me', 'protonmail.com'])

function leadNameFor(email: string) {
  const domain = email.split('@')[1]!
  if (PERSONAL_DOMAINS.has(domain))
    return email
  const company = domain.split('.')[0]!
  return `${company[0]!.toUpperCase()}${company.slice(1)} (${domain})`
}

/**
 * "Book a demo" on the public website. Files the request as a lead in Canopy's own workspace
 * (never a customer's), so the sales team picks it up in their normal pipeline. A repeat request
 * from the same company is logged on the existing lead rather than creating a duplicate.
 */
export default defineEventHandler(async (event) => {
  const body = await readBody<{ email?: string, sector?: string, website?: string }>(event)

  // Honeypot: the field is hidden from people, so anything in it came from a bot. Look successful.
  if (body?.website)
    return { ok: true }

  const email = body?.email?.trim().toLowerCase()
  if (!email || !/^[^\s@]+@[^\s@][^\s.@]*\.[^\s@]+$/.test(email))
    throw createError({ statusCode: 400, statusMessage: 'Enter a valid work email' })
  const sector = DEMO_SECTORS.find(s => s === body?.sector) ?? 'Other'

  return runWithTenant(HOME_ORG_ID, async () => {
    await ensureDb()
    const ip = getRequestIP(event, { xForwardedFor: true }) ?? 'unknown'
    const limit = await checkRateLimit('demo-request-ip', ip, REQUESTS_PER_IP_PER_HOUR, HOUR_MS)
    if (!limit.allowed)
      throw createError({ statusCode: 429, statusMessage: 'Too many requests. Please try again later.' })

    const name = leadNameFor(email)
    const note = `Requested a demo from the website (sector: ${sector}, contact: ${email}).`

    const existingByEmail = (await findDuplicates('leads', { email })).find(match => match.entity === 'leads')
    const existingId = existingByEmail?.id ?? (await findSameNameRecord('leads', name))?.id
    if (existingId) {
      await logLeadActivity({ leadId: existingId, type: 'note_updated', actorName: 'Website', message: note })
      return { ok: true }
    }

    const db = useTenantDb()
    const id = await nextLeadId()
    const now = new Date().toISOString()
    await db.prepare(`
      INSERT INTO leads (id, name, contact_email, source, stage, notes, next_step, next_step_reminder_sent, created_at, updated_at)
      VALUES (?, ?, ?, ?, 'new', ?, ?, 0, ?, ?)
    `).run(id, name, email, 'Website demo request', note, 'Reply to book the demo', now, now)

    let lead = await loadFullLead(id)
    lead = await applyBdCreationRules('lead', lead)
    if (!lead.assignees.length)
      await autoAssignLead(lead)

    setResponseStatus(event, 201)
    return { ok: true }
  })
})
