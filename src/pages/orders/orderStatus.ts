import type { StatusTone } from '@/components/ui/StatusBadge'
import type { OrderStatus } from '@/api/types'

export function orderStatusTone(status: OrderStatus): StatusTone {
  switch (status) {
    case 'cancelled':
      return 'negative'
    case 'pending_payment':
      return 'warning'
    case 'confirmed':
    case 'out_for_delivery':
    case 'completed':
      return 'positive'
    default:
      return 'neutral'
  }
}
