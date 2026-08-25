import type { ContractRow } from './mappers'

const DAY_MS = 24 * 60 * 60 * 1000

async function sendRenewalReminder(contract: ContractRow, windowLabel: string) {
  const db = useDatabase()

  const client = await db.prepare('SELECT name, assigned_to FROM clients WHERE id = ?').get(contract.client_id) as { name: string, assigned_to: string | null } | undefined
  if (!client)
    return

  await logClientActivity({
    clientId: contract.client_id,
    type: 'amc_renewal_reminder',
    actorName: 'System',
    message: `AMC contract ${contract.id} expires within ${windowLabel} (${contract.end_date.slice(0, 10)})`,
  })

  if (client.assigned_to) {
    await sendPushToStaff(client.assigned_to, {
      title: 'AMC renewal due soon',
      body: `${client.name}'s contract expires within ${windowLabel}`,
      url: '/clients',
    })
  }
}

export async function checkAmcRenewals() {
  const db = useDatabase()
  const now = new Date()

  const in30Days = new Date(now.getTime() + 30 * DAY_MS).toISOString()
  const in7Days = new Date(now.getTime() + 7 * DAY_MS).toISOString()
  const nowIso = now.toISOString()

  const dueSoon30 = await db.prepare(`
    SELECT * FROM client_amc_contracts
    WHERE status = 'active' AND reminder_30d_sent = 0 AND end_date <= ? AND end_date > ?
  `).all(in30Days, nowIso) as ContractRow[]

  for (const contract of dueSoon30) {
    await sendRenewalReminder(contract, '30 days')
    await db.prepare('UPDATE client_amc_contracts SET reminder_30d_sent = 1 WHERE id = ?').run(contract.id)
  }

  const dueSoon7 = await db.prepare(`
    SELECT * FROM client_amc_contracts
    WHERE status = 'active' AND reminder_7d_sent = 0 AND end_date <= ? AND end_date > ?
  `).all(in7Days, nowIso) as ContractRow[]

  for (const contract of dueSoon7) {
    await sendRenewalReminder(contract, '7 days')
    await db.prepare('UPDATE client_amc_contracts SET reminder_7d_sent = 1 WHERE id = ?').run(contract.id)
  }

  const expired = await db.prepare(`
    SELECT id FROM client_amc_contracts WHERE status = 'active' AND end_date <= ?
  `).all(nowIso) as { id: string }[]

  for (const row of expired)
    await db.prepare('UPDATE client_amc_contracts SET status = \'expired\' WHERE id = ?').run(row.id)

  return { reminded30: dueSoon30.length, reminded7: dueSoon7.length, expired: expired.length }
}
