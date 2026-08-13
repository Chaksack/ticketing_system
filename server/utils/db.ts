let ready: Promise<void> | null = null

export function ensureDb() {
  if (!ready)
    ready = migrate()

  return ready
}

async function migrate() {
  const db = useDatabase()

  await db.exec(`
    CREATE TABLE IF NOT EXISTS staff (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      role TEXT NOT NULL DEFAULT 'agent',
      status TEXT NOT NULL DEFAULT 'active',
      on_call INTEGER NOT NULL DEFAULT 0,
      password_hash TEXT,
      invite_token TEXT,
      invite_expires_at TEXT,
      reset_token TEXT,
      reset_expires_at TEXT,
      created_at TEXT NOT NULL
    )
  `)

  await db.exec('ALTER TABLE staff ADD COLUMN IF NOT EXISTS reset_token TEXT')
  await db.exec('ALTER TABLE staff ADD COLUMN IF NOT EXISTS reset_expires_at TEXT')

  await db.exec(`
    CREATE TABLE IF NOT EXISTS tickets (
      id TEXT PRIMARY KEY,
      subject TEXT NOT NULL,
      description TEXT NOT NULL,
      requester TEXT NOT NULL,
      requester_email TEXT NOT NULL,
      category TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'open',
      priority TEXT NOT NULL DEFAULT 'medium',
      reference_number TEXT,
      attachments TEXT,
      created_at TEXT NOT NULL
    )
  `)

  await db.exec(`
    CREATE TABLE IF NOT EXISTS ticket_replies (
      id TEXT PRIMARY KEY,
      ticket_id TEXT NOT NULL,
      author TEXT NOT NULL,
      message TEXT NOT NULL,
      created_at TEXT NOT NULL
    )
  `)

  await db.exec(`
    CREATE TABLE IF NOT EXISTS pages (
      id TEXT PRIMARY KEY,
      ticket_id TEXT NOT NULL,
      ticket_subject TEXT NOT NULL,
      staff_id TEXT NOT NULL,
      staff_name TEXT NOT NULL,
      created_at TEXT NOT NULL,
      acknowledged INTEGER NOT NULL DEFAULT 0
    )
  `)

  await db.exec(`
    CREATE TABLE IF NOT EXISTS push_subscriptions (
      id TEXT PRIMARY KEY,
      staff_id TEXT NOT NULL,
      endpoint TEXT NOT NULL UNIQUE,
      p256dh TEXT NOT NULL,
      auth TEXT NOT NULL,
      created_at TEXT NOT NULL
    )
  `)

  await db.exec(`
    CREATE TABLE IF NOT EXISTS counters (
      name TEXT PRIMARY KEY,
      value INTEGER NOT NULL
    )
  `)
}

export async function nextSequence(name: string): Promise<number> {
  await ensureDb()
  const db = useDatabase()

  const row = await db.prepare('SELECT value FROM counters WHERE name = ?').get(name) as { value: number } | undefined
  const next = (row?.value ?? 0) + 1

  if (row)
    await db.prepare('UPDATE counters SET value = ? WHERE name = ?').run(next, name)
  else
    await db.prepare('INSERT INTO counters (name, value) VALUES (?, ?)').run(name, next)

  return next
}

export async function nextTicketId() {
  const n = await nextSequence('ticket')
  return `TICKET-${1000 + n}`
}

export async function nextStaffId() {
  const n = await nextSequence('staff')
  return `STAFF-${n.toString().padStart(3, '0')}`
}

export async function nextReplyId() {
  const n = await nextSequence('reply')
  return `REPLY-${n}`
}

export async function nextPageId() {
  const n = await nextSequence('page')
  return `PAGE-${n}`
}
