import type { Vendor } from '../../app/types/vendor'

export interface VendorRow {
  id: string
  name: string
  contact_name: string | null
  contact_email: string | null
  contact_phone: string | null
  address: string | null
  notes: string | null
  is_active: number
  created_at: string
  updated_at: string
}

export function mapVendorRow(row: VendorRow): Vendor {
  return {
    id: row.id,
    name: row.name,
    contactName: row.contact_name ?? undefined,
    contactEmail: row.contact_email ?? undefined,
    contactPhone: row.contact_phone ?? undefined,
    address: row.address ?? undefined,
    notes: row.notes ?? undefined,
    isActive: !!row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export async function getAllVendors(): Promise<Vendor[]> {
  const db = useDatabase()
  const rows = await db.prepare('SELECT * FROM vendors ORDER BY name ASC').all() as VendorRow[]
  return rows.map(mapVendorRow)
}
