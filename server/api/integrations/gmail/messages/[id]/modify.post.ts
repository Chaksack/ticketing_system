interface ModifyBody {
  addLabelIds?: string[]
  removeLabelIds?: string[]
}

export default defineEventHandler(async (event) => {
  const user = await requireSessionUser(event)
  const messageId = getRouterParam(event, 'id')
  const body = await readBody<ModifyBody>(event)

  if (!messageId) {
    throw createError({ statusCode: 400, statusMessage: 'Missing message id' })
  }

  const { refreshToken } = await requireConnectedGmailAccount(user.id)
  const accessToken = await getPersonalAccessToken(refreshToken)

  await modifyGmailMessage(accessToken, messageId, {
    addLabelIds: body?.addLabelIds,
    removeLabelIds: body?.removeLabelIds,
  })

  return { success: true }
})
