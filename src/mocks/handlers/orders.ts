import { http, HttpResponse } from 'msw'
import { orders, deliveryAreas } from '../db'
import { buildDeliveryTimeMessage, buildWhatsAppLink } from '@/utils/whatsapp'
import type { OrderStatus } from '@/api/types'
import type { OrderGroup } from '@/api/orders'

export const orderHandlers = [
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

  http.get('*/api/orders', ({ request }) => {
    const url = new URL(request.url)
    const status = url.searchParams.get('status') as OrderStatus | null
    const deliveryAreaId = url.searchParams.get('deliveryAreaId')
    const page = Number(url.searchParams.get('page') ?? '1')
    const limit = Number(url.searchParams.get('limit') ?? '25')

    let filtered = orders
    if (status) filtered = filtered.filter((order) => order.status === status)
    if (deliveryAreaId) filtered = filtered.filter((order) => order.deliveryAreaId === deliveryAreaId)

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

    return HttpResponse.json({ order })
  }),

  http.post('*/api/orders/:id/send-delivery-message', async ({ request, params }) => {
    const order = orders.find((item) => item.id === params.id)
    if (!order) return new HttpResponse(null, { status: 404 })

    const { deliveryTime } = (await request.json()) as { deliveryTime: string }
    const message = buildDeliveryTimeMessage(order, deliveryTime)
    const whatsappLink = buildWhatsAppLink(order.whatsappNumber ?? order.phoneNumber, message)

    return HttpResponse.json({ whatsappLink, message })
  }),
]
