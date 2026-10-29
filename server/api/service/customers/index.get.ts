/** Customers: everyone who raised a ticket or started a chat. `?q=` searches name, email and company. */
export default defineEventHandler(async (event) => {
  await requireServiceStaff(event)
  await ensureDb()
  const q = getQuery(event).q
  return { customers: (await listSupportCustomers(typeof q === 'string' ? q : '')).slice(0, 500) }
})
