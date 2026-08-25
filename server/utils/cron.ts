import type { H3Event } from 'h3'

/**
 * Protects a /api/cron/* route. Vercel Cron is configured to call these paths on a schedule;
 * setting NUXT_CRON_SECRET (and the matching CRON_SECRET env var in your Vercel project)
 * requires the request to carry a matching `Authorization: Bearer <secret>` header, so the
 * route can't be triggered by anyone who finds the URL. Left unset, the route stays callable
 * without auth — fine for local testing, not recommended once deployed.
 */
export function requireCronAuth(event: H3Event) {
  const config = useRuntimeConfig()

  if (!config.cronSecret) {
    console.warn(`[cron] NUXT_CRON_SECRET is not set — ${event.path} is running without authentication`)
    return
  }

  const auth = getHeader(event, 'authorization')
  if (auth !== `Bearer ${config.cronSecret}`) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }
}
