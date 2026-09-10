export function buildWhatsAppLink(phoneNumber: string, message: string): string {
  const digits = phoneNumber.replace(/\D/g, '')
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`
}
