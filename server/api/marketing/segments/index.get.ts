export default defineEventHandler(async (event) => {
  await requireMarketing(event)
  await ensureDb()
  const rows = await useTenantDb().prepare('SELECT * FROM marketing_segments ORDER BY updated_at DESC').all() as Parameters<typeof mapSegmentRow>[0][]
  const segments = rows.map(mapSegmentRow)
  // Member counts for the list.
  const contacts = await loadMarketingContacts()
  return { segments: segments.map(s => ({ ...s, memberCount: contacts.filter(c => contactMatchesSegment(c, s.conditions)).length })) }
})
