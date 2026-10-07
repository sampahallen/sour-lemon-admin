import { apiRequest } from './client'
import { apiBaseUrl } from '@/auth/authApi'
import { accessTokenForRequest } from '@/auth/sessionManager'
import type { PaymentProofSummary } from './orders'

export interface QueuedProof extends PaymentProofSummary {
  orderId: string | null
  customCakeRequestId: string | null
}

export const listPaymentProofs = (token: string) => apiRequest<{ proofs: QueuedProof[] }>('/api/payments/manual/proofs', token)
export const reviewPaymentProof = (token: string, id: string, decision: 'confirm' | 'reject', reason?: string) =>
  apiRequest<{ proof: PaymentProofSummary }>(`/api/payments/manual/proofs/${id}/review`, token, { method: 'POST', json: { decision, reason } })

export async function loadPaymentProofImage(id: string) {
  const token = await accessTokenForRequest()
  const response = await fetch(`${apiBaseUrl}/api/payments/manual/proofs/${id}/image`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  })
  if (!response.ok) throw new Error('Could not open proof image')
  return URL.createObjectURL(await response.blob())
}
