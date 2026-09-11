import type { Product } from '~/types/product'

export interface NewProduct {
  name: string
  description?: string
  unitPrice: number
  currency?: string
}

export function useProducts() {
  const products = useState<Product[]>('products-list', () => [])

  async function fetchProducts() {
    const { products: rows } = await $fetch('/api/products')
    products.value = rows
  }

  async function addProduct(payload: NewProduct) {
    const { product } = await $fetch('/api/products', { method: 'POST', body: payload })
    products.value.push(product)
    return product
  }

  async function updateProduct(id: string, patch: Partial<NewProduct>) {
    const { product } = await $fetch<{ product: Product }>(`/api/products/${id}`, { method: 'PATCH', body: patch })
    const index = products.value.findIndex(p => p.id === id)
    if (index !== -1)
      products.value[index] = product
    return product
  }

  async function removeProduct(id: string) {
    await $fetch(`/api/products/${id}`, { method: 'DELETE' })
    products.value = products.value.filter(p => p.id !== id)
  }

  return { products, fetchProducts, addProduct, updateProduct, removeProduct }
}
