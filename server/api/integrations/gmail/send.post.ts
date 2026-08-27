interface SendMailBody {
  to?: string
  subject?: string
  text?: string
  threadId?: string
  inReplyToMessageId?: string
}

export default defineEventHandler(async (event) => {
  const user = await requireSessionUser(event)
  const body = await readBody<SendMailBody>(event)

  if (!body?.to?.trim() || !body?.subject?.trim() || !body?.text?.trim()) {
    throw createError({ statusCode: 400, statusMessage: 'to, subject and text are required' })
  }

  const { gmailEmail, refreshToken } = await requireConnectedGmailAccount(user.id)
  const accessToken = await getPersonalAccessToken(refreshToken)

  await sendGmailFromPersonalAccount(accessToken, {
    fromEmail: gmailEmail,
    to: body.to.trim(),
    subject: body.subject.trim(),
    text: body.text.trim(),
    threadId: body.threadId,
    inReplyToMessageId: body.inReplyToMessageId,
  })

  return { success: true }
})
