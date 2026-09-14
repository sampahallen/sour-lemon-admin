import { useState } from 'react'
import type { FormEvent } from 'react'
import { Navigate, useNavigate } from 'react-router'
import { Button } from '@/components/ui/Button'
import { useAuth } from '@/auth/authContext'
import { useFormValidation, type FieldErrors } from '@/hooks/useFormValidation'
import { normalizePhoneNumber } from '@/utils/phoneNumber'

export function SignIn() {
  const { session, signIn } = useAuth()
  const navigate = useNavigate()
  const [phoneNumber, setPhoneNumber] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  type SignInField = 'phoneNumber' | 'password'
  const validate = (): FieldErrors<SignInField> => {
    const errors: FieldErrors<SignInField> = {}
    if (!phoneNumber.trim()) errors.phoneNumber = 'Enter your phone number.'
    else if (!/^\+[1-9]\d{7,14}$/.test(normalizePhoneNumber(phoneNumber))) errors.phoneNumber = 'Enter a valid phone number.'
    if (!password) errors.password = 'Enter your password.'
    return errors
  }
  const validation = useFormValidation<SignInField>('sign-in', validate)

  if (session) return <Navigate to="/orders" replace />

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    if (!validation.submit()) return
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

        <form noValidate onSubmit={handleSubmit} className="flex flex-col gap-4">
          <label className="flex flex-col gap-1 text-sm font-semibold">
            Phone number
            <input
              {...validation.props('phoneNumber')}
              type="tel"
              value={phoneNumber}
              onChange={(event) => { setPhoneNumber(event.target.value); validation.changed('phoneNumber') }}
              className={`rounded-lg border border-cocoa/20 px-3 py-2 font-body text-base font-normal outline-none focus:border-flame ${validation.error('phoneNumber') ? 'border-flame bg-flame/5' : ''}`}
              placeholder="+233 20 123 4567"
            />
            {validation.error('phoneNumber') ? <span id="sign-in-phoneNumber-error" className="text-xs text-flame">{validation.error('phoneNumber')}</span> : null}
          </label>

          <label className="flex flex-col gap-1 text-sm font-semibold">
            Password
            <input
              {...validation.props('password')}
              type="password"
              value={password}
              onChange={(event) => { setPassword(event.target.value); validation.changed('password') }}
              className={`rounded-lg border border-cocoa/20 px-3 py-2 font-body text-base font-normal outline-none focus:border-flame ${validation.error('password') ? 'border-flame bg-flame/5' : ''}`}
            />
            {validation.error('password') ? <span id="sign-in-password-error" className="text-xs text-flame">{validation.error('password')}</span> : null}
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
