import type { StatusTone } from '@/components/ui/StatusBadge'
import type { CustomCakeStatus } from '@/api/types'

export function customCakeStatusTone(status: CustomCakeStatus): StatusTone {
  switch (status) {
    case 'rejected':
    case 'cancelled':
      return 'negative'
    case 'submitted':
      return 'warning'
    case 'confirmed':
      return 'positive'
    default:
      return 'neutral'
  }
}
