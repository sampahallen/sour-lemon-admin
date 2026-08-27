import { apiBaseUrl } from '@/auth/authApi'

interface ApiErrorResponse {
  error?: string
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

  const response = await fetch(`${apiBaseUrl}${path}`, {
    ...rest,
    method: init.method ?? 'GET',
    headers: {
      ...(json && !isFormData ? { 'Content-Type': 'application/json' } : {}),
      Authorization: `Bearer ${token}`,
      ...headers,
    },
    body: json !== undefined ? JSON.stringify(json) : init.body,
  })

  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as ApiErrorResponse
    throw new Error(body.error ?? 'Something went wrong. Please try again.')
  }

  if (response.status === 204) return undefined as T

  return response.json() as Promise<T>
}
