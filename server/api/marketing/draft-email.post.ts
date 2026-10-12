const SYSTEM = `You write short marketing emails for a B2B company's nurture journeys. Plain, warm, specific; no hype, no exclamation marks.
Use Markdown only for **bold**, paragraphs and "- " bullets. You may use the placeholders {{first_name}} and {{company}}. Never invent statistics, prices, customer names or promises.
Reply in this exact form:
SUBJECT: <subject line, under 60 characters>
<blank line>
<email body>`

/** Canopy Assist for a journey email step. Needs a connected AI. */
export default defineEventHandler(async (event) => {
  const user = await requireMarketing(event)
  const { brief, journeyName } = await readBody<{ brief?: string, journeyName?: string }>(event) ?? {}
  if (!brief?.trim())
    throw createError({ statusCode: 400, statusMessage: 'Describe what the email should say' })
  const org = await getOrganization(currentOrgId())
  const text = await generateAiText(user, SYSTEM, `Company: ${org?.name ?? 'Canopy'}${org?.sector ? ` (${org.sector})` : ''}\nJourney: ${journeyName ?? ''}\nThe email should: ${brief.slice(0, 1500)}`, 700)
  if (!text)
    throw createError({ statusCode: 400, statusMessage: 'Connect an AI in Settings → Integrations to draft emails with Assist.' })
  const subject = text.match(/^SUBJECT: ?(\S.*)$/m)?.[1]?.trim() ?? ''
  return { subject, body: text.replace(/^SUBJECT:.*$/m, '').trim() }
})
