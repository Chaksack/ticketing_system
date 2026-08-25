import webpush from 'web-push'

let configured = false

function ensureConfigured() {
  if (configured)
    return

  const config = useRuntimeConfig()
  webpush.setVapidDetails(config.vapidSubject, config.public.vapidPublicKey, config.vapidPrivateKey)
  configured = true
}

export interface PushSubscriptionRecord {
  endpoint: string
  p256dh: string
  auth: string
}

export interface PushPayload {
  title: string
  body: string
  url?: string
}

export async function sendPushNotification(sub: PushSubscriptionRecord, payload: PushPayload) {
  ensureConfigured()

  try {
    await webpush.sendNotification(
      { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
      JSON.stringify(payload),
    )
    return true
  }
  catch (error: any) {
    if (error?.statusCode === 404 || error?.statusCode === 410) {
      const db = useDatabase()
      await db.prepare('DELETE FROM push_subscriptions WHERE endpoint = ?').run(sub.endpoint)
    }
    else {
      console.error('Failed to send push notification', error)
    }
    return false
  }
}

export async function sendPushToStaff(staffId: string, payload: PushPayload) {
  const db = useDatabase()
  const rows = await db.prepare('SELECT endpoint, p256dh, auth FROM push_subscriptions WHERE staff_id = ?').all(staffId) as PushSubscriptionRecord[]

  await Promise.all(rows.map(row => sendPushNotification(row, payload)))
}
