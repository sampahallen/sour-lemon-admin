import { useCallback, useEffect, useMemo, useState, useSyncExternalStore, type ReactNode } from 'react'
import { signInRequest, signOutRequest } from './authApi'
import { AuthContext } from './authContext'
import type { AuthContextValue } from './authContext'
import { acceptSession, clearSession, getAuthState, refreshSession, SessionEndedError, subscribeAuth } from './sessionManager'
import { SessionLifecycle } from './SessionLifecycle'
import { AppLoadingScreen } from '@/components/ui/AppLoadingScreen'

export function AuthProvider({ children }: { children: ReactNode }) {
  const auth = useSyncExternalStore(subscribeAuth, getAuthState)
  const [isBootstrapping, setIsBootstrapping] = useState(true)
  const [bootstrapError, setBootstrapError] = useState(false)
  const [bootAttempt, setBootAttempt] = useState(0)

  useEffect(() => {
    let active = true
    void refreshSession()
      .catch((error: unknown) => { if (active && !(error instanceof SessionEndedError)) setBootstrapError(true) })
      .finally(() => { if (active) setIsBootstrapping(false) })
    return () => { active = false }
  }, [bootAttempt])

  const signIn: AuthContextValue['signIn'] = useCallback(async (credentials) => {
    const session = await signInRequest(credentials)
    if (session.user.role !== 'admin') throw new Error('This account does not have admin access.')
    const previous = getAuthState()
    acceptSession(session)
    if (previous.requiresSignIn && previous.session && previous.session.user.id !== session.user.id) window.location.reload()
  }, [])

  const value = useMemo<AuthContextValue>(() => ({
    session: auth.session,
    signIn,
    signOut: async () => {
      await signOutRequest()
      clearSession()
    },
  }), [auth.session, signIn])

  if (isBootstrapping) return <AppLoadingScreen />
  if (bootstrapError) return (
    <div className="grid min-h-screen place-items-center bg-cream p-4 text-center">
      <div><p className="font-semibold">Could not reconnect to Sour Lemon Admin.</p>
        <button className="mt-3 rounded-lg bg-flame px-4 py-2 font-bold text-white" onClick={() => { setIsBootstrapping(true); setBootstrapError(false); setBootAttempt((attempt) => attempt + 1) }}>Try again</button>
      </div>
    </div>
  )
  return (
    <AuthContext.Provider value={value}>
      {children}
      <SessionLifecycle signIn={signIn} appName="admin" />
    </AuthContext.Provider>
  )
}
