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
  paymentDisplayStatus: PaymentDisplayStatus
  paymentGroup: PaymentGroup
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
  availableActions: OrderAction[]
}

export type OrderAction =
  | 'confirm_payment'
  | 'collect_cash'
  | 'start_preparing'
  | 'mark_ready'
  | 'dispatch'
  | 'complete'
  | 'cancel'

export type PaymentDisplayStatus =
  | 'waiting_for_payment'
  | 'needs_review'
  | 'confirmed'
  | 'cash_due'
  | 'cash_collected'
  | 'failed'
  | 'refunded'

export type PaymentGroup = 'pending' | 'needs_attention' | 'paid' | 'refunded'

export interface OrderItemSummary {
  id: string
  productName: string
  productImageUrl: string | null
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
  id: string
  provider: PaymentProvider
  method: PaymentMethod
  paymentName: string | null
  status: PaymentStatus
  checkoutUrl: string | null
  amount: string
  displayStatus: PaymentDisplayStatus
  requiresManualConfirmation: boolean
  adminConfirmedAt: string | null
  adminConfirmedByUserId: string | null
  paidAt: string | null
}

export interface OrderDetail extends OrderSummary {
  deliveryAddress: DeliveryAddressSnapshot | null
  subtotal: string
  deliveryFee: string
  customerNotes: string | null
  items: OrderItemSummary[]
  statusHistory: OrderStatusHistoryEntry[]
  payment: OrderPaymentSummary | null
  allowedTransitions: OrderStatus[]
}

export interface OrderGroup {
  deliveryArea: { id: string; name: string } | null
  orders: OrderSummary[]
}

export interface WorkspaceOrder extends OrderSummary {
  items: { productName: string; quantity: number }[]
}

export interface OrderWorkspace {
  queues: {
    payment: WorkspaceOrder[]
    received: WorkspaceOrder[]
    preparing: WorkspaceOrder[]
    ready: WorkspaceOrder[]
    delivery: WorkspaceOrder[]
  }
  counts: Record<keyof OrderWorkspace['queues'], number>
  generatedAt: string
}

export interface ListOrdersParams {
  scope?: 'all' | 'active' | 'history'
  status?: OrderStatus
  paymentStatus?: PaymentStatus
  paymentGroup?: PaymentGroup
  fulfillmentType?: FulfillmentType
  deliveryAreaId?: string
  search?: string
  dateFrom?: string
  dateTo?: string
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

export function getOrderWorkspace(token: string) {
  return apiRequest<OrderWorkspace>('/api/orders/workspace', token)
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

export function confirmOrderPayment(token: string, id: string) {
  return apiRequest<{ order: OrderDetail }>(`/api/orders/${id}/confirm-payment`, token, { method: 'POST' })
}

export function collectOrderCash(token: string, id: string) {
  return apiRequest<{ order: OrderDetail }>(`/api/orders/${id}/collect-cash`, token, { method: 'POST' })
}
