import { apiRequest } from './client'
import type { CustomCakeStatus, Pagination } from './types'

export interface CustomCakeImage {
  id: string
  url: string
  storageKey: string
  createdAt: string
}

export interface CustomCakeRequestSummary {
  id: string
  customerName: string
  phoneNumber: string
  whatsappNumber: string | null
  occasion: string
  requestedSize: string
  status: CustomCakeStatus
  quotedAmount: string | null
  currency: string
  quotedAt: string | null
  quoteExpiresAt: string | null
  createdAt: string
}

export interface CustomCakeRequestDetail extends CustomCakeRequestSummary {
  notes: string | null
  images: CustomCakeImage[]
  orderId: string | null
}

export function listCustomCakeRequests(
  token: string,
  params: { status?: CustomCakeStatus; page?: number; limit?: number } = {},
) {
  const query = new URLSearchParams()
  if (params.status) query.set('status', params.status)
  if (params.page) query.set('page', String(params.page))
  if (params.limit) query.set('limit', String(params.limit))
  const search = query.toString()

  return apiRequest<{ requests: CustomCakeRequestSummary[]; pagination: Pagination }>(
    `/api/custom-cake-requests${search ? `?${search}` : ''}`,
    token,
  )
}

export function getCustomCakeRequest(token: string, id: string) {
  return apiRequest<{ request: CustomCakeRequestDetail }>(`/api/custom-cake-requests/${id}`, token)
}

export function quoteCustomCakeRequest(
  token: string,
  id: string,
  input: { quotedAmount: string; quoteExpiresAt?: string },
) {
  return apiRequest<{ request: CustomCakeRequestDetail }>(
    `/api/custom-cake-requests/${id}/quote`,
    token,
    { method: 'POST', json: input },
  )
}

export function rejectCustomCakeRequest(token: string, id: string, note?: string) {
  return apiRequest<{ request: CustomCakeRequestDetail }>(
    `/api/custom-cake-requests/${id}/reject`,
    token,
    { method: 'POST', json: { note } },
  )
}

export function cancelCustomCakeRequest(token: string, id: string) {
  return apiRequest<{ request: CustomCakeRequestDetail }>(
    `/api/custom-cake-requests/${id}/cancel`,
    token,
    { method: 'POST' },
  )
}

export function sendCustomCakePaymentLink(token: string, id: string) {
  return apiRequest<{ whatsappLink: string; message: string; paymentLink: string }>(
    `/api/custom-cake-requests/${id}/send-payment-link`,
    token,
    { method: 'POST' },
  )
}
