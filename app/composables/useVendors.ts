import type { Vendor } from '~/types/vendor'

export interface NewVendor {
  name: string
  contactName?: string
  contactEmail?: string
  contactPhone?: string
  address?: string
  notes?: string
}

export function useVendors() {
  const vendors = useState<Vendor[]>('vendors-list', () => [])

  async function fetchVendors() {
    const { vendors: rows } = await $fetch<{ vendors: Vendor[] }>('/api/vendors')
    vendors.value = rows
  }

  async function addVendor(payload: NewVendor) {
    const { vendor } = await $fetch<{ vendor: Vendor }>('/api/vendors', { method: 'POST', body: payload })
    vendors.value.push(vendor)
    return vendor
  }

  async function updateVendor(id: string, patch: Partial<NewVendor> & { isActive?: boolean }) {
    const { vendor } = await $fetch<{ vendor: Vendor }>(`/api/vendors/${id}`, { method: 'PATCH', body: patch })
    const index = vendors.value.findIndex(v => v.id === id)
    if (index !== -1)
      vendors.value[index] = vendor
    return vendor
  }

  async function removeVendor(id: string) {
    await $fetch(`/api/vendors/${id}`, { method: 'DELETE' })
    vendors.value = vendors.value.filter(v => v.id !== id)
  }

  return { vendors, fetchVendors, addVendor, updateVendor, removeVendor }
}
