import type { SupportChannel, SupportCustomer, SupportShift } from '../../app/types/supportDesk'

/**
 * Support desk screens (Customer Service → Support desk / Support setup): customers, the agents'
 * rota, chat tags and channel switches. Rota times are in the workspace's time zone
 * (Admin → Organisation).
 */
export const DEFAULT_TIME_ZONE = 'Africa/Accra'

export function isValidTimeZone(zone: unknown): zone is string {
  try {
    return typeof zone === 'string' && !!zone && !!new Intl.DateTimeFormat('en-GB', { timeZone: zone })
  }
  catch {
    return false
  }
}

/** The workspace's time zone (Admin → Organisation), for the rota and new AI agents' hours. */
export async function workspaceTimeZone() {
  const row = await useTenantDb().prepare('SELECT value FROM workspace_settings WHERE key = \'time_zone\'').get() as { value: string } | undefined
  return isValidTimeZone(row?.value) ? row.value : DEFAULT_TIME_ZONE
}

export async function setWorkspaceTimeZone(zone: string) {
  if (!isValidTimeZone(zone))
    throw createError({ statusCode: 400, statusMessage: 'Pick a time zone from the list' })
  await useTenantDb().prepare(`
    INSERT INTO workspace_settings (key, value, updated_at) VALUES ('time_zone', ?, ?)
    ON CONFLICT (key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
  `).run(zone, new Date().toISOString())
}

// ── Rota ──────────────────────────────────────────────────────────────────

interface ShiftRow { id: string, staff_id: string, weekday: number | string, start_time: string, end_time: string }

export function mapSupportShiftRow(row: ShiftRow): SupportShift {
  return { id: row.id, staffId: row.staff_id, weekday: Number(row.weekday), startTime: row.start_time, endTime: row.end_time }
}

export async function listSupportShifts() {
  const rows = await useTenantDb().prepare('SELECT * FROM support_shifts ORDER BY weekday, start_time').all() as ShiftRow[]
  return rows.map(mapSupportShiftRow)
}

/** Weekday (0 = Sunday) and "HH:MM" now, in the given time zone. */
export function supportClock(timeZone: string, at = new Date()) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-GB', { timeZone, weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(at).map(p => [p.type, p.value]))
  return { weekday: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(parts.weekday ?? ''), time: `${parts.hour}:${parts.minute}` }
}

export function isOnShift(shifts: SupportShift[], staffId: string, timeZone: string, at = new Date()) {
  const { weekday, time } = supportClock(timeZone, at)
  return shifts.some(s => s.staffId === staffId && s.weekday === weekday && s.startTime <= time && time < s.endTime)
}

// ── Customers ─────────────────────────────────────────────────────────────

interface ContactRow { email: string, name: string, phone: string | null, kind: 'ticket' | 'chat', open: number | string, at: string }

/**
 * Everyone who raised a ticket or started a chat, one row per email, with any profile details the
 * team added and the client company they belong to.
 */
export async function listSupportCustomers(search = '') {
  const db = useTenantDb()
  const rows = await db.prepare(`
    SELECT LOWER(requester_email) AS email, requester AS name, requester_phone AS phone, 'ticket' AS kind,
      CASE WHEN status IN ('open', 'in-progress', 'pending') THEN 1 ELSE 0 END AS open, COALESCE(updated_at, created_at) AS at
    FROM tickets WHERE requester_email IS NOT NULL AND requester_email <> ''
    UNION ALL
    SELECT LOWER(visitor_email), visitor_name, NULL, 'chat', 0, last_message_at FROM live_chats
  `).all() as ContactRow[]
  const profiles = new Map((await db.prepare('SELECT email, name, phone FROM customer_profiles').all() as { email: string, name: string | null, phone: string | null }[]).map(p => [p.email, p]))
  const ratings = new Map((await db.prepare('SELECT LOWER(email) AS email, AVG(rating) AS rating FROM ticket_surveys WHERE rating IS NOT NULL GROUP BY LOWER(email)').all() as { email: string, rating: string | number }[]).map(r => [r.email, Number(r.rating)]))

  const byEmail = new Map<string, SupportCustomer & { latest: string }>()
  for (const row of rows) {
    const existing = byEmail.get(row.email)
    if (!existing) {
      byEmail.set(row.email, { email: row.email, name: row.name, phone: row.phone ?? undefined, ticketCount: 0, openTickets: 0, chatCount: 0, lastContactAt: row.at, latest: row.at })
    }
    const customer = byEmail.get(row.email)!
    if (row.kind === 'ticket') {
      customer.ticketCount++
      customer.openTickets += Number(row.open)
    }
    else {
      customer.chatCount++
    }
    if (row.at > customer.latest) {
      customer.latest = row.at
      customer.lastContactAt = row.at
      customer.name = row.name || customer.name
    }
    customer.phone ??= row.phone ?? undefined
  }

  const clients = await clientsByEmail([...byEmail.keys()])
  const q = search.trim().toLowerCase()
  return [...byEmail.values()]
    .map(({ latest: _latest, ...customer }) => {
      const profile = profiles.get(customer.email)
      const client = clients.get(customer.email)
      return { ...customer, name: profile?.name || customer.name, phone: profile?.phone || customer.phone, clientId: client?.id, clientName: client?.name, rating: ratings.get(customer.email) }
    })
    .filter(c => !q || c.name.toLowerCase().includes(q) || c.email.includes(q) || c.clientName?.toLowerCase().includes(q))
    .sort((a, b) => b.lastContactAt.localeCompare(a.lastContactAt))
}

/** Client companies for these emails (main contact, named contacts and extra emails). */
export async function clientsByEmail(emails: string[]) {
  const map = new Map<string, { id: string, name: string }>()
  if (!emails.length)
    return map
  const db = useTenantDb()
  const rows = await db.prepare(`
    SELECT LOWER(contact_email) AS email, id, name FROM clients WHERE contact_email IS NOT NULL
    UNION ALL SELECT LOWER(client_contacts.email), clients.id, clients.name FROM client_contacts JOIN clients ON clients.id = client_contacts.client_id WHERE client_contacts.email IS NOT NULL
    UNION ALL SELECT LOWER(client_contact_emails.email), clients.id, clients.name FROM client_contact_emails JOIN clients ON clients.id = client_contact_emails.client_id
  `).all() as { email: string, id: string, name: string }[]
  const wanted = new Set(emails)
  for (const row of rows) {
    if (wanted.has(row.email) && !map.has(row.email))
      map.set(row.email, { id: row.id, name: row.name })
  }
  return map
}

// ── Chat tags ─────────────────────────────────────────────────────────────

export async function chatTags(chatIds: string[]) {
  const map = new Map<string, { id: string, name: string, color: string }[]>()
  if (!chatIds.length)
    return map
  const rows = await useTenantDb().prepare(`
    SELECT live_chat_tags.chat_id, tags.id, tags.name, tags.color FROM live_chat_tags JOIN tags ON tags.id = live_chat_tags.tag_id
    WHERE live_chat_tags.chat_id IN (${chatIds.map(() => '?').join(', ')}) ORDER BY tags.name
  `).all(...chatIds) as { chat_id: string, id: string, name: string, color: string }[]
  for (const row of rows)
    map.set(row.chat_id, [...(map.get(row.chat_id) ?? []), { id: row.id, name: row.name, color: row.color }])
  return map
}

// ── Channels ──────────────────────────────────────────────────────────────

interface ChannelRow { id: string, enabled: number | string, config: string }

export async function loadChannelSetting(id: string) {
  const row = await useTenantDb().prepare('SELECT * FROM support_channels WHERE id = ?').get(id) as ChannelRow | undefined
  return { enabled: row ? Number(row.enabled) === 1 : true, config: (row ? JSON.parse(row.config) : {}) as Record<string, string> }
}

export async function saveChannelSetting(id: string, enabled: boolean, config: Record<string, string>) {
  await useTenantDb().prepare(`
    INSERT INTO support_channels (id, enabled, config, updated_at) VALUES (?, ?, ?, ?)
    ON CONFLICT (id) DO UPDATE SET enabled = excluded.enabled, config = excluded.config, updated_at = excluded.updated_at
  `).run(id, enabled ? 1 : 0, JSON.stringify(config), new Date().toISOString())
}

/** Every way customers can reach the support desk, and whether it's working. */
export async function listSupportChannels(): Promise<SupportChannel[]> {
  const config = useRuntimeConfig()
  const webChat = await loadChannelSetting('web_chat')
  const aiAgent = (await listAiAgents()).find(a => a.enabled && a.serviceMode !== 'human_only')
  const keys = await useTenantDb().prepare('SELECT COUNT(*) AS count FROM api_keys').get().catch(() => ({ count: 0 })) as { count: string | number }
  const home = currentOrgId() === HOME_ORG_ID
  return [
    {
      id: 'web_chat',
      name: 'Website chat',
      description: 'The "Chat with us" button on your support portal, and on your own website with the embed code.',
      state: webChat.enabled ? 'connected' : 'off',
      enabled: webChat.enabled,
      detail: webChat.enabled ? (aiAgent ? `${aiAgent.name} (AI) answers first` : 'Goes straight to the team') : 'Customers don\'t see the chat button',
      config: { title: webChat.config.title ?? '', launcher: webChat.config.launcher ?? '' },
    },
    { id: 'portal', name: 'Support portal', description: 'Customers raise and follow requests, read help articles and chat.', state: 'connected', detail: 'Always on' },
    {
      id: 'email',
      name: 'Email',
      description: 'Emails to the support inbox become tickets; replies go back by email.',
      state: home && config.gmailRefreshToken ? 'connected' : 'setup',
      detail: home ? (config.gmailRefreshToken ? `Inbox: ${config.gmailSender || 'connected'}` : 'Set NUXT_GMAIL_REFRESH_TOKEN to connect the inbox') : 'Email-to-ticket runs from Canopy\'s support inbox for now',
    },
    { id: 'api', name: 'API', description: 'Create tickets from your own systems with an API key.', state: Number(keys.count) ? 'connected' : 'setup', detail: Number(keys.count) ? `${keys.count} key${Number(keys.count) === 1 ? '' : 's'}` : 'No API keys yet' },
    { id: 'whatsapp', name: 'WhatsApp', description: 'Chat with customers on WhatsApp Business.', state: 'soon' },
    { id: 'telegram', name: 'Telegram', description: 'Chat with customers through a Telegram bot.', state: 'soon' },
  ]
}
