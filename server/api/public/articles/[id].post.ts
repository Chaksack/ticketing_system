const VOTES_PER_IP_PER_HOUR = 30
const HOUR_MS = 60 * 60 * 1000

/** Customer portal: "Did this answer your question?" — also counts the view when the article is opened. */
export default defineEventHandler(async (event) => {
  applyPortalCors(event)
  await useWorkspaceFromRequest(event)
  await ensureDb()

  const id = getRouterParam(event, 'id') ?? ''
  const { action } = await readBody<{ action?: 'view' | 'helpful' | 'not_helpful' }>(event) ?? {}
  const ip = getRequestIP(event, { xForwardedFor: true }) ?? 'unknown'
  if (!(await checkRateLimit('kb-feedback-ip', ip, VOTES_PER_IP_PER_HOUR, HOUR_MS)).allowed)
    return { ok: true }

  const column = action === 'helpful' ? 'helpful_yes' : action === 'not_helpful' ? 'helpful_no' : 'views'
  await useTenantDb().prepare(`UPDATE kb_articles SET ${column} = ${column} + 1 WHERE id = ? AND status = 'published' AND visibility = 'public'`).run(id)
  return { ok: true }
})
