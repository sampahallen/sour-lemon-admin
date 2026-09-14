import { apiBaseUrl } from '@/auth/authApi'
import { accessTokenForRequest, hasRecentUserInteraction, isAuthenticationFailure, refreshSession } from '@/auth/sessionManager'

interface ApiErrorResponse {
  error?: string
  details?: Array<{ field: string; message: string }>
}

export class ApiRequestError extends Error {
  status: number
  details: Array<{ field: string; message: string }>

  constructor(message: string, status: number, details: Array<{ field: string; message: string }> = []) {
    super(message)
    this.name = 'ApiRequestError'
    this.status = status
    this.details = details
  }
}

interface ApiRequestInit extends Omit<RequestInit, 'body'> {
  json?: unknown
  body?: BodyInit
}

export async function apiRequest<T>(
  path: string,
  token: string,
  init: ApiRequestInit = {},
): Promise<T> {
  const { json, headers, ...rest } = init
  const isFormData = init.body instanceof FormData

  const send = (accessToken: string) => fetch(`${apiBaseUrl}${path}`, {
    ...rest,
    method: init.method ?? 'GET',
    headers: {
      ...(json && !isFormData ? { 'Content-Type': 'application/json' } : {}),
      Authorization: `Bearer ${accessToken}`,
      ...headers,
    },
    body: json !== undefined ? JSON.stringify(json) : init.body,
  })
  const accessToken = await accessTokenForRequest()
  let response = await send(accessToken ?? token)
  if (hasRecentUserInteraction() && await isAuthenticationFailure(response)) {
    const refreshed = await refreshSession(true)
    response = await send(refreshed.token)
  }

  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as ApiErrorResponse
    throw new ApiRequestError(
      body.error ?? 'Something went wrong. Please try again.',
      response.status,
      Array.isArray(body.details) ? body.details.filter((detail) => detail && typeof detail.field === 'string' && typeof detail.message === 'string') : [],
    )
  }

  if (response.status === 204) return undefined as T

  return response.json() as Promise<T>
}
