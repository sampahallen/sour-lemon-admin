import type { StatusTone } from '@/components/ui/StatusBadge'
import type { OrderStatus } from '@/api/types'
import type { PaymentGroup } from '@/api/orders'

export function orderStatusTone(status: OrderStatus): StatusTone {
  switch (status) {
    case 'received':
    case 'pending_payment':
    case 'confirmed':
      return 'info'
    case 'preparing':
      return 'orange'
    case 'ready_for_pickup':
      return 'positive'
    case 'out_for_delivery':
      return 'violet'
    case 'cancelled':
      return 'negative'
    case 'completed':
      return 'positive'
    default:
      return 'neutral'
  }
}

export const orderStatusLabel = (status: OrderStatus) => {
  if (['received', 'pending_payment', 'confirmed'].includes(status)) return 'Received'
  if (status === 'ready_for_pickup') return 'Ready'
  if (status === 'out_for_delivery') return 'Out for delivery'
  return status.replace(/_/g, ' ')
}

export const paymentGroupLabel = (group: PaymentGroup) => ({
  pending: 'Pending',
  needs_attention: 'Needs attention',
  paid: 'Paid',
  refunded: 'Refunded',
})[group]

export const paymentGroupTone = (group: PaymentGroup): StatusTone => ({
  pending: 'warning' as const,
  needs_attention: 'violet' as const,
  paid: 'positive' as const,
  refunded: 'neutral' as const,
})[group]
