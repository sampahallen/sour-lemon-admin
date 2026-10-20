import { createContext, useContext } from 'react'
import type { OperationsSummary } from '@/api/operations'
import type { OrderChangedEvent, OrderLiveStatus } from '@/hooks/useOrderUpdates'

export interface OperationsLiveValue {
  summary: OperationsSummary | null
  status: OrderLiveStatus
  revisions: { orders: number; proofs: number; cakes: number }
  lastOrderEvent: (OrderChangedEvent & { sequence: number }) | null
}

export const OperationsLiveContext = createContext<OperationsLiveValue | null>(null)

export function useOperationsLive() {
  const context = useContext(OperationsLiveContext)
  if (!context) throw new Error('useOperationsLive must be used inside OperationsLiveProvider')
  return context
}
