export default defineEventHandler(async (event) => {
  const user = await requireSessionUser(event)

  const { refreshToken } = await requireConnectedGmailAccount(user.id)
  const accessToken = await getPersonalAccessToken(refreshToken)

  const query = getQuery(event)
  const q = typeof query.q === 'string' && query.q ? query.q : undefined

  const messages = await listGmailMessages(accessToken, { query: q })
  return { messages }
})
