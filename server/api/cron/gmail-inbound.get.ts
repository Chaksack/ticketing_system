export default defineEventHandler(async (event) => {
  requireCronAuth(event)

  await ensureDb()
  const result = await checkGmailInbox()
  return { ok: true, ...result }
})
