import type { VendorRow } from '../../utils/vendors'

interface NewVendorBody {
  name?: string
  contactName?: string
  contactEmail?: string
  contactPhone?: string
  address?: string
  notes?: string
}

export default defineEventHandler(async (event) => {
  await requireFinance(event)

  const body = await readBody<NewVendorBody>(event)

  if (!body?.name?.trim()) {
    throw createError({ statusCode: 400, statusMessage: 'name is required' })
  }

  await ensureDb()
  const db = useDatabase()

  const id = await nextVendorId()
  const now = new Date().toISOString()

  await db.prepare(`
    INSERT INTO vendors (id, name, contact_name, contact_email, contact_phone, address, notes, is_active, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?)
  `).run(id, body.name.trim(), body.contactName?.trim() || null, body.contactEmail?.trim() || null, body.contactPhone?.trim() || null, body.address?.trim() || null, body.notes?.trim() || null, now, now)

  const row = await db.prepare('SELECT * FROM vendors WHERE id = ?').get(id) as VendorRow

  setResponseStatus(event, 201)
  return { vendor: mapVendorRow(row) }
})
