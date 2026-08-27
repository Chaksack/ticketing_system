import pg from 'pg'

let patched = false
let queryChain: Promise<unknown> = Promise.resolve()

/**
 * db0's postgresql connector uses a single non-pooled pg.Client for the whole server process
 * (see node_modules/db0/dist/connectors/postgresql.mjs) — there's no pooling option, and Nitro's
 * `nitro.database.default.connector` config only accepts db0's built-in connector names, so we
 * can't swap in a pooled one without forking db0. Two requests issuing queries at the same
 * moment (completely normal under real traffic — not a bug in the calling code) triggers pg's
 * "already executing a query" deprecation warning and can permanently wedge the connection,
 * which silently surfaces as pages rendering zero/empty data rather than an error.
 *
 * Fix: monkey-patch pg.Client.prototype.query (shared by every Client instance, including
 * db0's) so every query is queued behind whichever one is currently in flight, transparently.
 * Must run before the very first query anywhere in the app — call this at the top of the
 * earliest-loaded Nitro plugin (server/plugins/db.ts).
 */
export function ensurePgQuerySerialized() {
  if (patched)
    return
  patched = true

  const originalQuery = pg.Client.prototype.query

  // db0's connector only ever calls `client.query(sql, params)` (no callback), so that's the
  // only calling convention this queue needs to support.
  pg.Client.prototype.query = function (this: pg.Client, ...args: unknown[]) {
    const run = () => (originalQuery as (...a: unknown[]) => unknown).apply(this, args)
    const result = queryChain.then(run, run)
    queryChain = result.then(() => undefined, () => undefined)
    return result
  } as typeof pg.Client.prototype.query
}
