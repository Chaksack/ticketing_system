interface UpcomingRenewalRow {
  id: string
  client_id: string
  client_name: string
  plan_name: string
  end_date: string
}

export default defineEventHandler(async (event) => {
  await requireBd(event)
  await ensureDb()

  const db = useDatabase()
  const rows = await db.prepare(`
    SELECT c.id, c.client_id, clients.name AS client_name, amc_plans.name AS plan_name, c.end_date
    FROM client_amc_contracts c
    INNER JOIN clients ON clients.id = c.client_id
    LEFT JOIN amc_plans ON amc_plans.id = c.plan_id
    WHERE c.status = 'active'
    ORDER BY c.end_date ASC
    LIMIT 10
  `).all() as UpcomingRenewalRow[]

  return {
    renewals: rows.map(row => ({
      contractId: row.id,
      clientId: row.client_id,
      clientName: row.client_name,
      planName: row.plan_name,
      endDate: row.end_date,
    })),
  }
})
