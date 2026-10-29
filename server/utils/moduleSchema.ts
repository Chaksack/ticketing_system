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

  // ── AI agents (server/utils/aiAgent.ts) ──────────────────────────────────
  await db.exec(`
    CREATE TABLE IF NOT EXISTS ai_agents (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      enabled INTEGER NOT NULL DEFAULT 0,
      config TEXT NOT NULL,
      sort_no INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      updated_by TEXT
    )
  `)
  // One row ('default'): the workspace's own AI connection for agents. api_key is encrypted.
  await db.exec(`
    CREATE TABLE IF NOT EXISTS ai_model_settings (
      id TEXT PRIMARY KEY,
      provider TEXT NOT NULL DEFAULT 'company',
      model TEXT,
      base_url TEXT,
      api_key TEXT,
      updated_at TEXT NOT NULL
    )
  `)
  await db.exec(`
    CREATE TABLE IF NOT EXISTS ai_agent_runs (
      id TEXT PRIMARY KEY,
      agent_id TEXT NOT NULL,
      chat_id TEXT,
      question TEXT NOT NULL,
      outcome TEXT NOT NULL,
      reply TEXT,
      sources TEXT NOT NULL DEFAULT '[]',
      steps TEXT NOT NULL DEFAULT '[]',
      handoff_reason TEXT,
      error TEXT,
      input_tokens INTEGER NOT NULL DEFAULT 0,
      output_tokens INTEGER NOT NULL DEFAULT 0,
      latency_ms INTEGER NOT NULL DEFAULT 0,
      dry_run INTEGER NOT NULL DEFAULT 0,
      gap_article_id TEXT,
      created_at TEXT NOT NULL
    )
  `)
  await db.exec('CREATE INDEX IF NOT EXISTS idx_ai_agent_runs_agent ON ai_agent_runs (agent_id, created_at)')
  await db.exec('CREATE INDEX IF NOT EXISTS idx_ai_agent_runs_chat ON ai_agent_runs (chat_id)')
  await db.exec('ALTER TABLE live_chats ADD COLUMN IF NOT EXISTS ai_agent_id TEXT')
  // When the AI started writing a reply (cleared when it's done) — drives the visitor's typing dots.
  await db.exec('ALTER TABLE live_chats ADD COLUMN IF NOT EXISTS ai_thinking_at TEXT')
  await db.exec('ALTER TABLE live_chats ADD COLUMN IF NOT EXISTS handoff_reason TEXT')
  await db.exec('ALTER TABLE live_chats ADD COLUMN IF NOT EXISTS handed_off_at TEXT')

  // ── Support desk (server/utils/supportDesk.ts) ───────────────────────────
  // Tags on live chats (the same tags as tickets).
  await db.exec(`
    CREATE TABLE IF NOT EXISTS live_chat_tags (
      chat_id TEXT NOT NULL,
      tag_id TEXT NOT NULL,
      PRIMARY KEY (chat_id, tag_id)
    )
  `)
  // Customer profile details the team adds (customers themselves are everyone who raised a ticket or chatted).
  await db.exec(`
    CREATE TABLE IF NOT EXISTS customer_profiles (
      email TEXT PRIMARY KEY,
      name TEXT,
      phone TEXT,
      notes TEXT,
      updated_at TEXT NOT NULL,
      updated_by TEXT
    )
  `)
  // Weekly support rota: weekday 0 = Sunday … 6 = Saturday, times HH:MM in the workspace time zone.
  await db.exec(`
    CREATE TABLE IF NOT EXISTS support_shifts (
      id TEXT PRIMARY KEY,
      staff_id TEXT NOT NULL,
      weekday INTEGER NOT NULL,
      start_time TEXT NOT NULL,
      end_time TEXT NOT NULL,
      created_at TEXT NOT NULL
    )
  `)
  await db.exec('CREATE INDEX IF NOT EXISTS idx_support_shifts_staff ON support_shifts (staff_id)')
  // Workspace-wide settings by key (e.g. 'time_zone').
  await db.exec(`
    CREATE TABLE IF NOT EXISTS workspace_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `)
  // Channel switches and settings ('web_chat', …).
  await db.exec(`
    CREATE TABLE IF NOT EXISTS support_channels (
      id TEXT PRIMARY KEY,
      enabled INTEGER NOT NULL DEFAULT 1,
      config TEXT NOT NULL DEFAULT '{}',
      updated_at TEXT NOT NULL
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
