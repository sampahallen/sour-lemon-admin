import { apiRequest } from './client'

export interface ProductImage {
  id: string
  productId: string
  url: string
  storageKey: string
  altText: string | null
  sortOrder: number
}

export interface ProductSummary {
  id: string
  categoryId: string
  name: string
  slug: string
  price: string
  currency: string
  isActive: boolean
  coverImageUrl: string | null
  description: string | null
  availableFrom: string | null
  availableUntil: string | null
}

export interface ProductDetail extends ProductSummary {
  images: ProductImage[]
}

export interface ProductInput {
  categoryId: string
  name: string
  slug?: string
  description?: string | null
  price: string
  isActive?: boolean
  currency?: string
  availableFrom?: string | null
  availableUntil?: string | null
}

export function listProducts(
  token: string,
  params: { categoryId?: string; includeInactive?: boolean } = {},
) {
  const query = new URLSearchParams()
  if (params.categoryId) query.set('categoryId', params.categoryId)
  if (params.includeInactive) query.set('includeInactive', 'true')
  const search = query.toString()

  return apiRequest<{ products: ProductSummary[] }>(`/api/products${search ? `?${search}` : ''}`, token)
}

export function getProduct(token: string, id: string) {
  return apiRequest<{ product: ProductDetail }>(`/api/products/${id}`, token)
}

export function createProduct(token: string, input: ProductInput) {
  return apiRequest<{ product: ProductDetail }>('/api/products', token, { method: 'POST', json: input })
}

export function updateProduct(token: string, id: string, input: Partial<ProductInput>) {
  return apiRequest<{ product: ProductDetail }>(`/api/products/${id}`, token, {
    method: 'PATCH',
    json: input,
  })
}

export function deleteProduct(token: string, id: string) {
  return apiRequest<void>(`/api/products/${id}`, token, { method: 'DELETE' })
}

export function uploadProductImage(token: string, productId: string, file: File, altText: string) {
  const formData = new FormData()
  formData.append('file', file)
  formData.append('altText', altText)
  return apiRequest<{ image: ProductImage }>(`/api/products/${productId}/images`, token, {
    method: 'POST',
    body: formData,
  })
}

export function deleteProductImage(token: string, productId: string, imageId: string) {
  return apiRequest<void>(`/api/products/${productId}/images/${imageId}`, token, { method: 'DELETE' })
}

export function reorderProductImages(token: string, productId: string, imageIds: string[]) {
  return apiRequest<{ images: ProductImage[] }>(`/api/products/${productId}/images/reorder`, token, {
    method: 'PATCH',
    json: { imageIds },
  })
}
