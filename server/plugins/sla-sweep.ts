const SWEEP_INTERVAL_MS = 5 * 60 * 1000

/**
 * Background sweep for local dev / any persistent (non-serverless) deployment, where a
 * setInterval can actually stay alive between requests. On Vercel this never reliably fires
 * (functions don't keep running between invocations) — there, the same logic runs via
 * Vercel Cron hitting /api/cron/sla-sweep, /api/cron/gmail-inbound and /api/cron/amc-reminders
 * instead. Both paths share the same underlying functions (server/utils/sweeps.ts,
 * server/utils/gmail.ts, server/utils/amcSweep.ts) so there's exactly one implementation either way.
 */
export default defineNitroPlugin(async () => {
  await ensureDb()

  setInterval(() => {
    runTicketSweep().catch(error => console.error('Ticket sweep failed', error))

    checkAmcRenewals().catch(error => console.error('AMC renewal sweep failed', error))

    checkGmailInbox().catch((error) => {
      // Not configured is expected until NUXT_GMAIL_REFRESH_TOKEN is set — don't spam logs for it.
      if (!(error instanceof Error) || !error.message.includes('not configured'))
        console.error('Gmail inbox check failed', error)
    })
  }, SWEEP_INTERVAL_MS)
})
