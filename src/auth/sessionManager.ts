import { apiBaseUrl } from '@/api/baseUrl'
import type { AuthSession } from './authApi'

type AuthState = {
  session: AuthSession | null
  requiresSignIn: boolean
  connectionError: boolean
}

export class SessionEndedError extends Error {}

const role = 'admin'
let state: AuthState = { session: null, requiresSignIn: false, connectionError: false }
let refreshPromise: Promise<AuthSession> | null = null
let lastUserInteraction = 0
let authEpoch = 0
let signedOut = false
const listeners = new Set<() => void>()
const channel = typeof BroadcastChannel === 'undefined' ? null : new BroadcastChannel(`sour-lemon-${role}-auth`)

const publish = (next: AuthState) => {
  state = next
  listeners.forEach((listener) => listener())
}

channel?.addEventListener('message', (event: MessageEvent<{ type: string; session?: AuthSession }>) => {
  if (event.data?.type === 'session' && event.data.session) {
    if (signedOut || (state.session && Date.parse(event.data.session.idleExpiresAt) < Date.parse(state.session.idleExpiresAt))) return
    publish({ session: event.data.session, requiresSignIn: false, connectionError: false })
  }
  if (event.data?.type === 'signout') {
    authEpoch += 1
    signedOut = true
    publish({ session: null, requiresSignIn: false, connectionError: false })
  }
})

export const subscribeAuth = (listener: () => void) => {
  listeners.add(listener)
  return () => listeners.delete(listener)
}
export const getAuthState = () => state
export const getCurrentSession = () => state.session
export const recordUserInteraction = () => { lastUserInteraction = Date.now() }
export const hasRecentUserInteraction = () => Date.now() - lastUserInteraction < 5 * 60_000

export const isAuthenticationFailure = async (response: Response) => {
  if (response.status !== 401) return false
  const body = await response.clone().json().catch(() => ({})) as { error?: string }
  return body.error === 'Invalid or expired token' || body.error === 'Authentication required'
}

export const acceptSession = (session: AuthSession) => {
  signedOut = false
  publish({ session, requiresSignIn: false, connectionError: false })
  channel?.postMessage({ type: 'session', session })
}

export const clearSession = () => {
  authEpoch += 1
  signedOut = true
  publish({ session: null, requiresSignIn: false, connectionError: false })
  channel?.postMessage({ type: 'signout' })
}

export const requireSignIn = () => publish({ ...state, requiresSignIn: true, connectionError: false })

const refreshRequest = async (path: string) => fetch(`${apiBaseUrl}${path}`, {
  method: 'POST',
  credentials: 'include',
})

const refreshOnce = async (): Promise<AuthSession> => {
  const startedAtEpoch = authEpoch
  const initialToken = state.session?.token
  let response = await refreshRequest(`/api/auth/${role}/refresh`)
  if (response.status === 401) response = await refreshRequest('/api/auth/refresh')
  for (let attempt = 0; response.status === 409 && attempt < 3; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 350 * (attempt + 1)))
    if (state.session && state.session.token !== initialToken) return state.session
    response = await refreshRequest(`/api/auth/${role}/refresh`)
  }
  if (response.status === 401 || response.status === 403) {
    if (state.session) requireSignIn()
    throw new SessionEndedError('Your session has ended. Please sign in again.')
  }
  if (!response.ok) throw new Error('Could not reconnect. Please try again.')
  const session = await response.json() as AuthSession
  if (startedAtEpoch !== authEpoch || signedOut) throw new Error('This session was signed out.')
  if (session.user.role !== role) {
    requireSignIn()
    throw new Error('This account does not have admin access.')
  }
  acceptSession(session)
  return session
}

export const refreshSession = (force = false): Promise<AuthSession> => {
  if (refreshPromise) return refreshPromise
  const previousToken = state.session?.token
  const run = async () => {
    if (!force && previousToken && state.session?.token !== previousToken &&
      Date.parse(state.session!.accessExpiresAt) > Date.now() + 60_000) return state.session!
    return refreshOnce()
  }
  refreshPromise = (async () => {
    try {
      const locks = typeof navigator === 'undefined' ? undefined : navigator.locks
      return locks ? await locks.request(`sour-lemon-${role}-refresh`, run) : await run()
    } catch (error) {
      if (state.session && !state.requiresSignIn) publish({ ...state, connectionError: true })
      throw error
    } finally {
      refreshPromise = null
    }
  })()
  return refreshPromise
}

export const accessTokenForRequest = async () => {
  if (state.requiresSignIn) throw new SessionEndedError('Your session has ended. Please sign in again.')
  const session = state.session
  if (!session) return null
  if (hasRecentUserInteraction() && Date.parse(session.accessExpiresAt) <= Date.now() + 60_000) return (await refreshSession()).token
  return session.token
}
