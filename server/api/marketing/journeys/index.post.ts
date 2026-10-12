export default defineEventHandler(async (event) => {
  const user = await requireMarketing(event)
  const { name } = await readBody<{ name?: string }>(event) ?? {}
  if (!name?.trim())
    throw createError({ statusCode: 400, statusMessage: 'Give the journey a name' })
  await ensureDb()
  const id = await nextPrefixedId('marketing_journey', 'JRN')
  const now = new Date().toISOString()
  const starter = [{ id: 'welcome', type: 'email', subject: 'Welcome, {{first_name}}', body: 'Hi {{first_name}},\n\nThanks for your interest. Here\'s what happens next…' }]
  await useTenantDb().prepare('INSERT INTO marketing_journeys (id, name, status, trigger_type, steps, quiet_start, quiet_end, exit_after_days, created_by, created_at, updated_at) VALUES (?, ?, \'draft\', \'segment\', ?, \'20:00\', \'08:00\', 30, ?, ?, ?)').run(id, name.trim().slice(0, 120), JSON.stringify(starter), user.id, now, now)
  setResponseStatus(event, 201)
  return { journey: journeyResponse((await loadJourneys(id))[0]) }
})
