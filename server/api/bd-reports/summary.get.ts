interface CountRow { count: string | number }
interface GroupCountRow { key: string, count: string | number }
interface CurrencyTotalRow { currency: string, total: string | number }

export default defineEventHandler(async (event) => {
  await requireBd(event)
  await ensureDb()

  const query = getQuery(event)
  const fromDate = typeof query.from === 'string' && query.from ? query.from : null
  const toDate = typeof query.to === 'string' && query.to ? query.to : null

  const now = new Date()
  const defaultTo = now.toISOString().slice(0, 10)
  const defaultFrom = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)

  const from = `${fromDate ?? defaultFrom}T00:00:00.000Z`
  const to = `${toDate ?? defaultTo}T23:59:59.999Z`

  const db = useDatabase()

  const newLeadsRow = await db.prepare('SELECT COUNT(*) as count FROM leads WHERE created_at BETWEEN ? AND ?').get(from, to) as CountRow
  const convertedLeadsRow = await db.prepare('SELECT COUNT(DISTINCT lead_id) as count FROM lead_activity WHERE type = \'converted\' AND created_at BETWEEN ? AND ?').get(from, to) as CountRow
  const leadsByStage = await db.prepare('SELECT stage as key, COUNT(*) as count FROM leads WHERE created_at BETWEEN ? AND ? GROUP BY stage').all(from, to) as GroupCountRow[]
  const leadsBySource = await db.prepare('SELECT COALESCE(NULLIF(source, \'\'), \'Unknown\') as key, COUNT(*) as count FROM leads WHERE created_at BETWEEN ? AND ? GROUP BY COALESCE(NULLIF(source, \'\'), \'Unknown\')').all(from, to) as GroupCountRow[]

  const newClientsRow = await db.prepare('SELECT COUNT(*) as count FROM clients WHERE created_at BETWEEN ? AND ?').get(from, to) as CountRow
  const clientsByStage = await db.prepare('SELECT stage as key, COUNT(*) as count FROM clients WHERE created_at BETWEEN ? AND ? GROUP BY stage').all(from, to) as GroupCountRow[]
  const stageChangesRow = await db.prepare('SELECT COUNT(*) as count FROM client_activity WHERE type = \'stage_changed\' AND created_at BETWEEN ? AND ?').get(from, to) as CountRow

  const newContractsRow = await db.prepare('SELECT COUNT(*) as count FROM client_amc_contracts WHERE created_at BETWEEN ? AND ?').get(from, to) as CountRow
  const contractsByStatus = await db.prepare('SELECT status as key, COUNT(*) as count FROM client_amc_contracts WHERE created_at BETWEEN ? AND ? GROUP BY status').all(from, to) as GroupCountRow[]
  const valueByCurrency = await db.prepare(`
    SELECT amc_plans.currency as currency, SUM(COALESCE(amc_plans.price, 0)) as total
    FROM client_amc_contracts
    JOIN amc_plans ON amc_plans.id = client_amc_contracts.plan_id
    WHERE client_amc_contracts.created_at BETWEEN ? AND ?
    GROUP BY amc_plans.currency
  `).all(from, to) as CurrencyTotalRow[]

  const completedTasksRow = await db.prepare('SELECT COUNT(*) as count FROM tasks WHERE status = \'done\' AND updated_at BETWEEN ? AND ?').get(from, to) as CountRow

  const newProjectsRow = await db.prepare('SELECT COUNT(*) as count FROM projects WHERE created_at BETWEEN ? AND ?').get(from, to) as CountRow

  const newLeads = Number(newLeadsRow.count)
  const convertedLeads = Number(convertedLeadsRow.count)

  return {
    range: { from: fromDate ?? defaultFrom, to: toDate ?? defaultTo },
    leads: {
      newCount: newLeads,
      convertedCount: convertedLeads,
      conversionRate: newLeads > 0 ? Math.round((convertedLeads / newLeads) * 1000) / 10 : 0,
      byStage: leadsByStage.map(row => ({ stage: row.key, count: Number(row.count) })),
      bySource: leadsBySource.map(row => ({ source: row.key, count: Number(row.count) })),
    },
    clients: {
      newCount: Number(newClientsRow.count),
      stageChanges: Number(stageChangesRow.count),
      byStage: clientsByStage.map(row => ({ stage: row.key, count: Number(row.count) })),
    },
    amc: {
      newContracts: Number(newContractsRow.count),
      byStatus: contractsByStatus.map(row => ({ status: row.key, count: Number(row.count) })),
      valueByCurrency: valueByCurrency.map(row => ({ currency: row.currency, total: Number(row.total) })),
    },
    tasks: {
      completedCount: Number(completedTasksRow.count),
    },
    projects: {
      newCount: Number(newProjectsRow.count),
    },
  }
})
