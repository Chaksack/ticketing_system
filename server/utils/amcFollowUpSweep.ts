import type { ContractRow } from './mappers'

export async function checkAmcFollowUps() {
  await ensureDb()
  const db = useDatabase()
  const now = new Date().toISOString()

  const due = await db.prepare(`
    SELECT * FROM client_amc_contracts
    WHERE status NOT IN ('cancelled', 'lost', 'expired') AND next_step_at IS NOT NULL AND next_step_at <= ? AND next_step_reminder_sent = 0
  `).all(now) as ContractRow[]

  for (const contract of due) {
    const client = await db.prepare('SELECT name FROM clients WHERE id = ?').get(contract.client_id) as { name: string } | undefined
    const assignees = client ? await getClientAssignees(contract.client_id) : []

    if (client && assignees.length) {
      const title = `AMC follow-up due: ${client.name}`
      const body = contract.next_step || 'This AMC contract needs your attention.'
      const url = `/clients?open=${contract.client_id}`

      for (const assignee of assignees) {
        await createNotification({ staffId: assignee.id, type: 'amc_follow_up', title, body, url, contractId: contract.id })
        await sendPushToStaff(assignee.id, { title, body, url })
      }
    }

    await db.prepare('UPDATE client_amc_contracts SET next_step_reminder_sent = 1 WHERE id = ?').run(contract.id)
  }

  return { reminded: due.length }
}
