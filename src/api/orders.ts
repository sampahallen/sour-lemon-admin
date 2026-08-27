import { apiRequest } from './client'
import type {
  DeliveryAddressSnapshot,
  FulfillmentType,
  OrderStatus,
  Pagination,
  PaymentMethod,
  PaymentProvider,
  PaymentStatus,
} from './types'

export interface OrderSummary {
  id: string
  orderNumber: string
  status: OrderStatus
  paymentStatus: PaymentStatus
  fulfillmentType: FulfillmentType
  customerName: string
  phoneNumber: string
  whatsappNumber: string | null
  deliveryAreaId: string | null
  deliveryAreaName: string | null
  total: string
  currency: string
  placedAt: string | null
  createdAt: string
}

export interface OrderItemSummary {
  id: string
  productName: string
  quantity: number
  unitPrice: string
  lineTotal: string
}

export interface OrderStatusHistoryEntry {
  toStatus: OrderStatus
  fromStatus: OrderStatus | null
  note: string | null
  createdAt: string
}

export interface OrderPaymentSummary {
  provider: PaymentProvider
  method: PaymentMethod
  status: PaymentStatus
  checkoutUrl: string | null
  amount: string
}

export interface OrderDetail extends OrderSummary {
  deliveryAddress: DeliveryAddressSnapshot | null
  subtotal: string
  deliveryFee: string
  customerNotes: string | null
  items: OrderItemSummary[]
  statusHistory: OrderStatusHistoryEntry[]
  payment: OrderPaymentSummary | null
}

export interface OrderGroup {
  deliveryArea: { id: string; name: string } | null
  orders: OrderSummary[]
}

export interface ListOrdersParams {
  status?: OrderStatus
  deliveryAreaId?: string
  page?: number
  limit?: number
}

function toQueryString(params: Record<string, string | number | undefined>) {
  const query = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) query.set(key, String(value))
  }
  const search = query.toString()
  return search ? `?${search}` : ''
}

type QueryParams = Record<string, string | number | undefined>

export function listOrders(token: string, params: ListOrdersParams = {}) {
  return apiRequest<{ orders: OrderSummary[]; pagination: Pagination }>(
    `/api/orders${toQueryString(params as QueryParams)}`,
    token,
  )
}

export function listOrdersGroupedByDeliveryArea(token: string, status?: OrderStatus) {
  return apiRequest<{ groups: OrderGroup[] }>(
    `/api/orders/grouped-by-delivery-area${toQueryString({ status } as QueryParams)}`,
    token,
  )
}

export function getOrder(token: string, id: string) {
  return apiRequest<{ order: OrderDetail }>(`/api/orders/${id}`, token)
}

export function updateOrderStatus(token: string, id: string, toStatus: OrderStatus, note?: string) {
  return apiRequest<{ order: OrderDetail }>(`/api/orders/${id}/status`, token, {
    method: 'PATCH',
    json: { toStatus, note },
  })
}

export function sendOrderDeliveryMessage(token: string, id: string, deliveryTime: string) {
  return apiRequest<{ whatsappLink: string; message: string }>(
    `/api/orders/${id}/send-delivery-message`,
    token,
    { method: 'POST', json: { deliveryTime } },
  )
}
