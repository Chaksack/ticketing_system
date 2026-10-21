export default defineNitroPlugin(async () => {
  ensurePgQuerySerialized()

  await ensureDb()
  const db = useTenantDb()

  const staffCount = await db.prepare('SELECT COUNT(*) as count FROM staff').get() as { count: number | string }

  if (Number(staffCount.count) === 0) {
    const defaultPasswordHash = hashPassword('ChangeMe123!')
    const now = new Date().toISOString()

    const seedStaff = [
      { id: 'STAFF-001', name: 'Andrew Chakdahah', email: 'chakdahah@gmail.com', roles: ['admin'], onCall: 0 },
      { id: 'STAFF-002', name: 'Ama Owusu', email: 'ama.owusu@example.com', roles: ['agent'], onCall: 1 },
      { id: 'STAFF-003', name: 'Kojo Mensah', email: 'kojo.mensah@example.com', roles: ['agent'], onCall: 0 },
      { id: 'STAFF-004', name: 'Efua Boateng', email: 'efua.boateng@example.com', roles: ['bd'], onCall: 0 },
    ]

    for (const member of seedStaff) {
      await db.prepare(`
        INSERT INTO staff (id, name, email, role, roles, hq_role, status, on_call, password_hash, created_at)
        VALUES (?, ?, ?, ?, ?, ?, 'active', ?, ?, ?)
      `).run(member.id, member.name, member.email, member.roles[0], JSON.stringify(member.roles), member.roles.includes('admin') && currentOrgId() === HOME_ORG_ID ? 'admin' : null, member.onCall, defaultPasswordHash, now)
    }

    await db.prepare('INSERT INTO counters (name, value) VALUES (\'staff\', ?)').run(seedStaff.length)

    console.warn(`[seed] Created ${seedStaff.length} staff accounts with default password "ChangeMe123!" — change this immediately.`)
  }

  const ticketCount = await db.prepare('SELECT COUNT(*) as count FROM tickets').get() as { count: number | string }

  if (Number(ticketCount.count) === 0) {
    const seedTickets = [
      {
        id: 'TICKET-1001',
        subject: 'Unable to reset password',
        description: 'I requested a password reset email three times but never received anything, even after checking spam.',
        requester: 'Ama Owusu',
        requesterEmail: 'ama.owusu@example.com',
        category: 'Account',
        status: 'open',
        priority: 'high',
        createdAt: '2026-08-05T09:12:00.000Z',
      },
      {
        id: 'TICKET-1002',
        subject: 'Invoice shows incorrect billing amount',
        description: 'My latest invoice charged me for two seats but we only have one active user on the plan.',
        requester: 'Kojo Mensah',
        requesterEmail: 'kojo.mensah@example.com',
        category: 'Billing',
        status: 'in-progress',
        priority: 'urgent',
        createdAt: '2026-08-06T14:45:00.000Z',
      },
      {
        id: 'TICKET-1003',
        subject: 'Feature request: dark mode for reports',
        description: 'It would be great if the reports page respected the app-wide dark mode setting.',
        requester: 'Efua Boateng',
        requesterEmail: 'efua.boateng@example.com',
        category: 'Feature Request',
        status: 'open',
        priority: 'low',
        createdAt: '2026-08-07T08:30:00.000Z',
      },
    ]

    for (const ticket of seedTickets) {
      await db.prepare(`
        INSERT INTO tickets (id, subject, description, requester, requester_email, category, status, priority, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(ticket.id, ticket.subject, ticket.description, ticket.requester, ticket.requesterEmail, ticket.category, ticket.status, ticket.priority, ticket.createdAt)
    }

    await db.prepare('INSERT INTO counters (name, value) VALUES (\'ticket\', 3)').run()

    console.warn(`[seed] Created ${seedTickets.length} demo tickets.`)
  }

  // SLA policies, the default macro and task board columns — the same defaults every company gets.
  await seedWorkspaceDefaults()

  const automationRuleCount = await db.prepare('SELECT COUNT(*) as count FROM automation_rules').get() as { count: number | string }

  if (Number(automationRuleCount.count) === 0) {
    const now = new Date().toISOString()

    await db.prepare(`
      INSERT INTO automation_rules (id, name, enabled, field, operator, value, set_priority, set_status, set_assignee_id, add_tag_id, created_at)
      VALUES (?, ?, 1, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      'RULE-1',
      'Prioritize Billing Issues',
      'category',
      'equals',
      'Billing',
      'high',
      null,
      null,
      null,
      now,
    )

    await db.prepare('INSERT INTO counters (name, value) VALUES (\'rule\', 1)').run()

    console.warn('[seed] Created 1 default automation rule.')
  }

  // One-time backfill of the old single `assignee_id` / `assigned_to` columns into the new
  // many-to-many tables — guarded so it only ever runs once. Running this unconditionally on
  // every boot would resurrect an assignment someone deliberately removed, since the old
  // columns are frozen in place (no longer written to) rather than dropped.
  const taskAssigneeCount = await db.prepare('SELECT COUNT(*) as count FROM task_assignees').get() as { count: number | string }

  if (Number(taskAssigneeCount.count) === 0) {
    await db.prepare(`
      INSERT INTO task_assignees (task_id, staff_id)
      SELECT id, assignee_id FROM tasks WHERE assignee_id IS NOT NULL
    `).run()

    console.warn('[migrate] Backfilled task assignees from the legacy assignee_id column.')
  }

  const leadAssigneeCount = await db.prepare('SELECT COUNT(*) as count FROM lead_assignees').get() as { count: number | string }

  if (Number(leadAssigneeCount.count) === 0) {
    await db.prepare(`
      INSERT INTO lead_assignees (lead_id, staff_id)
      SELECT id, assigned_to FROM leads WHERE assigned_to IS NOT NULL
    `).run()

    console.warn('[migrate] Backfilled lead assignees from the legacy assigned_to column.')
  }

  const clientAssigneeCount = await db.prepare('SELECT COUNT(*) as count FROM client_assignees').get() as { count: number | string }

  if (Number(clientAssigneeCount.count) === 0) {
    await db.prepare(`
      INSERT INTO client_assignees (client_id, staff_id)
      SELECT id, assigned_to FROM clients WHERE assigned_to IS NOT NULL
    `).run()

    console.warn('[migrate] Backfilled client assignees from the legacy assigned_to column.')
  }
})
