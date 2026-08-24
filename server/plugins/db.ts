export default defineNitroPlugin(async () => {
  await ensureDb()
  const db = useDatabase()

  const staffCount = await db.prepare('SELECT COUNT(*) as count FROM staff').get() as { count: number | string }

  if (Number(staffCount.count) === 0) {
    const defaultPasswordHash = hashPassword('ChangeMe123!')
    const now = new Date().toISOString()

    const seedStaff = [
      { id: 'STAFF-001', name: 'Andrew Chakdahah', email: 'chakdahah@gmail.com', role: 'admin', onCall: 0 },
      { id: 'STAFF-002', name: 'Ama Owusu', email: 'ama.owusu@example.com', role: 'agent', onCall: 1 },
      { id: 'STAFF-003', name: 'Kojo Mensah', email: 'kojo.mensah@example.com', role: 'agent', onCall: 0 },
    ]

    for (const member of seedStaff) {
      await db.prepare(`
        INSERT INTO staff (id, name, email, role, status, on_call, password_hash, created_at)
        VALUES (?, ?, ?, ?, 'active', ?, ?, ?)
      `).run(member.id, member.name, member.email, member.role, member.onCall, defaultPasswordHash, now)
    }

    await db.prepare('INSERT INTO counters (name, value) VALUES (\'staff\', 3)').run()

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
})
