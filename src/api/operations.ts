import { apiRequest } from './client'

export interface OperationsSummary {
  orders: number
  proofs: number
  cakes: number
}

export const getOperationsSummary = (token: string) =>
  apiRequest<OperationsSummary>('/api/operations/summary', token)
