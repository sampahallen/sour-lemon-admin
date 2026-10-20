import { apiRequest } from './client'

export interface Subscriber {
  id: string
  email: string
  status: 'pending' | 'confirmed' | 'unsubscribed' | 'suppressed'
  confirmed_at: string | null
  consented_at: string
}

export const listSubscribers = (token: string, search: string, page: number) => apiRequest<{ subscribers: Subscriber[]; counts: Record<string, number> }>(
  `/api/newsletter/admin/subscribers?search=${encodeURIComponent(search)}&page=${page}`, token,
)
export const suppressSubscriber = (token: string, id: string) => apiRequest<void>(`/api/newsletter/admin/subscribers/${id}/suppress`, token, { method: 'POST' })
