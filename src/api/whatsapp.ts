import { apiRequest } from './client'

export interface WhatsAppTemplate {
  id: string
  label: string
  message: string
}

export interface WhatsAppOptions {
  recipient: {
    number: string
    source: 'whatsapp' | 'phone'
  }
  recommendedTemplateId: string
  templates: WhatsAppTemplate[]
}

export function getOrderWhatsAppOptions(token: string, orderId: string) {
  return apiRequest<WhatsAppOptions>(`/api/orders/${orderId}/whatsapp-options`, token)
}

export function getCustomCakeWhatsAppOptions(token: string, requestId: string) {
  return apiRequest<WhatsAppOptions>(`/api/custom-cake-requests/${requestId}/whatsapp-options`, token)
}
