/** Edit what the team knows about a customer: display name, phone and notes. */
export default defineEventHandler(async (event) => {
  const user = await requireServiceStaff(event)
  await ensureDb()
  const email = decodeURIComponent(getRouterParam(event, 'email') ?? '').trim().toLowerCase()
  if (!/^[^\s@]+@[^\s@]+$/.test(email))
    throw createError({ statusCode: 400, statusMessage: 'Not an email address' })
  const body = await readBody<{ name?: string, phone?: string, notes?: string }>(event) ?? {}
  const clean = (value: string | undefined, max: number) => value?.trim().slice(0, max) || null
  await useTenantDb().prepare(`
    INSERT INTO customer_profiles (email, name, phone, notes, updated_at, updated_by) VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT (email) DO UPDATE SET name = excluded.name, phone = excluded.phone, notes = excluded.notes, updated_at = excluded.updated_at, updated_by = excluded.updated_by
  `).run(email, clean(body.name, 120), clean(body.phone, 40), clean(body.notes, 4000), new Date().toISOString(), user.name)
  return { ok: true }
})
