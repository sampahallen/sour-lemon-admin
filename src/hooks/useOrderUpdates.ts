import { useEffect, useRef, useState } from 'react'
import { io } from 'socket.io-client'
import { apiBaseUrl } from '@/auth/authApi'

export interface OrderChangedEvent {
  orderId: string
  reason: 'created' | 'payment_updated' | 'payment_confirmed' | 'cash_collected' | 'status_updated'
}

export type OrderLiveStatus = 'connecting' | 'connected' | 'disconnected'

export function useOrderUpdates(token: string, onChanged: (event: OrderChangedEvent) => void) {
  const callbackRef = useRef(onChanged)
  const [status, setStatus] = useState<OrderLiveStatus>('connecting')

  useEffect(() => {
    callbackRef.current = onChanged
  }, [onChanged])

  useEffect(() => {
    const socket = io(apiBaseUrl, {
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnection: true,
    })
    socket.on('connect', () => setStatus('connected'))
    socket.on('disconnect', () => setStatus('disconnected'))
    socket.on('connect_error', () => setStatus('disconnected'))
    socket.on('orders:changed', (event: OrderChangedEvent) => callbackRef.current(event))
    return () => {
      socket.disconnect()
    }
  }, [token])

  return status
}
