import type { H3Event } from 'h3'

/**
 * Applies CORS to the public ticket-submission endpoint so it can be called directly from
 * an external site (e.g. an embedded contact form), scoped to the origins configured via
 * NUXT_PUBLIC_PORTAL_CORS_ORIGINS (comma-separated). With nothing configured, cross-origin
 * calls are simply not allowed — same-origin calls from this app's own /portal page are
 * unaffected either way, since CORS only governs cross-origin requests.
 *
 * Returns true if this was a CORS preflight request that has already been fully handled
 * (the caller should return immediately without doing any further work).
 */
export function applyPortalCors(event: H3Event): boolean {
  const config = useRuntimeConfig()
  const origins = (config.public.portalCorsOrigins || '')
    .split(',')
    .map(origin => origin.trim())
    .filter(Boolean)

  return handleCors(event, {
    origin: origins,
    methods: ['POST'],
    credentials: false,
  })
}
