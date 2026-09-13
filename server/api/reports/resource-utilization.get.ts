function mondayOfCurrentWeek() {
  const now = new Date()
  const day = now.getUTCDay()
  const diffToMonday = day === 0 ? -6 : 1 - day
  const monday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + diffToMonday))
  return monday
}

export default defineEventHandler(async (event) => {
  await requireCapacityView(event)
  await ensureDb()

  const query = getQuery(event)
  const monday = mondayOfCurrentWeek()
  const sunday = new Date(monday.getTime() + 6 * 24 * 60 * 60 * 1000)

  const from = typeof query.from === 'string' && query.from ? query.from : monday.toISOString().slice(0, 10)
  const to = typeof query.to === 'string' && query.to ? query.to : sunday.toISOString().slice(0, 10)

  const rows = await getResourceUtilization(from, to)
  return { from, to, rows }
})
