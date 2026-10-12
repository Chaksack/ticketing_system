import type { ContactKind, Journey, JourneyStep, Segment, SegmentCondition, SegmentMember, SegmentPreview } from '../../app/types/marketing'
import { randomBytes } from 'node:crypto'
import { renderMarkdown } from '../../app/lib/markdown'

const OPEN_LEAD_STAGES = ['new', 'contacted', 'qualified', 'proposal']

export async function requireMarketing(event: Parameters<typeof requireSessionUser>[0]) {
  const user = await requireSessionUser(event)
  if (!user.roles.some(role => role === 'admin' || role === 'bd' || role === 'sm'))
    throw createError({ statusCode: 403, statusMessage: 'Forbidden' })
  return user
}

/** Everything a segment condition can look at, for one reachable person. */
interface MarketingContact extends SegmentMember {
  leadId?: string
  clientId?: string
  leadStage?: string
  clientStage?: string
  source?: string
  createdAt: string
  estimatedValue?: number
  assigneeIds: string[]
  hasOpenLead: boolean
  lastOpenedAt?: string
}

const normalizeEmail = (email: string) => email.trim().toLowerCase()

/** All leads, clients and client contacts that have an email, one entry per person (by email). */
export async function loadMarketingContacts(): Promise<MarketingContact[]> {
  const db = useTenantDb()
  const leads = await db.prepare('SELECT id, name, contact_name, contact_email, stage, source, estimated_value, created_at, converted_client_id FROM leads WHERE contact_email IS NOT NULL AND contact_email <> \'\'').all() as { id: string, name: string, contact_name: string | null, contact_email: string, stage: string, source: string | null, estimated_value: string | number | null, created_at: string, converted_client_id: string | null }[]
  const leadAssignees = await db.prepare('SELECT lead_id, staff_id FROM lead_assignees').all().catch(() => []) as { lead_id: string, staff_id: string }[]
  const clients = await db.prepare('SELECT id, name, contact_name, contact_email, stage, estimated_value, created_at FROM clients').all() as { id: string, name: string, contact_name: string | null, contact_email: string | null, stage: string, estimated_value: string | number | null, created_at: string }[]
  const clientAssignees = await db.prepare('SELECT client_id, staff_id FROM client_assignees').all().catch(() => []) as { client_id: string, staff_id: string }[]
  const contacts = await db.prepare('SELECT id, client_id, name, email, created_at FROM client_contacts WHERE email IS NOT NULL AND email <> \'\'').all() as { id: string, client_id: string, name: string, email: string, created_at: string }[]
  const opens = await db.prepare('SELECT email, MAX(opened_at) AS last_opened FROM journey_messages WHERE opened_at IS NOT NULL GROUP BY email').all() as { email: string, last_opened: string }[]

  const openedByEmail = new Map(opens.map(o => [normalizeEmail(o.email), o.last_opened]))
  const clientById = new Map(clients.map(c => [c.id, c]))
  const openLeadEmails = new Set(leads.filter(l => OPEN_LEAD_STAGES.includes(l.stage)).map(l => normalizeEmail(l.contact_email)))
  const byLead = new Map<string, string[]>()
  for (const row of leadAssignees)
    byLead.set(row.lead_id, [...(byLead.get(row.lead_id) ?? []), row.staff_id])
  const byClient = new Map<string, string[]>()
  for (const row of clientAssignees)
    byClient.set(row.client_id, [...(byClient.get(row.client_id) ?? []), row.staff_id])

  const result = new Map<string, MarketingContact>()
  const add = (contact: MarketingContact) => {
    const email = normalizeEmail(contact.email)
    // A client record beats a lead record for the same person; the first client entry wins.
    const existing = result.get(email)
    if (!existing || (existing.kind === 'lead' && contact.kind !== 'lead'))
      result.set(email, { ...contact, email, hasOpenLead: openLeadEmails.has(email), lastOpenedAt: openedByEmail.get(email) })
  }

  for (const lead of leads) {
    add({ key: `lead:${lead.id}`, kind: 'lead', name: lead.contact_name || lead.name, email: lead.contact_email, company: lead.name, leadId: lead.id, clientId: lead.converted_client_id ?? undefined, leadStage: lead.stage, source: lead.source ?? undefined, createdAt: lead.created_at, estimatedValue: lead.estimated_value === null ? undefined : Number(lead.estimated_value), assigneeIds: byLead.get(lead.id) ?? [], hasOpenLead: false })
  }
  for (const client of clients) {
    if (client.contact_email)
      add({ key: `client:${client.id}`, kind: 'client', name: client.contact_name || client.name, email: client.contact_email, company: client.name, clientId: client.id, clientStage: client.stage, createdAt: client.created_at, estimatedValue: client.estimated_value === null ? undefined : Number(client.estimated_value), assigneeIds: byClient.get(client.id) ?? [], hasOpenLead: false })
  }
  for (const person of contacts) {
    const client = clientById.get(person.client_id)
    add({ key: `contact:${person.id}`, kind: 'client_contact', name: person.name, email: person.email, company: client?.name, clientId: person.client_id, clientStage: client?.stage, createdAt: person.created_at, assigneeIds: byClient.get(person.client_id) ?? [], hasOpenLead: false })
  }
  return [...result.values()]
}

function matches(contact: MarketingContact, condition: SegmentCondition): boolean {
  const values = condition.values.filter(Boolean)
  const days = Number(values[0])
  const since = (n: number) => new Date(Date.now() - n * 86400000).toISOString()
  switch (condition.field) {
    case 'kind':
      return !values.length || values.includes(contact.kind as string)
    case 'lead_stage':
      return !!contact.leadStage && (!values.length || values.includes(contact.leadStage))
    case 'client_stage':
      return !!contact.clientStage && (!values.length || values.includes(contact.clientStage))
    case 'source':
      return !values[0] || (contact.source ?? '').toLowerCase().includes(values[0].toLowerCase())
    case 'created_within_days':
      return !(days > 0) || contact.createdAt >= since(days)
    case 'estimated_value_at_least':
      return !Number.isFinite(days) || (contact.estimatedValue ?? 0) >= days
    case 'assigned_to':
      return !values.length || contact.assigneeIds.some(id => values.includes(id))
    case 'has_open_lead':
      return contact.hasOpenLead === (values[0] !== 'false')
    case 'opened_email_within_days':
      return !!contact.lastOpenedAt && (!(days > 0) || contact.lastOpenedAt >= since(days))
  }
}

export function contactMatchesSegment(contact: MarketingContact, conditions: SegmentCondition[]) {
  return conditions.every(condition => condition.exclude ? !matches(contact, condition) : matches(contact, condition))
}

export async function suppressedEmails() {
  const rows = await useTenantDb().prepare('SELECT email FROM marketing_suppressions').all() as { email: string }[]
  return new Set(rows.map(r => normalizeEmail(r.email)))
}

export async function segmentMembers(conditions: SegmentCondition[]) {
  return (await loadMarketingContacts()).filter(contact => contactMatchesSegment(contact, conditions))
}

export async function previewSegment(conditions: SegmentCondition[]): Promise<SegmentPreview> {
  const members = await segmentMembers(conditions)
  const suppressed = await suppressedEmails()
  return {
    total: members.length,
    unsubscribed: members.filter(m => suppressed.has(m.email)).length,
    sample: members.slice(0, 6).map(({ key, kind, name, email, company }) => ({ key, kind: kind as ContactKind, name, email, company })),
  }
}

// ── Segments & journeys: rows ──────────────────────────────────────────────

interface SegmentRow { id: string, name: string, description: string | null, conditions: string, created_at: string, updated_at: string }

export function mapSegmentRow(row: SegmentRow): Segment {
  return { id: row.id, name: row.name, description: row.description ?? undefined, conditions: JSON.parse(row.conditions || '[]'), createdAt: row.created_at, updatedAt: row.updated_at }
}

export async function loadSegment(id: string) {
  const row = await useTenantDb().prepare('SELECT * FROM marketing_segments WHERE id = ?').get(id) as SegmentRow | undefined
  return row ? mapSegmentRow(row) : null
}

interface JourneyRow {
  id: string
  name: string
  status: Journey['status']
  trigger_type: Journey['trigger']
  segment_id: string | null
  segment_name?: string | null
  steps: string
  quiet_start: string | null
  quiet_end: string | null
  exit_after_days: number | string | null
  published_at: string | null
  created_at: string
  updated_at: string
}

export async function loadJourneys(id?: string): Promise<Journey[]> {
  const db = useTenantDb()
  const rows = await db.prepare(`
    SELECT marketing_journeys.*, marketing_segments.name AS segment_name FROM marketing_journeys
    LEFT JOIN marketing_segments ON marketing_segments.id = marketing_journeys.segment_id
    ${id ? 'WHERE marketing_journeys.id = ?' : ''} ORDER BY marketing_journeys.updated_at DESC
  `).all(...(id ? [id] : [])) as JourneyRow[]
  const enrollment = await db.prepare('SELECT journey_id, status, COUNT(*) AS count FROM journey_enrollments GROUP BY journey_id, status').all() as { journey_id: string, status: string, count: string | number }[]
  const messages = await db.prepare('SELECT journey_id, COUNT(*) AS sent, COUNT(opened_at) AS opened FROM journey_messages GROUP BY journey_id').all() as { journey_id: string, sent: string | number, opened: string | number }[]

  return rows.map((row) => {
    const counts = enrollment.filter(e => e.journey_id === row.id)
    const count = (status?: string) => counts.filter(e => !status || e.status === status).reduce((sum, e) => sum + Number(e.count), 0)
    const message = messages.find(m => m.journey_id === row.id)
    return {
      id: row.id,
      name: row.name,
      status: row.status,
      trigger: row.trigger_type,
      segmentId: row.segment_id ?? undefined,
      segmentName: row.segment_name ?? undefined,
      steps: JSON.parse(row.steps || '[]'),
      quietStart: row.quiet_start ?? undefined,
      quietEnd: row.quiet_end ?? undefined,
      exitAfterDays: row.exit_after_days === null ? undefined : Number(row.exit_after_days),
      publishedAt: row.published_at ?? undefined,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      stats: { enrolled: count(), active: count('active'), completed: count('completed'), sent: Number(message?.sent ?? 0), opened: Number(message?.opened ?? 0) },
    }
  })
}

/**
 * What journey routes return. Steps are typed loosely on the wire because the step tree is
 * recursive (branches contain steps), and Nitro's typed-route inference can't serialise recursive
 * types — it fails every $fetch in the app with "type instantiation is excessively deep".
 */
export type JourneyResponse = Omit<Journey, 'steps'> & { steps: unknown[] }
export function journeyResponse(journey: Journey | undefined): JourneyResponse | undefined {
  return journey
}

/** Checks a step tree before saving: known types, sensible values, at most 30 steps in all. */
export function validateSteps(steps: JourneyStep[], depth = 0): JourneyStep[] {
  if (!Array.isArray(steps) || depth > 3)
    throw createError({ statusCode: 400, statusMessage: 'Branches can be nested at most 3 deep' })
  return steps.map((step): JourneyStep => {
    const id = typeof step.id === 'string' && step.id ? step.id.slice(0, 40) : randomBytes(6).toString('hex')
    switch (step.type) {
      case 'email':
        if (!step.subject?.trim() || !step.body?.trim())
          throw createError({ statusCode: 400, statusMessage: 'Every email step needs a subject and a body' })
        return { id, type: 'email', subject: step.subject.trim().slice(0, 200), body: step.body.slice(0, 20000) }
      case 'wait':
        return { id, type: 'wait', days: Math.min(365, Math.max(1, Math.round(Number(step.days) || 1))) }
      case 'branch':
        return { id, type: 'branch', condition: ['opened_last_email', 'lead_stage_is', 'became_client'].includes(step.condition) ? step.condition : 'opened_last_email', value: step.value?.slice(0, 40), yes: validateSteps(step.yes ?? [], depth + 1), no: validateSteps(step.no ?? [], depth + 1) }
      case 'create_lead':
        return { id, type: 'create_lead', note: step.note?.slice(0, 500) }
      case 'notify_owner':
        return { id, type: 'notify_owner', message: (step.message || 'A contact reached this step in a journey').slice(0, 300) }
      default:
        throw createError({ statusCode: 400, statusMessage: 'Unknown journey step' })
    }
  })
}

// ── Running journeys ───────────────────────────────────────────────────────

/** A position in the step tree: indexes, with 'yes'/'no' entering a branch. */
type StepPath = (number | 'yes' | 'no')[]

function stepAt(steps: JourneyStep[], path: StepPath): JourneyStep | undefined {
  let list = steps
  let step: JourneyStep | undefined
  for (let i = 0; i < path.length; i++) {
    const part = path[i]!
    if (typeof part === 'number') {
      step = list[part]
      if (!step)
        return undefined
    }
    else if (step?.type === 'branch') {
      list = step[part]
    }
  }
  return step
}

/** The step after `path` — next sibling, or back out of a finished branch. */
function nextPath(steps: JourneyStep[], path: StepPath): StepPath | null {
  const current = [...path]
  while (current.length) {
    const index = current.pop() as number
    const parentBranchSide = current.at(-1)
    const siblings = !current.length
      ? steps
      : (() => {
          const side = parentBranchSide as 'yes' | 'no'
          const branch = stepAt(steps, current.slice(0, -1)) as Extract<JourneyStep, { type: 'branch' }>
          return branch[side]
        })()
    if (index + 1 < siblings.length)
      return [...current, index + 1]
    if (!current.length)
      return null
    current.pop() // leave the branch side
  }
  return null
}

function inQuietHours(journey: Journey, now: Date) {
  if (!journey.quietStart || !journey.quietEnd)
    return null
  const minutes = now.getUTCHours() * 60 + now.getUTCMinutes()
  const [sh, sm] = journey.quietStart.split(':').map(Number)
  const [eh, em] = journey.quietEnd.split(':').map(Number)
  const start = (sh ?? 0) * 60 + (sm ?? 0)
  const end = (eh ?? 0) * 60 + (em ?? 0)
  const quiet = start <= end ? minutes >= start && minutes < end : minutes >= start || minutes < end
  if (!quiet)
    return null
  const resume = new Date(now)
  resume.setUTCHours(eh ?? 0, em ?? 0, 0, 0)
  if (resume <= now)
    resume.setUTCDate(resume.getUTCDate() + 1)
  return resume
}

function personalise(text: string, contact: { name?: string | null, company?: string | null }) {
  const firstName = (contact.name ?? '').split(/\s+/)[0] || 'there'
  return text.replaceAll('{{first_name}}', firstName).replaceAll('{{company}}', contact.company ?? 'your company')
}

export function journeyEmailHtml(body: string, links: { openPixel: string, unsubscribe: string }, companyName: string) {
  return `
    <div style="font-family:Inter,Arial,sans-serif;font-size:15px;line-height:1.6;color:#0e0f0c;max-width:600px">
      ${renderMarkdown(body, { embeds: false })}
      <p style="margin-top:32px;font-size:12px;color:#6a6c6a">You're receiving this from ${companyName}. <a href="${links.unsubscribe}" style="color:#6a6c6a">Unsubscribe</a></p>
      <img src="${links.openPixel}" width="1" height="1" alt="" style="display:block;border:0">
    </div>`
}

export async function sendJourneyEmail(options: { journeyId: string, enrollmentId: string, stepId: string, email: string, name?: string | null, company?: string | null, subject: string, body: string }) {
  const org = await getOrganization(currentOrgId())
  const slug = org?.slug ?? HOME_ORG_ID
  const base = (useRuntimeConfig().siteUrl || '').replace(/\/$/, '')
  const messageId = randomBytes(16).toString('hex')
  const html = journeyEmailHtml(personalise(options.body, options), {
    openPixel: `${base}/api/public/m/${messageId}.gif?workspace=${slug}`,
    unsubscribe: `${base}/unsubscribe/${slug}/${messageId}`,
  }, org && !org.isHome ? org.name : 'Canopy')

  await sendGmailMessage({ to: options.email, subject: personalise(options.subject, options), html })
  await useTenantDb().prepare('INSERT INTO journey_messages (id, enrollment_id, journey_id, step_id, email, subject, sent_at) VALUES (?, ?, ?, ?, ?, ?, ?)').run(messageId, options.enrollmentId, options.journeyId, options.stepId, options.email, options.subject, new Date().toISOString())
  return messageId
}

interface EnrollmentRow { id: string, journey_id: string, contact_key: string, email: string, name: string | null, path: string, status: string, next_run_at: string, last_message_id: string | null, entered_at: string }

export async function enrollContact(journeyId: string, contact: { key: string, email: string, name?: string }) {
  const id = await nextPrefixedId('journey_enrollment', 'ENR', 6)
  const now = new Date().toISOString()
  await useTenantDb().prepare(`
    INSERT INTO journey_enrollments (id, journey_id, contact_key, email, name, path, status, next_run_at, entered_at, updated_at)
    VALUES (?, ?, ?, ?, ?, '[0]', 'active', ?, ?, ?)
    ON CONFLICT (journey_id, contact_key) DO NOTHING
  `).run(id, journeyId, contact.key, normalizeEmail(contact.email), contact.name ?? null, now, now, now)
}

/** Website demo request → every active "demo request" journey. */
export async function enrollDemoRequest(lead: { id: string, email: string, name?: string }) {
  const journeys = (await loadJourneys()).filter(j => j.status === 'active' && j.trigger === 'demo_request')
  for (const journey of journeys)
    await enrollContact(journey.id, { key: `lead:${lead.id}`, email: lead.email, name: lead.name })
}

const MAX_STEPS_PER_RUN = 300

/**
 * One pass over every active journey in the current company: enrol new segment members, then
 * advance each due enrolment until it hits a wait, quiet hours, or the end. Safe to run often.
 */
export async function runJourneys() {
  const db = useTenantDb()
  const journeys = (await loadJourneys()).filter(j => j.status === 'active')
  if (!journeys.length)
    return { enrolled: 0, sent: 0 }

  let enrolled = 0
  let sent = 0
  const contacts = await loadMarketingContacts()
  const suppressed = await suppressedEmails()
  const contactByKey = new Map(contacts.map(c => [c.key, c]))
  const contactByEmail = new Map(contacts.map(c => [c.email, c]))

  for (const journey of journeys) {
    if (journey.trigger !== 'segment' || !journey.segmentId)
      continue
    const segment = await loadSegment(journey.segmentId)
    if (!segment)
      continue
    for (const contact of contacts.filter(c => contactMatchesSegment(c, segment.conditions) && !suppressed.has(c.email))) {
      const before = await db.prepare('SELECT 1 FROM journey_enrollments WHERE journey_id = ? AND contact_key = ?').get(journey.id, contact.key)
      if (!before) {
        await enrollContact(journey.id, contact)
        enrolled++
      }
    }
  }

  const now = new Date()
  const due = await db.prepare('SELECT * FROM journey_enrollments WHERE status = \'active\' AND next_run_at <= ? ORDER BY next_run_at LIMIT 200').all(now.toISOString()) as EnrollmentRow[]
  let budget = MAX_STEPS_PER_RUN

  for (const enrollment of due) {
    const journey = journeys.find(j => j.id === enrollment.journey_id)
    if (!journey)
      continue
    const finish = async (status: 'completed' | 'exited' | 'unsubscribed') => {
      await db.prepare('UPDATE journey_enrollments SET status = ?, updated_at = ? WHERE id = ?').run(status, new Date().toISOString(), enrollment.id)
    }
    if (journey.exitAfterDays && new Date(enrollment.entered_at).getTime() + journey.exitAfterDays * 86400000 < now.getTime()) {
      await finish('exited')
      continue
    }
    if (suppressed.has(enrollment.email)) {
      await finish('unsubscribed')
      continue
    }

    let path: StepPath | null = JSON.parse(enrollment.path)
    let lastMessageId = enrollment.last_message_id
    let nextRunAt = now
    while (path && budget-- > 0) {
      const step = stepAt(journey.steps, path)
      if (!step) {
        path = null
        break
      }
      const contact = contactByKey.get(enrollment.contact_key) ?? contactByEmail.get(enrollment.email)

      if (step.type === 'email') {
        const resumeAt = inQuietHours(journey, now)
        if (resumeAt) {
          nextRunAt = resumeAt
          break
        }
        try {
          lastMessageId = await sendJourneyEmail({ journeyId: journey.id, enrollmentId: enrollment.id, stepId: step.id, email: enrollment.email, name: enrollment.name, company: contact?.company, subject: step.subject, body: step.body })
          sent++
          if (contact?.leadId)
            await logLeadActivity({ leadId: contact.leadId, type: 'automation_applied', actorName: 'Marketing', message: `Journey "${journey.name}": emailed "${step.subject}"` })
        }
        catch (error) {
          console.error(`[journeys] email to enrolment ${enrollment.id} failed`, error)
          nextRunAt = new Date(now.getTime() + 60 * 60 * 1000) // try again in an hour
          break
        }
        path = nextPath(journey.steps, path)
      }
      else if (step.type === 'wait') {
        nextRunAt = new Date(now.getTime() + step.days * 86400000)
        path = nextPath(journey.steps, path)
        break
      }
      else if (step.type === 'branch') {
        let yes = false
        if (step.condition === 'opened_last_email' && lastMessageId) {
          const message = await db.prepare('SELECT opened_at FROM journey_messages WHERE id = ?').get(lastMessageId) as { opened_at: string | null } | undefined
          yes = !!message?.opened_at
        }
        else if (step.condition === 'lead_stage_is') {
          yes = !!contact?.leadStage && contact.leadStage === step.value
        }
        else if (step.condition === 'became_client') {
          yes = !!contact?.clientId
        }
        const side = yes ? 'yes' : 'no'
        path = step[side].length ? [...path, side, 0] : nextPath(journey.steps, path)
      }
      else if (step.type === 'create_lead') {
        const existing = await db.prepare('SELECT id FROM leads WHERE LOWER(contact_email) = ? LIMIT 1').get(enrollment.email) as { id: string } | undefined
        if (!existing) {
          const leadId = await nextLeadId()
          const at = new Date().toISOString()
          await db.prepare('INSERT INTO leads (id, name, contact_name, contact_email, source, stage, notes, next_step_reminder_sent, created_at, updated_at) VALUES (?, ?, ?, ?, ?, \'new\', ?, 0, ?, ?)')
            .run(leadId, contact?.company ?? enrollment.name ?? enrollment.email, enrollment.name, enrollment.email, `Journey: ${journey.name}`, step.note ?? null, at, at)
          const lead = await applyBdCreationRules('lead', await loadFullLead(leadId))
          if (!lead.assignees.length)
            await autoAssignLead(lead)
        }
        else {
          await logLeadActivity({ leadId: existing.id, type: 'automation_applied', actorName: 'Marketing', message: `Journey "${journey.name}" handed this contact to Sales${step.note ? `: ${step.note}` : ''}` })
        }
        path = nextPath(journey.steps, path)
      }
      else if (step.type === 'notify_owner') {
        for (const staffId of contact?.assigneeIds ?? [])
          await createNotification({ staffId, type: 'bd_automation', title: `Journey: ${journey.name}`, body: `${enrollment.name ?? enrollment.email} — ${step.message}`, url: contact?.leadId ? `/leads/${contact.leadId}` : contact?.clientId ? `/clients/${contact.clientId}` : undefined })
        path = nextPath(journey.steps, path)
      }
    }

    if (!path)
      await db.prepare('UPDATE journey_enrollments SET status = \'completed\', last_message_id = ?, updated_at = ? WHERE id = ?').run(lastMessageId, new Date().toISOString(), enrollment.id)
    else
      await db.prepare('UPDATE journey_enrollments SET path = ?, next_run_at = ?, last_message_id = ?, updated_at = ? WHERE id = ?').run(JSON.stringify(path), nextRunAt.toISOString(), lastMessageId, new Date().toISOString(), enrollment.id)
    if (budget <= 0)
      break
  }
  return { enrolled, sent }
}
