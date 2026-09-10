import { http, HttpResponse } from 'msw'
import { appSettings, orders, deliveryAreas } from '../db'
import type { OrderStatus } from '@/api/types'
import type { OrderAction, OrderDetail, OrderGroup, OrderWorkspace, PaymentDisplayStatus, PaymentGroup } from '@/api/orders'
import type { WhatsAppOptions, WhatsAppTemplate } from '@/api/whatsapp'

const allowedTransitions = (order: OrderDetail): OrderStatus[] => {
  switch (order.status) {
    case 'pending_payment':
    case 'confirmed':
    case 'received':
      return ['preparing', 'cancelled']
    case 'preparing':
      return order.fulfillmentType === 'sour_lemon_delivery' ? ['out_for_delivery'] : ['ready_for_pickup']
    case 'ready_for_pickup':
    case 'out_for_delivery':
      return ['completed']
    case 'completed':
    case 'cancelled':
      return []
  }
}

const paymentDisplayStatus = (order: OrderDetail): PaymentDisplayStatus => {
  if (order.payment?.provider === 'cash') {
    return order.payment.status === 'cash_collected' ? 'cash_collected' : 'cash_due'
  }
  if (order.payment?.status === 'paid') {
    return order.payment.requiresManualConfirmation && !order.payment.adminConfirmedAt ? 'needs_review' : 'confirmed'
  }
  if (order.payment?.status === 'failed') return 'failed'
  if (order.payment?.status === 'refunded') return 'refunded'
  return 'waiting_for_payment'
}

const paymentGroup = (displayStatus: PaymentDisplayStatus): PaymentGroup => {
  if (displayStatus === 'waiting_for_payment' || displayStatus === 'cash_due') return 'pending'
  if (displayStatus === 'needs_review' || displayStatus === 'failed') return 'needs_attention'
  if (displayStatus === 'refunded') return 'refunded'
  return 'paid'
}

const availableActions = (order: OrderDetail): OrderAction[] => {
  const actions: OrderAction[] = []
  const displayStatus = paymentDisplayStatus(order)
  if (displayStatus === 'needs_review') actions.push('confirm_payment')
  if (displayStatus === 'cash_due') actions.push('collect_cash')
  if (['received', 'confirmed', 'pending_payment'].includes(order.status) && displayStatus !== 'needs_review' && displayStatus !== 'waiting_for_payment') {
    actions.push('start_preparing')
  }
  if (order.status === 'preparing') actions.push(order.fulfillmentType === 'sour_lemon_delivery' ? 'dispatch' : 'mark_ready')
  if (['ready_for_pickup', 'out_for_delivery'].includes(order.status) && displayStatus !== 'cash_due') actions.push('complete')
  if (!['completed', 'cancelled'].includes(order.status)) actions.push('cancel')
  return actions
}

const refreshOrder = (order: OrderDetail) => {
  order.paymentDisplayStatus = paymentDisplayStatus(order)
  order.paymentGroup = paymentGroup(order.paymentDisplayStatus)
  order.availableActions = availableActions(order)
  order.allowedTransitions = allowedTransitions(order)
  if (order.payment) order.payment.displayStatus = order.paymentDisplayStatus
}

const mockWhatsAppOptions = (order: OrderDetail): WhatsAppOptions => {
  const greeting = `Hi ${order.customerName}!`
  const reference = `order #${order.orderNumber}`
  const pickupLocation = appSettings.find((setting) => setting.key === 'pickup_location')?.value
  const templates: WhatsAppTemplate[] = [
    { id: 'received', label: 'Order received', message: `${greeting} We’ve received your Sour Lemon ${reference}. We’ll let you know as it moves along. Thank you!` },
    ...(order.payment?.status === 'pending' && order.payment.checkoutUrl
      ? [{ id: 'payment_reminder', label: 'Payment reminder', message: `${greeting} A quick reminder to complete payment for your Sour Lemon ${reference}: ${order.payment.checkoutUrl}` }]
      : []),
    { id: 'preparing', label: 'Preparing your order', message: `${greeting} We’re now preparing your Sour Lemon ${reference}. We’ll message you again when it’s ready.` },
    ...(order.fulfillmentType !== 'sour_lemon_delivery'
      ? [{ id: 'ready', label: order.fulfillmentType === 'pickup' ? 'Ready for pickup' : 'Ready for your rider', message: `${greeting} Your Sour Lemon ${reference} is ready${typeof pickupLocation === 'string' ? ` at ${pickupLocation}` : ''}.` }]
      : []),
    ...(order.fulfillmentType === 'sour_lemon_delivery'
      ? [{ id: 'delivery', label: 'Out for delivery / ETA', message: `${greeting} Your Sour Lemon ${reference} is out for delivery and on its way. We’ll keep you updated.` }]
      : []),
    { id: 'completed', label: 'Thank you', message: `${greeting} Your Sour Lemon ${reference} is complete. Thank you for ordering with us—we hope you enjoy every bite!` },
    { id: 'custom', label: 'Custom update', message: `${greeting} ` },
  ]
  const recommendedByStatus: Partial<Record<OrderStatus, string>> = {
    received: 'received',
    pending_payment: templates.some((item) => item.id === 'payment_reminder') ? 'payment_reminder' : 'received',
    confirmed: 'received',
    preparing: 'preparing',
    ready_for_pickup: 'ready',
    out_for_delivery: 'delivery',
    completed: 'completed',
    cancelled: 'custom',
  }
  return {
    recipient: {
      number: order.whatsappNumber ?? order.phoneNumber,
      source: order.whatsappNumber ? 'whatsapp' : 'phone',
    },
    recommendedTemplateId: recommendedByStatus[order.status] ?? 'custom',
    templates,
  }
}

export const orderHandlers = [
  http.get('*/api/orders/workspace', () => {
    orders.forEach(refreshOrder)
    const active = orders.filter((order) => !['completed', 'cancelled'].includes(order.status))
    const toWorkspaceOrder = (order: OrderDetail) => ({
      ...order,
      items: order.items.map(({ productName, quantity }) => ({ productName, quantity })),
    })
    const queues: OrderWorkspace['queues'] = {
      payment: active.filter((order) => ['waiting_for_payment', 'needs_review', 'cash_due', 'failed'].includes(order.paymentDisplayStatus)).map(toWorkspaceOrder),
      received: active.filter((order) => ['received', 'confirmed', 'pending_payment'].includes(order.status)).map(toWorkspaceOrder),
      preparing: active.filter((order) => order.status === 'preparing').map(toWorkspaceOrder),
      ready: active.filter((order) => order.status === 'ready_for_pickup').map(toWorkspaceOrder),
      delivery: active.filter((order) => order.status === 'out_for_delivery').map(toWorkspaceOrder),
    }
    return HttpResponse.json({
      queues,
      counts: Object.fromEntries(Object.entries(queues).map(([key, value]) => [key, value.length])),
      generatedAt: new Date().toISOString(),
    })
  }),

  http.get('*/api/orders/grouped-by-delivery-area', ({ request }) => {
    const url = new URL(request.url)
    const status = url.searchParams.get('status') as OrderStatus | null
    const filtered = status ? orders.filter((order) => order.status === status) : orders

    const groups: OrderGroup[] = deliveryAreas.map((area) => ({
      deliveryArea: { id: area.id, name: area.name },
      orders: filtered.filter((order) => order.deliveryAreaId === area.id),
    }))
    const unassigned = filtered.filter((order) => !order.deliveryAreaId)
    if (unassigned.length) groups.push({ deliveryArea: null, orders: unassigned })

    return HttpResponse.json({ groups })
  }),

  http.get('*/api/orders/:id', ({ params }) => {
    const order = orders.find((item) => item.id === params.id)
    if (!order) return new HttpResponse(null, { status: 404 })
    return HttpResponse.json({ order })
  }),

  http.get('*/api/orders/:id/whatsapp-options', ({ params }) => {
    const order = orders.find((item) => item.id === params.id)
    if (!order) return new HttpResponse(null, { status: 404 })
    return HttpResponse.json(mockWhatsAppOptions(order))
  }),

  http.get('*/api/orders', ({ request }) => {
    const url = new URL(request.url)
    const status = url.searchParams.get('status') as OrderStatus | null
    const deliveryAreaId = url.searchParams.get('deliveryAreaId')
    const scope = url.searchParams.get('scope')
    const paymentStatus = url.searchParams.get('paymentStatus')
    const requestedPaymentGroup = url.searchParams.get('paymentGroup') as PaymentGroup | null
    const fulfillmentType = url.searchParams.get('fulfillmentType')
    const search = url.searchParams.get('search')?.toLowerCase()
    const page = Number(url.searchParams.get('page') ?? '1')
    const limit = Number(url.searchParams.get('limit') ?? '25')

    orders.forEach(refreshOrder)
    let filtered = orders
    if (status) filtered = filtered.filter((order) => order.status === status)
    if (deliveryAreaId) filtered = filtered.filter((order) => order.deliveryAreaId === deliveryAreaId)
    if (scope === 'active') filtered = filtered.filter((order) => !['completed', 'cancelled'].includes(order.status))
    if (scope === 'history') filtered = filtered.filter((order) => ['completed', 'cancelled'].includes(order.status))
    if (paymentStatus) filtered = filtered.filter((order) => order.paymentStatus === paymentStatus)
    if (requestedPaymentGroup) filtered = filtered.filter((order) => order.paymentGroup === requestedPaymentGroup)
    if (fulfillmentType) filtered = filtered.filter((order) => order.fulfillmentType === fulfillmentType)
    if (search) filtered = filtered.filter((order) => `${order.orderNumber} ${order.customerName} ${order.phoneNumber}`.toLowerCase().includes(search))
    const start = (page - 1) * limit
    const page_ = filtered.slice(start, start + limit)

    return HttpResponse.json({
      orders: page_,
      pagination: { page, limit, total: filtered.length, totalPages: Math.ceil(filtered.length / limit) },
    })
  }),

  http.patch('*/api/orders/:id/status', async ({ request, params }) => {
    const order = orders.find((item) => item.id === params.id)
    if (!order) return new HttpResponse(null, { status: 404 })

    const { toStatus, note } = (await request.json()) as { toStatus: OrderStatus; note?: string }
    order.statusHistory.push({ toStatus, fromStatus: order.status, note: note ?? null, createdAt: new Date().toISOString() })
    order.status = toStatus
    refreshOrder(order)

    return HttpResponse.json({ order })
  }),

  http.post('*/api/orders/:id/confirm-payment', ({ params }) => {
    const order = orders.find((item) => item.id === params.id)
    if (!order?.payment || order.payment.provider !== 'paystack' || order.payment.status !== 'paid') {
      return new HttpResponse(null, { status: 409 })
    }
    order.payment.adminConfirmedAt = new Date().toISOString()
    order.payment.adminConfirmedByUserId = idForMockAdmin
    refreshOrder(order)
    return HttpResponse.json({ order })
  }),

  http.post('*/api/orders/:id/collect-cash', ({ params }) => {
    const order = orders.find((item) => item.id === params.id)
    if (!order?.payment || order.payment.provider !== 'cash') return new HttpResponse(null, { status: 409 })
    order.payment.status = 'cash_collected'
    order.paymentStatus = 'cash_collected'
    order.payment.paidAt = new Date().toISOString()
    order.payment.adminConfirmedAt = order.payment.paidAt
    order.payment.adminConfirmedByUserId = idForMockAdmin
    refreshOrder(order)
    return HttpResponse.json({ order })
  }),

]

const idForMockAdmin = '00000000-0000-4000-8000-000000000001'
