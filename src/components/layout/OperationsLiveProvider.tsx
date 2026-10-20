import { useEffect, useRef, useState, type ReactNode } from 'react'
import { io } from 'socket.io-client'
import { useAuth } from '@/auth/authContext'
import { apiBaseUrl } from '@/auth/authApi'
import { getOperationsSummary, type OperationsSummary } from '@/api/operations'
import type { OrderChangedEvent, OrderLiveStatus } from '@/hooks/useOrderUpdates'
import { OperationsLiveContext } from './operationsLiveContext'

type OperationChangedEvent = { area: 'proofs' | 'cakes'; id: string; reason: string }

export function OperationsLiveProvider({ children }: { children: ReactNode }) {
  const { session } = useAuth()
  const token = session!.token
  const sequence = useRef(0)
  const [summary, setSummary] = useState<OperationsSummary | null>(null)
  const [status, setStatus] = useState<OrderLiveStatus>('connecting')
  const [revisions, setRevisions] = useState({ orders: 0, proofs: 0, cakes: 0 })
  const [lastOrderEvent, setLastOrderEvent] = useState<(OrderChangedEvent & { sequence: number }) | null>(null)

  useEffect(() => {
    let active = true
    let requestVersion = 0
    const refreshSummary = () => {
      const version = ++requestVersion
      void getOperationsSummary(token)
        .then((result) => { if (active && version === requestVersion) setSummary(result) })
        .catch(() => { if (active && version === requestVersion) setSummary(null) })
    }
    const refreshAll = () => {
      setRevisions((current) => ({ orders: current.orders + 1, proofs: current.proofs + 1, cakes: current.cakes + 1 }))
      refreshSummary()
    }
    const socket = io(apiBaseUrl, { auth: { token }, transports: ['websocket', 'polling'], reconnection: true })
    socket.on('connect', () => { setStatus('connected'); refreshAll() })
    socket.on('disconnect', () => setStatus('disconnected'))
    socket.on('connect_error', () => setStatus('disconnected'))
    socket.on('orders:changed', (event: OrderChangedEvent) => {
      setLastOrderEvent({ ...event, sequence: ++sequence.current })
      setRevisions((current) => ({ ...current, orders: current.orders + 1 }))
      refreshSummary()
    })
    socket.on('operations:changed', (event: OperationChangedEvent) => {
      if (event.area === 'proofs') setRevisions((current) => ({ ...current, proofs: current.proofs + 1 }))
      if (event.area === 'cakes') setRevisions((current) => ({ ...current, cakes: current.cakes + 1 }))
      refreshSummary()
    })
    const onVisible = () => { if (!document.hidden) refreshAll() }
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('focus', onVisible)
    const interval = window.setInterval(() => { if (!document.hidden) refreshAll() }, 30_000)
    refreshSummary()
    return () => {
      active = false
      socket.disconnect()
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('focus', onVisible)
      window.clearInterval(interval)
    }
  }, [token])

  return <OperationsLiveContext.Provider value={{ summary, status, revisions, lastOrderEvent }}>
    {children}
  </OperationsLiveContext.Provider>
}
