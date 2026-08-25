export interface RateLimitResult {
  allowed: boolean
  remaining: number
}

/**
 * Fixed-window rate limiter backed by Postgres, so it holds regardless of how many
 * server instances/processes are running. `scope` namespaces the limit (e.g. per-endpoint),
 * `key` identifies the caller (e.g. IP address or email).
 */
export async function checkRateLimit(scope: string, key: string, limit: number, windowMs: number): Promise<RateLimitResult> {
  const db = useDatabase()
  const windowStart = new Date(Math.floor(Date.now() / windowMs) * windowMs).toISOString()

  const row = await db.prepare(`
    INSERT INTO rate_limit_counters (scope, key, window_start, count)
    VALUES (?, ?, ?, 1)
    ON CONFLICT (scope, key, window_start) DO UPDATE SET count = rate_limit_counters.count + 1
    RETURNING count
  `).get(scope, key, windowStart) as { count: number }

  return { allowed: row.count <= limit, remaining: Math.max(0, limit - row.count) }
}

export async function pruneRateLimitCounters(olderThanMs = 24 * 60 * 60 * 1000) {
  const db = useDatabase()
  const cutoff = new Date(Date.now() - olderThanMs).toISOString()
  await db.prepare('DELETE FROM rate_limit_counters WHERE window_start < ?').run(cutoff)
}
