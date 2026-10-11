export default defineEventHandler(async (event) => {
  const staff = await requirePlatformStaff(event)
  const body = await readBody<{ clientName?: string }>(event)
  if (!body?.clientName?.trim())
    throw createError({ statusCode: 400, statusMessage: 'Client name is required' })

  const onboarding = await createOnboarding({ clientName: body.clientName, owner: { id: staff.id, name: staff.name } })
  await recordAudit({ actorId: staff.id, actorName: staff.name, action: 'onboarding.created', detail: `${onboarding.id} · ${onboarding.clientName}` })
  setResponseStatus(event, 201)
  return { onboarding }
})
