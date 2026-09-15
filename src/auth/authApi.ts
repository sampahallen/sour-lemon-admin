import { normalizePhoneNumber } from '@/utils/phoneNumber'
import { apiBaseUrl } from '@/api/baseUrl'

export interface AuthUser {
  id: string
  name: string
  phoneNumber: string
  whatsappNumber: string | null
  role: 'customer' | 'admin'
  isActive: boolean
  isDeleted: boolean
  createdAt: string
  updatedAt: string
}

export interface AuthSession {
  user: AuthUser
  token: string
  tokenType: 'Bearer'
  expiresIn: string | number
  accessExpiresAt: string
  sessionExpiresAt: string
  idleExpiresAt: string
}

export interface SignInCredentials {
  phoneNumber: string
  password: string
}

interface ApiErrorResponse {
  error?: string
}

export { apiBaseUrl } from '@/api/baseUrl'

export async function signInRequest(credentials: SignInCredentials): Promise<AuthSession> {
  const response = await fetch(`${apiBaseUrl}/api/auth/signin`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ...credentials,
      phoneNumber: normalizePhoneNumber(credentials.phoneNumber),
    }),
  })

  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as ApiErrorResponse
    throw new Error(body.error ?? 'We could not sign you in. Please try again.')
  }

  return (await response.json()) as AuthSession
}

export async function refreshSessionRequest(): Promise<AuthSession> {
  const response = await fetch(`${apiBaseUrl}/api/auth/admin/refresh`, {
    method: 'POST',
    credentials: 'include',
  })

  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as ApiErrorResponse
    throw new Error(body.error ?? 'Your session has expired.')
  }

  return (await response.json()) as AuthSession
}

export async function signOutRequest(): Promise<void> {
  const response = await fetch(`${apiBaseUrl}/api/auth/admin/signout`, {
    method: 'POST',
    credentials: 'include',
  })
  if (!response.ok) throw new Error('Could not sign out.')
}
