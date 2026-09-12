export default defineEventHandler(async (event) => {
  const user = await requireSessionUser(event)
  await ensureDb()

  const status = await getStaffIntegrationStatus(user.id, 'slack')
  if (!status.connected) {
    throw createError({ statusCode: 400, statusMessage: 'Slack is not connected' })
  }

  const sent = await sendSlackDmToStaff(user.id, {
    title: 'Test notification',
    body: 'If you can see this, notifications from IBS Ticketing System will reach you here on Slack.',
  })

  if (!sent) {
    throw createError({ statusCode: 502, statusMessage: 'Could not send the test message — the Slack connection may need to be reconnected' })
  }

  return { ok: true }
})
