import type { OrderSummary } from '@/api/orders'
import type { CustomCakeRequestDetail } from '@/api/customCakeRequests'

export function buildWhatsAppLink(phoneNumber: string, message: string): string {
  const digits = phoneNumber.replace(/\D/g, '')
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`
}

export function buildDeliveryTimeMessage(order: OrderSummary, deliveryTime: string): string {
  return `Hi ${order.customerName}! Your Sour Lemon order #${order.orderNumber} will arrive around ${deliveryTime}. Thank you for your order!`
}

export function buildCustomCakeQuoteMessage(
  request: CustomCakeRequestDetail,
  paymentLink: string,
): string {
  return `Hi ${request.customerName}! Your custom cake quote is ${request.currency} ${request.quotedAmount}. Pay here to confirm: ${paymentLink}`
}
