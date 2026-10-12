const SWEEP_INTERVAL_MS = 5 * 60 * 1000
const ERP_SYNC_INTERVAL_MS = 60 * 60 * 1000

/**
 * Background sweep for local dev / any persistent (non-serverless) deployment, where a
 * setInterval can actually stay alive between requests. On Vercel this never reliably fires
 * (functions don't keep running between invocations) — there, the same logic runs via
 * Vercel Cron hitting /api/cron/sla-sweep, /api/cron/gmail-inbound and /api/cron/amc-reminders
 * instead. Both paths share the same underlying functions (server/utils/sweeps.ts,
 * server/utils/gmail.ts, server/utils/amcSweep.ts, server/utils/taskSweep.ts) so there's exactly
 * one implementation either way.
 */
export default defineNitroPlugin(async () => {
  await ensureDb()

  // Every sweep runs once per active company, in that company's database.
  setInterval(() => {
    forEachActiveOrg('ticket-sweep', () => runTicketSweep())
      .then(() => forEachActiveOrg('amc-renewals', () => checkAmcRenewals()))
      .then(() => forEachActiveOrg('task-reminders', () => checkTaskReminders()))
      .then(() => forEachActiveOrg('lead-reminders', () => checkLeadReminders()))
      .then(() => forEachActiveOrg('tender-reminders', () => checkTenderReminders()))
      .then(() => forEachActiveOrg('amc-follow-ups', () => checkAmcFollowUps()))
      .then(() => forEachActiveOrg('meeting-reminders', () => checkMeetingReminders()))
      .then(() => forEachActiveOrg('prune-notifications', () => pruneReadNotifications()))
      .then(() => forEachActiveOrg('marketing-journeys', () => runJourneys()))
      .catch(error => console.error('Sweep failed', error))

    runWithTenant(HOME_ORG_ID, async () => {
      await ensureDb()
      await checkGmailInbox()
    }).catch((error) => {
      // Not configured is expected until NUXT_GMAIL_REFRESH_TOKEN is set — don't spam logs for it.
      if (!(error instanceof Error) || !error.message.includes('not configured'))
        console.error('Gmail inbox check failed', error)
    })
  }, SWEEP_INTERVAL_MS)

  // Hourly, matching .github/workflows/erp-sync.yml (/api/cron/erp-sync) in production.
  setInterval(() => {
    forEachActiveOrg('erp-sync', () => runAllErpSyncs()).catch(error => console.error('ERP sync failed', error))
  }, ERP_SYNC_INTERVAL_MS)
})
