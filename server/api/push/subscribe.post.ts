import { randomUUID } from 'node:crypto'

interface SubscribeBody {
  endpoint?: string
  keys?: {
    p256dh?: string
    auth?: string
  }
}

export default defineEventHandler(async (event) => {
  const user = await requireSessionUser(event)
  const body = await readBody<SubscribeBody>(event)

  if (!body?.endpoint || !body?.keys?.p256dh || !body?.keys?.auth) {
    throw createError({ statusCode: 400, statusMessage: 'endpoint and keys.p256dh/keys.auth are required' })
  }

  await ensureDb()
  const db = useDatabase()

  const existing = await db.prepare('SELECT id FROM push_subscriptions WHERE endpoint = ?').get(body.endpoint) as { id: string } | undefined

  if (existing) {
    await db.prepare('UPDATE push_subscriptions SET staff_id = ?, p256dh = ?, auth = ? WHERE endpoint = ?')
      .run(user.id, body.keys.p256dh, body.keys.auth, body.endpoint)
  }
  else {
    await db.prepare(`
      INSERT INTO push_subscriptions (id, staff_id, endpoint, p256dh, auth, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(randomUUID(), user.id, body.endpoint, body.keys.p256dh, body.keys.auth, new Date().toISOString())
  }

  return { success: true }
})
