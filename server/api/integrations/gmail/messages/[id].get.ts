export default defineEventHandler(async (event) => {
  const user = await requireSessionUser(event)
  const messageId = getRouterParam(event, 'id')

  if (!messageId) {
    throw createError({ statusCode: 400, statusMessage: 'Missing message id' })
  }

  const { refreshToken } = await requireConnectedGmailAccount(user.id)
  const accessToken = await getPersonalAccessToken(refreshToken)

  return await getGmailMessageBody(accessToken, messageId)
})
