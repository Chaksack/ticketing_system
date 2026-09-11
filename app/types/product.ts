export interface Product {
  id: string
  name: string
  description?: string
  unitPrice: number
  currency: string
  createdAt: string
  updatedAt: string
}

export interface LineItem {
  id: string
  productId?: string
  productName: string
  unitPrice: number
  currency: string
  quantity: number
  createdAt: string
}
