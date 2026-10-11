/**
 * Defaults every workspace needs to work out of the box — SLA targets (so tickets get deadlines),
 * a starter macro and the task board's columns. Runs for the home workspace at boot
 * (server/plugins/db.ts) and for each new company when it's provisioned. Each part only seeds
 * an empty table, so it's safe to run again.
 */
export async function seedWorkspaceDefaults() {
  const db = useTenantDb()

  const slaPolicyCount = await db.prepare('SELECT COUNT(*) as count FROM sla_policies').get() as { count: number | string }

  if (Number(slaPolicyCount.count) === 0) {
    const now = new Date().toISOString()
    const defaultPolicies = [
      { priority: 'urgent', firstResponseMins: 30, resolutionMins: 240 },
      { priority: 'high', firstResponseMins: 60, resolutionMins: 480 },
      { priority: 'medium', firstResponseMins: 240, resolutionMins: 1440 },
      { priority: 'low', firstResponseMins: 480, resolutionMins: 2880 },
    ]

    for (const [index, policy] of defaultPolicies.entries()) {
      await db.prepare(`
        INSERT INTO sla_policies (id, priority, first_response_mins, resolution_mins, created_at)
        VALUES (?, ?, ?, ?, ?)
      `).run(`SLA-${index + 1}`, policy.priority, policy.firstResponseMins, policy.resolutionMins, now)
    }

    console.warn(`[seed] Created ${defaultPolicies.length} default SLA policies.`)
  }

  const macroCount = await db.prepare('SELECT COUNT(*) as count FROM macros').get() as { count: number | string }

  if (Number(macroCount.count) === 0) {
    const now = new Date().toISOString()

    await db.prepare(`
      INSERT INTO macros (id, name, body, set_status, set_priority, add_tag_id, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      'MACRO-1',
      'Acknowledge Receipt',
      'Hi, thanks for reaching out! We\'ve received your request and a member of our support team will follow up shortly. We appreciate your patience.',
      'in-progress',
      null,
      null,
      now,
    )

    await db.prepare('INSERT INTO counters (name, value) VALUES (\'macro\', 1)').run()

    console.warn('[seed] Created 1 default macro.')
  }

  const taskStatusCount = await db.prepare('SELECT COUNT(*) as count FROM task_statuses').get() as { count: number | string }

  if (Number(taskStatusCount.count) === 0) {
    const now = new Date().toISOString()
    // Fixed ids matching the values already used by existing `tasks.status` rows —
    // seeding with generated ids here would orphan every task created before this table existed.
    const defaultStatuses = [
      { id: 'backlog', label: 'Backlog' },
      { id: 'todo', label: 'To Do' },
      { id: 'in_progress', label: 'In Progress' },
      { id: 'in_review', label: 'In Review' },
      { id: 'done', label: 'Done' },
    ]

    for (const [index, statusDef] of defaultStatuses.entries()) {
      await db.prepare(`
        INSERT INTO task_statuses (id, label, position, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?)
      `).run(statusDef.id, statusDef.label, index, now, now)
    }

    console.warn(`[seed] Created ${defaultStatuses.length} default task statuses.`)
  }
}
