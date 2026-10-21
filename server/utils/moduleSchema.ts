/**
 * Tables for the Knowledge base, Live chat, Field Service and Marketing apps. Called at the end of
 * `migrate()` in server/utils/db.ts, so every company database gets them. Canopy Care lives in the
 * control plane instead (server/utils/care.ts), because it spans companies.
 */
export async function migrateModuleTables() {
  const db = useTenantDb()

  // ── Knowledge base ───────────────────────────────────────────────────────
  await db.exec(`
    CREATE TABLE IF NOT EXISTS kb_articles (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      body TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'draft',
      visibility TEXT NOT NULL DEFAULT 'internal',
      products TEXT,
      reviewer_id TEXT,
      source_ticket_id TEXT,
      author_id TEXT,
      author_name TEXT,
      version INTEGER NOT NULL DEFAULT 1,
      views INTEGER NOT NULL DEFAULT 0,
      helpful_yes INTEGER NOT NULL DEFAULT 0,
      helpful_no INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      published_at TEXT
    )
  `)
  await db.exec('CREATE INDEX IF NOT EXISTS idx_kb_articles_status ON kb_articles (status, visibility)')

  // ── Live chat ────────────────────────────────────────────────────────────
  await db.exec(`
    CREATE TABLE IF NOT EXISTS live_chats (
      id TEXT PRIMARY KEY,
      token TEXT NOT NULL UNIQUE,
      visitor_name TEXT NOT NULL,
      visitor_email TEXT NOT NULL,
      client_id TEXT,
      status TEXT NOT NULL DEFAULT 'waiting',
      assignee_id TEXT,
      assignee_name TEXT,
      ticket_id TEXT,
      subject TEXT,
      started_at TEXT NOT NULL,
      first_response_at TEXT,
      last_message_at TEXT NOT NULL,
      closed_at TEXT,
      care_handled INTEGER NOT NULL DEFAULT 0
    )
  `)
  await db.exec('CREATE INDEX IF NOT EXISTS idx_live_chats_status ON live_chats (status, last_message_at)')
  await db.exec(`
    CREATE TABLE IF NOT EXISTS live_chat_messages (
      id TEXT PRIMARY KEY,
      chat_id TEXT NOT NULL,
      author_type TEXT NOT NULL,
      author_id TEXT,
      author_name TEXT NOT NULL,
      body TEXT NOT NULL,
      created_at TEXT NOT NULL
    )
  `)
  await db.exec('CREATE INDEX IF NOT EXISTS idx_live_chat_messages_chat ON live_chat_messages (chat_id, created_at)')
  // Replies a Canopy Care agent wrote on the company's behalf (server/utils/care.ts).
  await db.exec('ALTER TABLE ticket_replies ADD COLUMN IF NOT EXISTS care_agent INTEGER NOT NULL DEFAULT 0')

  // Satisfaction survey sent when a ticket is resolved (/survey/<workspace>/<token>).
  await db.exec(`
    CREATE TABLE IF NOT EXISTS ticket_surveys (
      id TEXT PRIMARY KEY,
      token TEXT NOT NULL UNIQUE,
      ticket_id TEXT NOT NULL,
      email TEXT NOT NULL,
      rating INTEGER,
      comment TEXT,
      sent_at TEXT NOT NULL,
      responded_at TEXT
    )
  `)
  await db.exec('CREATE INDEX IF NOT EXISTS idx_ticket_surveys_ticket ON ticket_surveys (ticket_id)')

  // Customer service per client and project: the project's active AMC contract sets the SLA.
  await db.exec('ALTER TABLE tickets ADD COLUMN IF NOT EXISTS client_id TEXT')
  await db.exec('ALTER TABLE tickets ADD COLUMN IF NOT EXISTS project_id TEXT')
  await db.exec('ALTER TABLE tickets ADD COLUMN IF NOT EXISTS contract_id TEXT')
  await db.exec('CREATE INDEX IF NOT EXISTS idx_tickets_client ON tickets (client_id)')
  await db.exec('CREATE INDEX IF NOT EXISTS idx_tickets_project ON tickets (project_id)')
  // Per-plan SLA targets: { [priority]: { firstResponseMins, resolutionMins } }; empty = company default.
  await db.exec('ALTER TABLE amc_plans ADD COLUMN IF NOT EXISTS sla_targets TEXT')

  // ── Field Service ────────────────────────────────────────────────────────
  await db.exec('ALTER TABLE staff ADD COLUMN IF NOT EXISTS skills TEXT')
  await db.exec(`
    CREATE TABLE IF NOT EXISTS field_assets (
      id TEXT PRIMARY KEY,
      client_id TEXT,
      name TEXT NOT NULL,
      model TEXT,
      serial TEXT,
      location TEXT,
      installed_at TEXT,
      notes TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `)
  await db.exec(`
    CREATE TABLE IF NOT EXISTS work_orders (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT,
      client_id TEXT,
      ticket_id TEXT,
      asset_id TEXT,
      location TEXT,
      priority TEXT NOT NULL DEFAULT 'medium',
      skill TEXT,
      duration_minutes INTEGER NOT NULL DEFAULT 60,
      sla_due_at TEXT,
      status TEXT NOT NULL DEFAULT 'unscheduled',
      technician_id TEXT,
      scheduled_start TEXT,
      tasks TEXT NOT NULL DEFAULT '[]',
      photos TEXT NOT NULL DEFAULT '[]',
      signature_url TEXT,
      signed_by TEXT,
      resolution_notes TEXT,
      travel_started_at TEXT,
      started_at TEXT,
      completed_at TEXT,
      created_by TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `)
  await db.exec('CREATE INDEX IF NOT EXISTS idx_work_orders_schedule ON work_orders (technician_id, scheduled_start)')
  await db.exec(`
    CREATE TABLE IF NOT EXISTS technician_unavailability (
      id TEXT PRIMARY KEY,
      technician_id TEXT NOT NULL,
      start_at TEXT NOT NULL,
      end_at TEXT NOT NULL,
      reason TEXT,
      created_at TEXT NOT NULL
    )
  `)

  // ── Marketing ────────────────────────────────────────────────────────────
  await db.exec(`
    CREATE TABLE IF NOT EXISTS marketing_segments (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      conditions TEXT NOT NULL DEFAULT '[]',
      created_by TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `)
  await db.exec(`
    CREATE TABLE IF NOT EXISTS marketing_journeys (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'draft',
      trigger_type TEXT NOT NULL DEFAULT 'segment',
      segment_id TEXT,
      steps TEXT NOT NULL DEFAULT '[]',
      quiet_start TEXT,
      quiet_end TEXT,
      exit_after_days INTEGER,
      published_at TEXT,
      created_by TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `)
  await db.exec(`
    CREATE TABLE IF NOT EXISTS journey_enrollments (
      id TEXT PRIMARY KEY,
      journey_id TEXT NOT NULL,
      contact_key TEXT NOT NULL,
      email TEXT NOT NULL,
      name TEXT,
      path TEXT NOT NULL DEFAULT '[0]',
      status TEXT NOT NULL DEFAULT 'active',
      next_run_at TEXT NOT NULL,
      last_message_id TEXT,
      entered_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      UNIQUE (journey_id, contact_key)
    )
  `)
  await db.exec('CREATE INDEX IF NOT EXISTS idx_journey_enrollments_due ON journey_enrollments (status, next_run_at)')
  await db.exec(`
    CREATE TABLE IF NOT EXISTS journey_messages (
      id TEXT PRIMARY KEY,
      enrollment_id TEXT NOT NULL,
      journey_id TEXT NOT NULL,
      step_id TEXT NOT NULL,
      email TEXT NOT NULL,
      subject TEXT NOT NULL,
      sent_at TEXT NOT NULL,
      opened_at TEXT,
      clicked_at TEXT
    )
  `)
  await db.exec('CREATE INDEX IF NOT EXISTS idx_journey_messages_journey ON journey_messages (journey_id)')
  await db.exec(`
    CREATE TABLE IF NOT EXISTS marketing_suppressions (
      email TEXT PRIMARY KEY,
      reason TEXT NOT NULL,
      created_at TEXT NOT NULL
    )
  `)

  // ── Canopy HQ access (only read in Canopy's own workspace) ──────────────
  // 'admin' = runs HQ (clients, onboarding, Care); 'agent' = Care agent desktop; NULL = workspace only.
  const hqColumn = await db.prepare(`SELECT 1 FROM information_schema.columns WHERE table_name = 'staff' AND column_name = 'hq_role'`).get()
  if (!hqColumn) {
    await db.exec('ALTER TABLE staff ADD COLUMN IF NOT EXISTS hq_role TEXT')
    // HQ used to mean "admin of Canopy's workspace" — keep those people in.
    if (currentOrgId() === HOME_ORG_ID) {
      await db.exec(`UPDATE staff SET hq_role = 'admin' WHERE roles LIKE '%"admin"%' OR role = 'admin'`)
      // …and anyone already assigned to a Care client keeps the agent desktop.
      const engagements = await useControlDb().prepare('SELECT agent_ids FROM cp_care_engagements').all().catch(() => []) as { agent_ids: string }[]
      for (const agentId of new Set(engagements.flatMap(row => JSON.parse(row.agent_ids) as string[])))
        await db.prepare(`UPDATE staff SET hq_role = 'agent' WHERE id = ? AND hq_role IS NULL`).run(agentId)
    }
  }
}

/** Next id like "KB-0007" from a named counter. */
export async function nextPrefixedId(counter: string, prefix: string, pad = 4) {
  const n = await nextSequence(counter)
  return `${prefix}-${String(n).padStart(pad, '0')}`
}
