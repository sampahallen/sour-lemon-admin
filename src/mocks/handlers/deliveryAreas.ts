import { http, HttpResponse } from 'msw'
import { deliveryAreas } from '../db'
import type { DeliveryArea, DeliveryAreaInput } from '@/api/deliveryAreas'

const slugify = (name: string) => name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')

export const deliveryAreaHandlers = [
  http.get('*/api/delivery-areas', () => {
    return HttpResponse.json({ deliveryAreas })
  }),

  http.post('*/api/delivery-areas', async ({ request }) => {
    const input = (await request.json()) as DeliveryAreaInput
    const deliveryArea: DeliveryArea = {
      id: crypto.randomUUID(),
      name: input.name,
      slug: slugify(input.name),
      deliveryFee: input.deliveryFee ?? null,
      isActive: input.isActive ?? true,
      sortOrder: input.sortOrder ?? deliveryAreas.length * 10,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    deliveryAreas.push(deliveryArea)
    return HttpResponse.json({ deliveryArea }, { status: 201 })
  }),

  http.patch('*/api/delivery-areas/:id', async ({ request, params }) => {
    const deliveryArea = deliveryAreas.find((area) => area.id === params.id)
    if (!deliveryArea) return new HttpResponse(null, { status: 404 })

    const input = (await request.json()) as Partial<DeliveryAreaInput>
    Object.assign(deliveryArea, input)
    if (input.name) deliveryArea.slug = slugify(input.name)
    deliveryArea.updatedAt = new Date().toISOString()

    return HttpResponse.json({ deliveryArea })
  }),

  http.delete('*/api/delivery-areas/:id', ({ params }) => {
    const index = deliveryAreas.findIndex((area) => area.id === params.id)
    if (index === -1) return new HttpResponse(null, { status: 404 })
    deliveryAreas.splice(index, 1)
    return new HttpResponse(null, { status: 204 })
  }),
]
