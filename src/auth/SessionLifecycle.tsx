import { useEffect, useRef, useState, type FormEvent } from 'react'
import type { SignInCredentials } from './authApi'
import { getAuthState, recordUserInteraction, refreshSession, subscribeAuth } from './sessionManager'
import { useSyncExternalStore } from 'react'

export function SessionLifecycle({ signIn, appName }: {
  signIn: (credentials: SignInCredentials) => Promise<void>
  appName: string
}) {
  const auth = useSyncExternalStore(subscribeAuth, getAuthState)
  const [now, setNow] = useState(0)
  const lastInteraction = useRef(0)
  const phoneInput = useRef<HTMLInputElement>(null)
  const overlay = useRef<HTMLDivElement>(null)
  const [phoneNumber, setPhoneNumber] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    const interacted = () => { lastInteraction.current = Date.now(); recordUserInteraction() }
    const initialClock = window.setTimeout(() => setNow(Date.now()), 0)
    window.addEventListener('pointerdown', interacted)
    window.addEventListener('keydown', interacted)
    const interval = window.setInterval(() => setNow(Date.now()), 30_000)
    return () => {
      window.removeEventListener('pointerdown', interacted)
      window.removeEventListener('keydown', interacted)
      window.clearTimeout(initialClock)
      window.clearInterval(interval)
    }
  }, [])

  useEffect(() => {
    if (!auth.requiresSignIn) return
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const frame = requestAnimationFrame(() => phoneInput.current?.focus())
    return () => {
      cancelAnimationFrame(frame)
      previousFocus?.focus()
    }
  }, [auth.requiresSignIn])

  useEffect(() => {
    const session = auth.session
    if (!session || auth.requiresSignIn || document.visibilityState !== 'visible') return
    const deadline = Math.min(Date.parse(session.sessionExpiresAt), Date.parse(session.idleExpiresAt))
    if (now >= deadline ||
      (now - lastInteraction.current < 5 * 60_000 && now >= Date.parse(session.accessExpiresAt) - 60_000)) {
      void refreshSession(true).catch(() => undefined)
    }
  }, [auth.session, auth.requiresSignIn, now])

  const session = auth.session
  const idleRemaining = session ? Date.parse(session.idleExpiresAt) - now : Infinity
  const absoluteRemaining = session ? Date.parse(session.sessionExpiresAt) - now : Infinity
  const warn = !auth.requiresSignIn && Math.min(idleRemaining, absoluteRemaining) > 0 &&
    Math.min(idleRemaining, absoluteRemaining) <= 5 * 60_000

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await signIn({ phoneNumber, password })
      setPassword('')
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not sign in. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      {warn ? (
        <div role="status" className="fixed bottom-4 left-1/2 z-[70] w-[min(90vw,28rem)] -translate-x-1/2 rounded-xl border border-cocoa bg-white p-4 shadow-xl">
          <p className="text-sm font-semibold">{absoluteRemaining <= idleRemaining ? 'Your sign-in ends in under five minutes. Save your work.' : 'Your session is about to end from inactivity.'}</p>
          {absoluteRemaining > idleRemaining ? <button type="button" onClick={() => void refreshSession(true).catch(() => undefined)} className="mt-2 text-sm font-bold text-flame hover:underline">Continue session</button> : null}
        </div>
      ) : null}
      {auth.connectionError && !auth.requiresSignIn ? (
        <div role="status" className="fixed bottom-4 left-1/2 z-[70] w-[min(90vw,28rem)] -translate-x-1/2 rounded-xl border border-cocoa bg-white p-4 shadow-xl">
          <p className="text-sm font-semibold">Connection lost. Your page is still here.</p>
          <button type="button" onClick={() => void refreshSession(true).catch(() => undefined)} className="mt-2 text-sm font-bold text-flame hover:underline">Try again</button>
        </div>
      ) : null}
      {auth.requiresSignIn ? (
        <div
          ref={overlay}
          className="fixed inset-0 z-[80] flex items-center justify-center bg-cocoa/70 p-4"
          role="presentation"
          onKeyDown={(event) => {
            if (event.key !== 'Tab') return
            const controls = overlay.current?.querySelectorAll<HTMLElement>('input, button')
            if (!controls?.length) return
            const first = controls[0]
            const last = controls[controls.length - 1]
            if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus() }
            else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
          }}
        >
          <div role="dialog" aria-modal="true" aria-labelledby="session-ended-title" className="w-full max-w-sm rounded-2xl bg-cream p-6 shadow-xl">
            <h2 id="session-ended-title" className="text-2xl font-bold">Sign in to continue</h2>
            <p className="mt-2 text-sm text-cocoa/70">Your {appName} session has ended. This page will stay open.</p>
            <form onSubmit={(event) => void submit(event)} className="mt-5 flex flex-col gap-3">
              <label className="flex flex-col gap-1 text-sm font-semibold">Phone number
                <input ref={phoneInput} type="tel" autoComplete="username" required value={phoneNumber} onChange={(event) => setPhoneNumber(event.target.value)} className="rounded-lg border border-cocoa/20 px-3 py-2" />
              </label>
              <label className="flex flex-col gap-1 text-sm font-semibold">Password
                <input type="password" autoComplete="current-password" required value={password} onChange={(event) => setPassword(event.target.value)} className="rounded-lg border border-cocoa/20 px-3 py-2" />
              </label>
              {error ? <p role="alert" className="text-sm text-flame">{error}</p> : null}
              <button disabled={busy} type="submit" className="rounded-lg bg-flame px-4 py-2 font-bold text-white disabled:opacity-50">{busy ? 'Signing in…' : 'Sign in'}</button>
            </form>
          </div>
        </div>
      ) : null}
    </>
  )
}
