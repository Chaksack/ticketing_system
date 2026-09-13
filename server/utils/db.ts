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

  await db.exec('ALTER TABLE staff ADD COLUMN IF NOT EXISTS avatar_url TEXT')

  // Per-staff Gmail OAuth connection (distinct from the single shared support-inbox token in
  // NUXT_GMAIL_REFRESH_TOKEN) — lets each staff member connect their own Gmail account for the
  // personal Mail feature.
  await db.exec('ALTER TABLE staff ADD COLUMN IF NOT EXISTS gmail_email TEXT')
  await db.exec('ALTER TABLE staff ADD COLUMN IF NOT EXISTS gmail_refresh_token TEXT')
  await db.exec('ALTER TABLE staff ADD COLUMN IF NOT EXISTS gmail_connected_at TEXT')

  // Presence: last_active_at drives auto online/away detection (client heartbeat), while
  // presence_override lets a staff member explicitly force "in a meeting" / "offline" — an
  // override always wins over the auto-detected state. Custom status (emoji + text, with an
  // optional expiry) layers on top independently, same as Slack.
  await db.exec('ALTER TABLE staff ADD COLUMN IF NOT EXISTS last_active_at TEXT')
  await db.exec('ALTER TABLE staff ADD COLUMN IF NOT EXISTS presence_override TEXT NOT NULL DEFAULT \'auto\'')
  await db.exec('ALTER TABLE staff ADD COLUMN IF NOT EXISTS status_text TEXT')
  await db.exec('ALTER TABLE staff ADD COLUMN IF NOT EXISTS status_emoji TEXT')
  await db.exec('ALTER TABLE staff ADD COLUMN IF NOT EXISTS status_expires_at TEXT')

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
  await db.exec('ALTER TABLE tickets ADD COLUMN IF NOT EXISTS escalation_level TEXT')

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
  await db.exec('ALTER TABLE notifications ADD COLUMN IF NOT EXISTS contract_id TEXT')

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
    CREATE TABLE IF NOT EXISTS client_assignees (
      client_id TEXT NOT NULL,
      staff_id TEXT NOT NULL,
      PRIMARY KEY (client_id, staff_id)
    )
  `)

  await db.exec(`
    CREATE TABLE IF NOT EXISTS lead_contact_emails (
      id TEXT PRIMARY KEY,
      lead_id TEXT NOT NULL,
      email TEXT NOT NULL,
      label TEXT,
      created_at TEXT NOT NULL
    )
  `)

  await db.exec(`
    CREATE TABLE IF NOT EXISTS lead_contact_phones (
      id TEXT PRIMARY KEY,
      lead_id TEXT NOT NULL,
      phone TEXT NOT NULL,
      label TEXT,
      created_at TEXT NOT NULL
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

  await db.exec('ALTER TABLE amc_plans ADD COLUMN IF NOT EXISTS currency TEXT NOT NULL DEFAULT \'GHS\'')

  await db.exec(`
    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY,
      client_id TEXT NOT NULL,
      name TEXT NOT NULL,
      description TEXT,
      status TEXT NOT NULL DEFAULT 'planned',
      start_date TEXT,
      end_date TEXT,
      erp_project_id TEXT,
      created_by TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
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

  // Nullable: existing contracts predate Projects and stay client-level ("legacy"); every new
  // contract is created through a project going forward.
  await db.exec('ALTER TABLE client_amc_contracts ADD COLUMN IF NOT EXISTS project_id TEXT')

  // Follow-up tracking, mirroring leads' next_step / next_step_at / reminder pattern.
  await db.exec('ALTER TABLE client_amc_contracts ADD COLUMN IF NOT EXISTS next_step TEXT')
  await db.exec('ALTER TABLE client_amc_contracts ADD COLUMN IF NOT EXISTS next_step_at TEXT')
  await db.exec('ALTER TABLE client_amc_contracts ADD COLUMN IF NOT EXISTS next_step_reminder_sent INTEGER NOT NULL DEFAULT 0')

  await db.exec(`
    CREATE TABLE IF NOT EXISTS client_contact_emails (
      id TEXT PRIMARY KEY,
      client_id TEXT NOT NULL,
      email TEXT NOT NULL,
      label TEXT,
      created_at TEXT NOT NULL
    )
  `)

  await db.exec(`
    CREATE TABLE IF NOT EXISTS client_contact_phones (
      id TEXT PRIMARY KEY,
      client_id TEXT NOT NULL,
      phone TEXT NOT NULL,
      label TEXT,
      created_at TEXT NOT NULL
    )
  `)

  await db.exec(`
    CREATE TABLE IF NOT EXISTS client_contacts (
      id TEXT PRIMARY KEY,
      client_id TEXT NOT NULL,
      name TEXT NOT NULL,
      title TEXT,
      email TEXT,
      phone TEXT,
      is_primary INTEGER NOT NULL DEFAULT 0,
      notes TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `)

  await db.exec('ALTER TABLE clients ADD COLUMN IF NOT EXISTS estimated_value NUMERIC')

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
  await db.exec('ALTER TABLE leads ADD COLUMN IF NOT EXISTS estimated_value NUMERIC')

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
    CREATE TABLE IF NOT EXISTS tenders (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      issuing_authority TEXT,
      reference_number TEXT,
      contact_name TEXT,
      contact_email TEXT,
      contact_phone TEXT,
      source TEXT,
      stage TEXT NOT NULL DEFAULT 'identified',
      estimated_value NUMERIC,
      submission_deadline TEXT,
      deadline_reminder_sent INTEGER NOT NULL DEFAULT 0,
      notes TEXT,
      converted_client_id TEXT,
      created_by TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `)

  await db.exec(`
    CREATE TABLE IF NOT EXISTS tender_activity (
      id TEXT PRIMARY KEY,
      tender_id TEXT NOT NULL,
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
    CREATE TABLE IF NOT EXISTS tender_assignees (
      tender_id TEXT NOT NULL,
      staff_id TEXT NOT NULL,
      PRIMARY KEY (tender_id, staff_id)
    )
  `)

  await db.exec(`
    CREATE TABLE IF NOT EXISTS tender_documents (
      id TEXT PRIMARY KEY,
      tender_id TEXT NOT NULL,
      name TEXT NOT NULL,
      url TEXT NOT NULL,
      type TEXT,
      size INTEGER,
      uploaded_by TEXT,
      created_at TEXT NOT NULL
    )
  `)

  await db.exec(`
    CREATE TABLE IF NOT EXISTS lead_documents (
      id TEXT PRIMARY KEY,
      lead_id TEXT NOT NULL,
      name TEXT NOT NULL,
      url TEXT NOT NULL,
      type TEXT,
      size INTEGER,
      uploaded_by TEXT,
      created_at TEXT NOT NULL
    )
  `)

  await db.exec(`
    CREATE TABLE IF NOT EXISTS client_documents (
      id TEXT PRIMARY KEY,
      client_id TEXT NOT NULL,
      name TEXT NOT NULL,
      url TEXT NOT NULL,
      type TEXT,
      size INTEGER,
      uploaded_by TEXT,
      created_at TEXT NOT NULL
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

  await db.exec(`
    CREATE TABLE IF NOT EXISTS chat_channels (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL DEFAULT 'group',
      name TEXT,
      created_by TEXT,
      created_at TEXT NOT NULL
    )
  `)

  await db.exec('ALTER TABLE chat_channels ADD COLUMN IF NOT EXISTS project_id TEXT')

  await db.exec(`
    CREATE TABLE IF NOT EXISTS chat_channel_members (
      channel_id TEXT NOT NULL,
      staff_id TEXT NOT NULL,
      joined_at TEXT NOT NULL,
      last_read_at TEXT,
      PRIMARY KEY (channel_id, staff_id)
    )
  `)

  await db.exec(`
    CREATE TABLE IF NOT EXISTS chat_messages (
      id TEXT PRIMARY KEY,
      channel_id TEXT NOT NULL,
      author_id TEXT NOT NULL,
      body TEXT NOT NULL,
      created_at TEXT NOT NULL,
      edited_at TEXT
    )
  `)

  await db.exec('ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS attachment_url TEXT')
  await db.exec('ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS attachment_name TEXT')
  await db.exec('ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS attachment_type TEXT')
  await db.exec('ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS attachment_size INTEGER')

  await db.exec(`
    CREATE TABLE IF NOT EXISTS chat_message_reactions (
      id TEXT PRIMARY KEY,
      message_id TEXT NOT NULL,
      staff_id TEXT NOT NULL,
      emoji TEXT NOT NULL,
      created_at TEXT NOT NULL,
      UNIQUE(message_id, staff_id, emoji)
    )
  `)

  await db.exec(`
    CREATE TABLE IF NOT EXISTS calendar_events (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT,
      location TEXT,
      start_at TEXT NOT NULL,
      end_at TEXT NOT NULL,
      created_by TEXT,
      reminder_sent INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `)

  await db.exec(`
    CREATE TABLE IF NOT EXISTS calendar_event_attendees (
      event_id TEXT NOT NULL,
      staff_id TEXT NOT NULL,
      PRIMARY KEY (event_id, staff_id)
    )
  `)

  await db.exec('ALTER TABLE calendar_events ADD COLUMN IF NOT EXISTS regarding_type TEXT')
  await db.exec('ALTER TABLE calendar_events ADD COLUMN IF NOT EXISTS regarding_id TEXT')
  await db.exec('ALTER TABLE calendar_events ADD COLUMN IF NOT EXISTS activity_type TEXT')

  await db.exec('ALTER TABLE notifications ADD COLUMN IF NOT EXISTS event_id TEXT')

  await db.exec(`
    CREATE TABLE IF NOT EXISTS interactions (
      id TEXT PRIMARY KEY,
      regarding_type TEXT NOT NULL,
      regarding_id TEXT NOT NULL,
      type TEXT NOT NULL,
      subject TEXT,
      body TEXT,
      direction TEXT,
      gmail_message_id TEXT,
      gmail_thread_id TEXT,
      calendar_event_id TEXT,
      occurred_at TEXT NOT NULL,
      logged_by TEXT,
      created_at TEXT NOT NULL
    )
  `)

  await db.exec(`
    CREATE TABLE IF NOT EXISTS ml_models (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      weights TEXT NOT NULL,
      trained_at TEXT NOT NULL,
      training_examples INTEGER NOT NULL,
      metrics TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `)

  await db.exec(`
    CREATE TABLE IF NOT EXISTS staff_integrations (
      id TEXT PRIMARY KEY,
      staff_id TEXT NOT NULL,
      provider TEXT NOT NULL,
      access_token TEXT,
      refresh_token TEXT,
      token_expires_at TEXT,
      scope TEXT,
      external_account_id TEXT,
      external_account_label TEXT,
      metadata TEXT,
      connected_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      UNIQUE(staff_id, provider)
    )
  `)

  await db.exec(`
    CREATE TABLE IF NOT EXISTS sprints (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      goal TEXT,
      status TEXT NOT NULL DEFAULT 'planned',
      start_date TEXT,
      end_date TEXT,
      created_by TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `)

  await db.exec('ALTER TABLE tasks ADD COLUMN IF NOT EXISTS sprint_id TEXT')
  await db.exec('ALTER TABLE tasks ADD COLUMN IF NOT EXISTS project_id TEXT')

  await db.exec(`
    CREATE TABLE IF NOT EXISTS bd_automation_rules (
      id TEXT PRIMARY KEY,
      entity_type TEXT NOT NULL,
      trigger TEXT NOT NULL,
      field TEXT,
      operator TEXT,
      value TEXT,
      to_stage TEXT,
      set_assignee_id TEXT,
      notify_staff_id TEXT,
      enabled INTEGER NOT NULL DEFAULT 1,
      name TEXT NOT NULL,
      created_at TEXT NOT NULL
    )
  `)

  await db.exec('ALTER TABLE staff ADD COLUMN IF NOT EXISTS manager_id TEXT')
  await db.exec('ALTER TABLE staff ADD COLUMN IF NOT EXISTS hourly_rate NUMERIC')

  await db.exec(`
    CREATE TABLE IF NOT EXISTS bd_quotas (
      id TEXT PRIMARY KEY,
      staff_id TEXT NOT NULL,
      period TEXT NOT NULL,
      target_value NUMERIC NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      UNIQUE(staff_id, period)
    )
  `)

  await db.exec(`
    CREATE TABLE IF NOT EXISTS products (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      unit_price NUMERIC NOT NULL,
      currency TEXT NOT NULL DEFAULT 'GHS',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `)

  await db.exec(`
    CREATE TABLE IF NOT EXISTS contract_line_items (
      id TEXT PRIMARY KEY,
      contract_id TEXT NOT NULL,
      product_id TEXT,
      product_name TEXT NOT NULL,
      unit_price NUMERIC NOT NULL,
      currency TEXT NOT NULL,
      quantity INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL
    )
  `)

  await db.exec(`
    CREATE TABLE IF NOT EXISTS quotes (
      id TEXT PRIMARY KEY,
      regarding_type TEXT NOT NULL,
      regarding_id TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'quoted',
      notes TEXT,
      created_by TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `)

  await db.exec(`
    CREATE TABLE IF NOT EXISTS quote_line_items (
      id TEXT PRIMARY KEY,
      quote_id TEXT NOT NULL,
      product_id TEXT,
      product_name TEXT NOT NULL,
      unit_price NUMERIC NOT NULL,
      currency TEXT NOT NULL,
      quantity INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL
    )
  `)

  await db.exec(`
    CREATE TABLE IF NOT EXISTS invoices (
      id TEXT PRIMARY KEY,
      client_id TEXT NOT NULL,
      project_id TEXT,
      status TEXT NOT NULL DEFAULT 'draft',
      issue_date TEXT,
      due_date TEXT,
      notes TEXT,
      currency TEXT NOT NULL DEFAULT 'GHS',
      subtotal NUMERIC NOT NULL DEFAULT 0,
      tax_rate NUMERIC NOT NULL DEFAULT 0,
      tax_amount NUMERIC NOT NULL DEFAULT 0,
      discount NUMERIC NOT NULL DEFAULT 0,
      total NUMERIC NOT NULL DEFAULT 0,
      amount_paid NUMERIC NOT NULL DEFAULT 0,
      balance NUMERIC NOT NULL DEFAULT 0,
      created_by TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `)

  await db.exec(`
    CREATE TABLE IF NOT EXISTS invoice_items (
      id TEXT PRIMARY KEY,
      invoice_id TEXT NOT NULL,
      description TEXT NOT NULL,
      quantity NUMERIC NOT NULL DEFAULT 1,
      unit_price NUMERIC NOT NULL DEFAULT 0,
      line_total NUMERIC NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    )
  `)

  await db.exec(`
    CREATE TABLE IF NOT EXISTS invoice_activity (
      id TEXT PRIMARY KEY,
      invoice_id TEXT NOT NULL,
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
    CREATE TABLE IF NOT EXISTS receipts (
      id TEXT PRIMARY KEY,
      invoice_id TEXT NOT NULL,
      amount NUMERIC NOT NULL,
      method TEXT NOT NULL,
      received_date TEXT NOT NULL,
      reference TEXT,
      recorded_by TEXT,
      created_at TEXT NOT NULL
    )
  `)

  await db.exec(`
    CREATE TABLE IF NOT EXISTS accounts (
      code TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      parent_code TEXT,
      is_active INTEGER NOT NULL DEFAULT 1,
      description TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `)

  // The two control accounts the receipt-posting integration hard-depends on — structural,
  // like a table existing, not "starter" business data (nothing else is auto-created).
  const accountsSeedNow = new Date().toISOString()
  await db.prepare(`
    INSERT INTO accounts (code, name, type, is_active, description, created_at, updated_at)
    SELECT '1010', 'Cash', 'asset', 1, 'Default cash account for recorded receipts', ?, ?
    WHERE NOT EXISTS (SELECT 1 FROM accounts WHERE code = '1010')
  `).run(accountsSeedNow, accountsSeedNow)

  await db.prepare(`
    INSERT INTO accounts (code, name, type, is_active, description, created_at, updated_at)
    SELECT '1200', 'Accounts Receivable', 'asset', 1, 'Default AR control account for client invoices', ?, ?
    WHERE NOT EXISTS (SELECT 1 FROM accounts WHERE code = '1200')
  `).run(accountsSeedNow, accountsSeedNow)

  await db.prepare(`
    INSERT INTO accounts (code, name, type, is_active, description, created_at, updated_at)
    SELECT '2010', 'Accounts Payable', 'liability', 1, 'Default AP control account for vendor bills', ?, ?
    WHERE NOT EXISTS (SELECT 1 FROM accounts WHERE code = '2010')
  `).run(accountsSeedNow, accountsSeedNow)

  await db.exec(`
    CREATE TABLE IF NOT EXISTS fiscal_periods (
      id TEXT PRIMARY KEY,
      label TEXT NOT NULL,
      start_date TEXT NOT NULL,
      end_date TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'open',
      created_at TEXT NOT NULL
    )
  `)

  await db.exec(`
    CREATE TABLE IF NOT EXISTS journal_entries (
      id TEXT PRIMARY KEY,
      period_id TEXT NOT NULL,
      entry_date TEXT NOT NULL,
      memo TEXT,
      source TEXT NOT NULL DEFAULT 'manual',
      source_id TEXT,
      posted_by TEXT,
      created_at TEXT NOT NULL
    )
  `)

  await db.exec(`
    CREATE TABLE IF NOT EXISTS journal_entry_lines (
      id TEXT PRIMARY KEY,
      entry_id TEXT NOT NULL,
      account_code TEXT NOT NULL,
      debit NUMERIC NOT NULL DEFAULT 0,
      credit NUMERIC NOT NULL DEFAULT 0,
      memo TEXT,
      created_at TEXT NOT NULL
    )
  `)

  await db.exec(`
    CREATE TABLE IF NOT EXISTS budgets (
      id TEXT PRIMARY KEY,
      period_id TEXT NOT NULL,
      account_code TEXT NOT NULL,
      amount NUMERIC NOT NULL,
      notes TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      UNIQUE (period_id, account_code)
    )
  `)

  await db.exec(`
    CREATE TABLE IF NOT EXISTS vendors (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      contact_name TEXT,
      contact_email TEXT,
      contact_phone TEXT,
      address TEXT,
      notes TEXT,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `)

  await db.exec(`
    CREATE TABLE IF NOT EXISTS vendor_bills (
      id TEXT PRIMARY KEY,
      vendor_id TEXT NOT NULL,
      expense_account_code TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'unpaid',
      bill_date TEXT NOT NULL,
      due_date TEXT,
      reference TEXT,
      notes TEXT,
      currency TEXT NOT NULL DEFAULT 'GHS',
      subtotal NUMERIC NOT NULL DEFAULT 0,
      tax_rate NUMERIC NOT NULL DEFAULT 0,
      tax_amount NUMERIC NOT NULL DEFAULT 0,
      total NUMERIC NOT NULL DEFAULT 0,
      amount_paid NUMERIC NOT NULL DEFAULT 0,
      balance NUMERIC NOT NULL DEFAULT 0,
      created_by TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `)

  await db.exec(`
    CREATE TABLE IF NOT EXISTS vendor_bill_items (
      id TEXT PRIMARY KEY,
      bill_id TEXT NOT NULL,
      description TEXT NOT NULL,
      quantity NUMERIC NOT NULL DEFAULT 1,
      unit_price NUMERIC NOT NULL DEFAULT 0,
      line_total NUMERIC NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    )
  `)

  await db.exec(`
    CREATE TABLE IF NOT EXISTS payment_runs (
      id TEXT PRIMARY KEY,
      payment_date TEXT NOT NULL,
      method TEXT NOT NULL,
      reference TEXT,
      total NUMERIC NOT NULL DEFAULT 0,
      created_by TEXT,
      created_at TEXT NOT NULL
    )
  `)

  await db.exec(`
    CREATE TABLE IF NOT EXISTS vendor_payments (
      id TEXT PRIMARY KEY,
      bill_id TEXT NOT NULL,
      payment_run_id TEXT,
      amount NUMERIC NOT NULL,
      method TEXT NOT NULL,
      paid_date TEXT NOT NULL,
      reference TEXT,
      recorded_by TEXT,
      created_at TEXT NOT NULL
    )
  `)

  await db.exec(`
    CREATE TABLE IF NOT EXISTS timesheets (
      id TEXT PRIMARY KEY,
      staff_id TEXT NOT NULL,
      task_id TEXT NOT NULL,
      work_date TEXT NOT NULL,
      hours NUMERIC NOT NULL,
      hourly_rate NUMERIC NOT NULL DEFAULT 0,
      billable INTEGER NOT NULL DEFAULT 1,
      notes TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `)

  await db.exec(`
    CREATE TABLE IF NOT EXISTS sales_orders (
      id TEXT PRIMARY KEY,
      quote_id TEXT NOT NULL,
      regarding_type TEXT NOT NULL,
      regarding_id TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'confirmed',
      currency TEXT NOT NULL,
      total NUMERIC NOT NULL,
      notes TEXT,
      created_by TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `)

  await db.exec(`
    CREATE TABLE IF NOT EXISTS sales_order_line_items (
      id TEXT PRIMARY KEY,
      order_id TEXT NOT NULL,
      product_id TEXT,
      product_name TEXT NOT NULL,
      unit_price NUMERIC NOT NULL,
      currency TEXT NOT NULL,
      quantity INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL
    )
  `)

  await db.exec(`
    CREATE TABLE IF NOT EXISTS approval_requests (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      subject_label TEXT NOT NULL,
      payload TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      requested_by TEXT,
      requested_at TEXT NOT NULL,
      decided_by TEXT,
      decided_at TEXT,
      decision_notes TEXT,
      result_id TEXT,
      created_at TEXT NOT NULL
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

export async function nextBdAutomationRuleId() {
  const n = await nextSequence('bd_automation_rule')
  return `BDRULE-${n}`
}

export async function nextBdQuotaId() {
  const n = await nextSequence('bd_quota')
  return `QUOTA-${n}`
}

export async function nextProductId() {
  const n = await nextSequence('product')
  return `PROD-${n}`
}

export async function nextContractLineItemId() {
  const n = await nextSequence('contract_line_item')
  return `CLI-${n}`
}

export async function nextQuoteId() {
  const n = await nextSequence('quote')
  return `QUOTE-${n}`
}

export async function nextQuoteLineItemId() {
  const n = await nextSequence('quote_line_item')
  return `QLI-${n}`
}

export async function nextInvoiceId() {
  const n = await nextSequence('invoice')
  return `INV-${n}`
}

export async function nextInvoiceItemId() {
  const n = await nextSequence('invoice_item')
  return `ITEM-${n}`
}

export async function nextInvoiceActivityId() {
  const n = await nextSequence('invoice_activity')
  return `IACT-${n}`
}

export async function nextReceiptId() {
  const n = await nextSequence('receipt')
  return `RCPT-${n}`
}

export async function nextJournalEntryId() {
  const n = await nextSequence('journal_entry')
  return `JE-${n}`
}

export async function nextJournalEntryLineId() {
  const n = await nextSequence('journal_entry_line')
  return `JEL-${n}`
}

export async function nextBudgetId() {
  const n = await nextSequence('budget')
  return `BUDGET-${n}`
}

export async function nextVendorId() {
  const n = await nextSequence('vendor')
  return `VENDOR-${n}`
}

export async function nextVendorBillId() {
  const n = await nextSequence('vendor_bill')
  return `BILL-${n}`
}

export async function nextVendorBillItemId() {
  const n = await nextSequence('vendor_bill_item')
  return `BITEM-${n}`
}

export async function nextPaymentRunId() {
  const n = await nextSequence('payment_run')
  return `RUN-${n}`
}

export async function nextVendorPaymentId() {
  const n = await nextSequence('vendor_payment')
  return `VPMT-${n}`
}

export async function nextTimesheetId() {
  const n = await nextSequence('timesheet')
  return `TS-${n}`
}

export async function nextSalesOrderId() {
  const n = await nextSequence('sales_order')
  return `SO-${n}`
}

export async function nextSalesOrderLineItemId() {
  const n = await nextSequence('sales_order_line_item')
  return `SOLI-${n}`
}

export async function nextApprovalRequestId() {
  const n = await nextSequence('approval_request')
  return `APR-${n}`
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

export async function nextTenderId() {
  const n = await nextSequence('tender')
  return `TENDER-${n}`
}

export async function nextTenderActivityId() {
  const n = await nextSequence('tender_activity')
  return `TACT-${n}`
}

export async function nextTenderDocumentId() {
  const n = await nextSequence('tender_document')
  return `TDOC-${n}`
}

export async function nextLeadDocumentId() {
  const n = await nextSequence('lead_document')
  return `LDOC-${n}`
}

export async function nextClientDocumentId() {
  const n = await nextSequence('client_document')
  return `CDOC-${n}`
}

export async function nextInteractionId() {
  const n = await nextSequence('interaction')
  return `INT-${n}`
}

export async function nextTaskId() {
  const n = await nextSequence('task')
  return `TASK-${n}`
}

export async function nextTaskStatusId() {
  const n = await nextSequence('task_status')
  return `STATUS-${n}`
}

export async function nextSprintId() {
  const n = await nextSequence('sprint')
  return `SPRINT-${n}`
}

export async function nextProjectId() {
  const n = await nextSequence('project')
  return `PROJECT-${n}`
}

export async function nextClientContactEmailId() {
  const n = await nextSequence('client_contact_email')
  return `CCE-${n}`
}

export async function nextClientContactPhoneId() {
  const n = await nextSequence('client_contact_phone')
  return `CCP-${n}`
}

export async function nextClientContactId() {
  const n = await nextSequence('client_contact')
  return `CCT-${n}`
}

export async function nextLeadContactEmailId() {
  const n = await nextSequence('lead_contact_email')
  return `LCE-${n}`
}

export async function nextLeadContactPhoneId() {
  const n = await nextSequence('lead_contact_phone')
  return `LCP-${n}`
}

export async function nextChannelId() {
  const n = await nextSequence('chat_channel')
  return `CHAN-${n}`
}

export async function nextChatMessageId() {
  const n = await nextSequence('chat_message')
  return `MSG-${n}`
}

export async function nextChatReactionId() {
  const n = await nextSequence('chat_reaction')
  return `RXN-${n}`
}

export async function nextEventId() {
  const n = await nextSequence('calendar_event')
  return `EVENT-${n}`
}

export async function nextStaffIntegrationId() {
  const n = await nextSequence('staff_integration')
  return `INTG-${n}`
}
