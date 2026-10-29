import pg from 'pg'

let patched = false
let queryChain: Promise<unknown> = Promise.resolve()

interface WatchedClient extends pg.Client {
  __canopyWatched?: boolean
  __canopyDead?: boolean
  /** The connection used instead of this one after it dropped. */
  __canopyReplacement?: WatchedClient
  _ending?: boolean
  _ended?: boolean
  _queryable?: boolean
  _connectionError?: boolean
}

/** Errors that mean the connection itself is gone (not that the SQL was wrong). */
const CONNECTION_LOST = /Connection terminated|not queryable|ECONNRESET|EPIPE|ETIMEDOUT|Client was closed|terminating connection/i

const isDead = (client: WatchedClient) => !!(client.__canopyDead || client._ending || client._ended || client._queryable === false || client._connectionError)

/** Without an 'error' listener, a dropped connection is an uncaught exception that takes the server down. */
function watch(client: WatchedClient) {
  if (client.__canopyWatched)
    return
  client.__canopyWatched = true
  client.on('error', (error) => {
    client.__canopyDead = true
    console.warn(`[db] connection to ${client.database} lost — reconnecting on the next query (${error.message})`)
  })
}

/** This client, or a fresh connection to the same database if it has dropped. */
async function liveClient(client: WatchedClient): Promise<WatchedClient> {
  const current = client.__canopyReplacement ?? client
  if (!isDead(current))
    return current
  const params = client.connectionParameters as unknown as { user: string, password: string, host: string, port: number, database: string, ssl: pg.ClientConfig['ssl'] }
  const fresh = new pg.Client({ user: params.user, password: params.password, host: params.host, port: params.port, database: params.database, ssl: params.ssl }) as WatchedClient
  await fresh.connect()
  client.__canopyReplacement = fresh
  current.end().catch(() => {})
  return fresh
}

/**
 * db0's postgresql connector uses a single non-pooled pg.Client per database for the whole server
 * process (see node_modules/db0/dist/connectors/postgresql.mjs) — there's no pooling option, and
 * Nitro's `nitro.database.default.connector` config only accepts db0's built-in connector names, so
 * we can't swap in a pooled one without forking db0. That leaves two problems this patch fixes:
 *
 * 1. Concurrent queries. Two requests querying at the same moment trigger pg's "already executing a
 *    query" deprecation and can wedge the connection, so every query is queued behind whichever one
 *    is in flight.
 * 2. Dropped connections. Neon (and any Postgres) closes idle or recycled connections. db0 keeps the
 *    dead client forever, so every later query failed until the server restarted. Now a dropped
 *    client is replaced with a fresh connection on the next query. The query that was running when
 *    the connection dropped still fails (it may or may not have been applied, so it isn't retried).
 *    A failed first connect is also recovered instead of being cached by db0 as a rejected promise.
 *
 * Must run before the very first query anywhere in the app — call this at the top of the
 * earliest-loaded Nitro plugin (server/plugins/db.ts).
 */
export function ensurePgQuerySerialized() {
  if (patched)
    return
  patched = true

  const originalQuery = pg.Client.prototype.query
  const originalConnect = pg.Client.prototype.connect

  pg.Client.prototype.connect = function (this: WatchedClient, ...args: unknown[]) {
    watch(this)
    // Callback style (pg.Pool) keeps pg's own behaviour.
    if (typeof args[0] === 'function')
      return (originalConnect as (...a: unknown[]) => unknown).apply(this, args)
    return (originalConnect.apply(this) as Promise<void>).catch((error: Error) => {
      // db0 caches this promise; resolve with the client marked dead so the next query reconnects.
      this.__canopyDead = true
      console.warn(`[db] could not connect to ${this.database} — will retry on the next query (${error.message})`)
    })
  } as typeof pg.Client.prototype.connect

  // db0's connector only ever calls `client.query(sql, params)` (no callback), so that's the
  // only calling convention this queue needs to support.
  pg.Client.prototype.query = function (this: WatchedClient, ...args: unknown[]) {
    const run = async () => {
      const target = await liveClient(this)
      try {
        return await (originalQuery as (...a: unknown[]) => Promise<unknown>).apply(target, args)
      }
      catch (error) {
        if (CONNECTION_LOST.test((error as Error)?.message ?? ''))
          target.__canopyDead = true
        throw error
      }
    }
    const result = queryChain.then(run, run)
    queryChain = result.then(() => undefined, () => undefined)
    return result
  } as typeof pg.Client.prototype.query
}
