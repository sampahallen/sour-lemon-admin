import { useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { refreshSessionRequest, signInRequest, signOutRequest } from './authApi'
import type { AuthSession } from './authApi'
import { AuthContext } from './authContext'
import type { AuthContextValue } from './authContext'
import { AppLoadingScreen } from '@/components/ui/AppLoadingScreen'

const SESSION_STORAGE_KEY = 'sour-lemon-admin-auth-session'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<AuthSession | null>(null)
  const [isBootstrapping, setIsBootstrapping] = useState(true)
  const bootstrapStarted = useRef(false)

  useEffect(() => {
    if (bootstrapStarted.current) return
    bootstrapStarted.current = true
    sessionStorage.removeItem(SESSION_STORAGE_KEY)

    void refreshSessionRequest()
      .then(async (nextSession) => {
        if (nextSession.user.role !== 'admin') {
          await signOutRequest()
          throw new Error('This account does not have admin access.')
        }
        setSession(nextSession)
      })
      .catch(() => setSession(null))
      .finally(() => setIsBootstrapping(false))
  }, [])

  const clearSession = async () => {
    setSession(null)
    await signOutRequest().catch(() => undefined)
  }

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      signIn: async (credentials) => {
        const nextSession = await signInRequest(credentials)
        if (nextSession.user.role !== 'admin') {
          await signOutRequest()
          throw new Error('This account does not have admin access.')
        }
        setSession(nextSession)
      },
      signOut: clearSession,
    }),
    [session],
  )

  if (isBootstrapping) return <AppLoadingScreen />

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
