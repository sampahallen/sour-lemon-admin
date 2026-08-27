import { useState } from 'react'
import type { FormEvent } from 'react'
import { Navigate, useNavigate } from 'react-router'
import { Button } from '@/components/ui/Button'
import { useAuth } from '@/auth/authContext'

export function SignIn() {
  const { session, signIn } = useAuth()
  const navigate = useNavigate()
  const [phoneNumber, setPhoneNumber] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  if (session) return <Navigate to="/orders" replace />

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setError(null)
    setIsSubmitting(true)
    try {
      await signIn({ phoneNumber, password })
      navigate('/orders', { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'We could not sign you in. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-cream px-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-8 shadow-[var(--shadow-chunky)]">
        <h1 className="mb-1 text-2xl font-bold">Sour Lemon Admin</h1>
        <p className="mb-6 text-sm text-cocoa/70">Sign in with your admin account.</p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <label className="flex flex-col gap-1 text-sm font-semibold">
            Phone number
            <input
              type="tel"
              required
              value={phoneNumber}
              onChange={(event) => setPhoneNumber(event.target.value)}
              className="rounded-lg border border-cocoa/20 px-3 py-2 font-body text-base font-normal outline-none focus:border-flame"
              placeholder="+233 20 123 4567"
            />
          </label>

          <label className="flex flex-col gap-1 text-sm font-semibold">
            Password
            <input
              type="password"
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="rounded-lg border border-cocoa/20 px-3 py-2 font-body text-base font-normal outline-none focus:border-flame"
            />
          </label>

          {error ? <p className="text-sm text-flame">{error}</p> : null}

          <Button type="submit" disabled={isSubmitting} className="mt-2 w-full">
            {isSubmitting ? 'Signing in…' : 'Sign in'}
          </Button>
        </form>
      </div>
    </div>
  )
}
