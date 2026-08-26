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

  await db.exec('ALTER TABLE staff ADD COLUMN IF NOT EXISTS roles TEXT')
  await db.exec(`UPDATE staff SET roles = '["' || role || '"]' WHERE roles IS NULL`)

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

  await db.exec('ALTER TABLE tickets ADD COLUMN IF NOT EXISTS assignee_id TEXT')
  await db.exec('ALTER TABLE tickets ADD COLUMN IF NOT EXISTS due_at TEXT')
  await db.exec('ALTER TABLE tickets ADD COLUMN IF NOT EXISTS first_response_due_at TEXT')
  await db.exec('ALTER TABLE tickets ADD COLUMN IF NOT EXISTS first_response_at TEXT')
  await db.exec('ALTER TABLE tickets ADD COLUMN IF NOT EXISTS resolved_at TEXT')
  await db.exec('ALTER TABLE tickets ADD COLUMN IF NOT EXISTS closed_at TEXT')
  await db.exec('ALTER TABLE tickets ADD COLUMN IF NOT EXISTS sla_escalated INTEGER NOT NULL DEFAULT 0')
  await db.exec('ALTER TABLE tickets ADD COLUMN IF NOT EXISTS updated_at TEXT')

  await db.exec(`
    CREATE TABLE IF NOT EXISTS ticket_replies (
      id TEXT PRIMARY KEY,
      ticket_id TEXT NOT NULL,
      author TEXT NOT NULL,
      message TEXT NOT NULL,
      created_at TEXT NOT NULL
    )
  `)

  await db.exec('ALTER TABLE ticket_replies ADD COLUMN IF NOT EXISTS internal INTEGER NOT NULL DEFAULT 0')
  await db.exec('ALTER TABLE ticket_replies ADD COLUMN IF NOT EXISTS author_id TEXT')
  await db.exec('ALTER TABLE ticket_replies ADD COLUMN IF NOT EXISTS author_type TEXT NOT NULL DEFAULT \'customer\'')

  await db.exec(`
    CREATE TABLE IF NOT EXISTS ticket_activity (
      id TEXT PRIMARY KEY,
      ticket_id TEXT NOT NULL,
      type TEXT NOT NULL,
      actor_id TEXT,
      actor_name TEXT,
      from_value TEXT,
      to_value TEXT,
      message TEXT,
      created_at TEXT NOT NULL
    )
  `)

  await db.exec(`
    CREATE TABLE IF NOT EXISTS tags (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      color TEXT NOT NULL DEFAULT 'gray',
      created_at TEXT NOT NULL
    )
  `)

  await db.exec(`
    CREATE TABLE IF NOT EXISTS ticket_tags (
      ticket_id TEXT NOT NULL,
      tag_id TEXT NOT NULL,
      PRIMARY KEY (ticket_id, tag_id)
    )
  `)

  await db.exec(`
    CREATE TABLE IF NOT EXISTS sla_policies (
      id TEXT PRIMARY KEY,
      priority TEXT NOT NULL UNIQUE,
      first_response_mins INTEGER NOT NULL,
      resolution_mins INTEGER NOT NULL,
      created_at TEXT NOT NULL
    )
  `)

  await db.exec(`
    CREATE TABLE IF NOT EXISTS macros (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      body TEXT NOT NULL,
      set_status TEXT,
      set_priority TEXT,
      add_tag_id TEXT,
      created_at TEXT NOT NULL
    )
  `)

  await db.exec(`
    CREATE TABLE IF NOT EXISTS automation_rules (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      enabled INTEGER NOT NULL DEFAULT 1,
      field TEXT NOT NULL,
      operator TEXT NOT NULL,
      value TEXT NOT NULL,
      set_priority TEXT,
      set_status TEXT,
      set_assignee_id TEXT,
      add_tag_id TEXT,
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
    CREATE TABLE IF NOT EXISTS notifications (
      id TEXT PRIMARY KEY,
      staff_id TEXT NOT NULL,
      type TEXT NOT NULL,
      title TEXT NOT NULL,
      body TEXT NOT NULL,
      url TEXT,
      ticket_id TEXT,
      read INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    )
  `)

  await db.exec('ALTER TABLE notifications ADD COLUMN IF NOT EXISTS task_id TEXT')
  await db.exec('ALTER TABLE notifications ADD COLUMN IF NOT EXISTS lead_id TEXT')
  await db.exec('ALTER TABLE notifications ADD COLUMN IF NOT EXISTS read_at TEXT')

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

  await db.exec(`
    CREATE TABLE IF NOT EXISTS clients (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      contact_name TEXT,
      contact_email TEXT,
      contact_phone TEXT,
      stage TEXT NOT NULL DEFAULT 'lead',
      notes TEXT,
      assigned_to TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `)

  await db.exec(`
    CREATE TABLE IF NOT EXISTS client_activity (
      id TEXT PRIMARY KEY,
      client_id TEXT NOT NULL,
      type TEXT NOT NULL,
      actor_id TEXT,
      actor_name TEXT,
      from_value TEXT,
      to_value TEXT,
      message TEXT,
      created_at TEXT NOT NULL
    )
  `)

  await db.exec(`
    CREATE TABLE IF NOT EXISTS amc_plans (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      default_duration_months INTEGER NOT NULL DEFAULT 12,
      price NUMERIC,
      created_at TEXT NOT NULL
    )
  `)

  await db.exec(`
    CREATE TABLE IF NOT EXISTS client_amc_contracts (
      id TEXT PRIMARY KEY,
      client_id TEXT NOT NULL,
      plan_id TEXT NOT NULL,
      start_date TEXT NOT NULL,
      end_date TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'active',
      reminder_30d_sent INTEGER NOT NULL DEFAULT 0,
      reminder_7d_sent INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    )
  `)

  await db.exec(`
    CREATE TABLE IF NOT EXISTS leads (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      contact_name TEXT,
      contact_email TEXT,
      contact_phone TEXT,
      source TEXT,
      stage TEXT NOT NULL DEFAULT 'new',
      notes TEXT,
      assigned_to TEXT,
      converted_client_id TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `)

  await db.exec('ALTER TABLE leads ADD COLUMN IF NOT EXISTS next_step TEXT')
  await db.exec('ALTER TABLE leads ADD COLUMN IF NOT EXISTS next_step_at TEXT')
  await db.exec('ALTER TABLE leads ADD COLUMN IF NOT EXISTS next_step_reminder_sent INTEGER NOT NULL DEFAULT 0')

  await db.exec(`
    CREATE TABLE IF NOT EXISTS lead_activity (
      id TEXT PRIMARY KEY,
      lead_id TEXT NOT NULL,
      type TEXT NOT NULL,
      actor_id TEXT,
      actor_name TEXT,
      from_value TEXT,
      to_value TEXT,
      message TEXT,
      created_at TEXT NOT NULL
    )
  `)

  await db.exec(`
    CREATE TABLE IF NOT EXISTS tasks (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL DEFAULT 'task',
      title TEXT NOT NULL,
      description TEXT,
      status TEXT NOT NULL DEFAULT 'todo',
      priority TEXT NOT NULL DEFAULT 'medium',
      color TEXT,
      assignee_id TEXT,
      epic_id TEXT,
      parent_task_id TEXT,
      start_date TEXT,
      due_date TEXT,
      remind_at TEXT,
      reminder_sent INTEGER NOT NULL DEFAULT 0,
      created_by TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `)

  await db.exec(`
    CREATE TABLE IF NOT EXISTS task_assignees (
      task_id TEXT NOT NULL,
      staff_id TEXT NOT NULL,
      PRIMARY KEY (task_id, staff_id)
    )
  `)

  await db.exec(`
    CREATE TABLE IF NOT EXISTS lead_assignees (
      lead_id TEXT NOT NULL,
      staff_id TEXT NOT NULL,
      PRIMARY KEY (lead_id, staff_id)
    )
  `)

  await db.exec(`
    CREATE TABLE IF NOT EXISTS task_statuses (
      id TEXT PRIMARY KEY,
      label TEXT NOT NULL,
      position INTEGER NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `)

  await db.exec(`
    CREATE TABLE IF NOT EXISTS integration_state (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    )
  `)

  await db.exec(`
    CREATE TABLE IF NOT EXISTS rate_limit_counters (
      scope TEXT NOT NULL,
      key TEXT NOT NULL,
      window_start TEXT NOT NULL,
      count INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (scope, key, window_start)
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

export async function nextNotificationId() {
  const n = await nextSequence('notification')
  return `NOTIF-${n}`
}

export async function nextActivityId() {
  const n = await nextSequence('activity')
  return `ACT-${n}`
}

export async function nextTagId() {
  const n = await nextSequence('tag')
  return `TAG-${n}`
}

export async function nextMacroId() {
  const n = await nextSequence('macro')
  return `MACRO-${n}`
}

export async function nextRuleId() {
  const n = await nextSequence('rule')
  return `RULE-${n}`
}

export async function nextClientId() {
  const n = await nextSequence('client')
  return `CLIENT-${1000 + n}`
}

export async function nextClientActivityId() {
  const n = await nextSequence('client_activity')
  return `CACT-${n}`
}

export async function nextAmcPlanId() {
  const n = await nextSequence('amc_plan')
  return `PLAN-${n}`
}

export async function nextContractId() {
  const n = await nextSequence('contract')
  return `CONTRACT-${n}`
}

export async function nextLeadId() {
  const n = await nextSequence('lead')
  return `LEAD-${n}`
}

export async function nextLeadActivityId() {
  const n = await nextSequence('lead_activity')
  return `LACT-${n}`
}

export async function nextTaskId() {
  const n = await nextSequence('task')
  return `TASK-${n}`
}

export async function nextTaskStatusId() {
  const n = await nextSequence('task_status')
  return `STATUS-${n}`
}
