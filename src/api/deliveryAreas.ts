import { apiRequest } from './client'

export interface DeliveryArea {
  id: string
  name: string
  slug: string
  deliveryFee: string | null
  isActive: boolean
  sortOrder: number
  createdAt: string
  updatedAt: string
}

export interface DeliveryAreaInput {
  name: string
  deliveryFee?: string | null
  isActive?: boolean
  sortOrder?: number
}

export function listDeliveryAreas(token: string) {
  return apiRequest<{ deliveryAreas: DeliveryArea[] }>('/api/delivery-areas', token)
}

export function createDeliveryArea(token: string, input: DeliveryAreaInput) {
  return apiRequest<{ deliveryArea: DeliveryArea }>('/api/delivery-areas', token, {
    method: 'POST',
    json: input,
  })
}

export function updateDeliveryArea(token: string, id: string, input: Partial<DeliveryAreaInput>) {
  return apiRequest<{ deliveryArea: DeliveryArea }>(`/api/delivery-areas/${id}`, token, {
    method: 'PATCH',
    json: input,
  })
}

export function deleteDeliveryArea(token: string, id: string) {
  return apiRequest<void>(`/api/delivery-areas/${id}`, token, { method: 'DELETE' })
}
