import type { VendorRow } from '../../utils/vendors'

interface UpdateVendorBody {
  name?: string
  contactName?: string | null
  contactEmail?: string | null
  contactPhone?: string | null
  address?: string | null
  notes?: string | null
  isActive?: boolean
}

export default defineEventHandler(async (event) => {
  await requireFinance(event)

  const id = getRouterParam(event, 'id')
  const body = await readBody<UpdateVendorBody>(event)

  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'Missing vendor id' })
  }

  await ensureDb()
  const db = useDatabase()

  const existing = await db.prepare('SELECT * FROM vendors WHERE id = ?').get(id) as VendorRow | undefined
  if (!existing) {
    throw createError({ statusCode: 404, statusMessage: 'Vendor not found' })
  }

  const name = body.name?.trim() || existing.name
  const contactName = body.contactName !== undefined ? body.contactName : existing.contact_name
  const contactEmail = body.contactEmail !== undefined ? body.contactEmail : existing.contact_email
  const contactPhone = body.contactPhone !== undefined ? body.contactPhone : existing.contact_phone
  const address = body.address !== undefined ? body.address : existing.address
  const notes = body.notes !== undefined ? body.notes : existing.notes
  const isActive = body.isActive === undefined ? existing.is_active : Number(body.isActive)

  await db.prepare(`
    UPDATE vendors
    SET name = ?, contact_name = ?, contact_email = ?, contact_phone = ?, address = ?, notes = ?, is_active = ?, updated_at = ?
    WHERE id = ?
  `).run(name, contactName, contactEmail, contactPhone, address, notes, isActive, new Date().toISOString(), id)

  const row = await db.prepare('SELECT * FROM vendors WHERE id = ?').get(id) as VendorRow
  return { vendor: mapVendorRow(row) }
})
