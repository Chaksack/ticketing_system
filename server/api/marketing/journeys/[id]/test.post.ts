import type { JourneyStep } from '../../../../../app/types/marketing'

/** "Test journey": sends the first email step to the person testing, filled in with their own name. */
export default defineEventHandler(async (event) => {
  const user = await requireMarketing(event)
  await ensureDb()
  const journey = (await loadJourneys(getRouterParam(event, 'id') ?? ''))[0]
  if (!journey)
    throw createError({ statusCode: 404, statusMessage: 'Journey not found' })
  const { stepId } = await readBody<{ stepId?: string }>(event) ?? {}

  const emails: Extract<JourneyStep, { type: 'email' }>[] = []
  const walk = (steps: JourneyStep[]) => steps.forEach((s) => {
    if (s.type === 'email')
      emails.push(s)
    if (s.type === 'branch') {
      walk(s.yes)
      walk(s.no)
    }
  })
  walk(journey.steps)
  const step = emails.find(s => s.id === stepId) ?? emails[0]
  if (!step)
    throw createError({ statusCode: 400, statusMessage: 'This journey has no email step to test' })

  const org = await getOrganization(currentOrgId())
  const html = journeyEmailHtml(step.body.replaceAll('{{first_name}}', user.name.split(' ')[0] ?? '').replaceAll('{{company}}', org?.name ?? 'your company'), { openPixel: '', unsubscribe: '#' }, org?.name ?? 'Canopy')
  try {
    await sendGmailMessage({ to: user.email, subject: `[Test] ${step.subject.replaceAll('{{first_name}}', user.name.split(' ')[0] ?? '')}`, html })
  }
  catch (error) {
    console.error('Journey test email failed', error)
    throw createError({ statusCode: 502, statusMessage: 'The test email could not be sent. Check the Gmail connection.' })
  }
  return { ok: true, to: user.email, subject: step.subject }
})
