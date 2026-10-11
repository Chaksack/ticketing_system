// One shared mailbox for every company: its sync cursor lives in the home workspace, and each
// reply is filed in the company named in its Message-ID / subject (server/utils/gmail.ts).
export default defineEventHandler(async (event) => {
  requireCronAuth(event)

  const result = await runWithTenant(HOME_ORG_ID, async () => {
    await ensureDb()
    return await checkGmailInbox()
  })
  return { ok: true, ...result }
})
