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
    <div className="grid min-h-screen bg-[#f7f6f2] lg:grid-cols-2">
      <div className="flex items-center justify-center px-5 py-12 sm:px-10">
      <div className="w-full max-w-md">
        <div className="mb-10 flex items-center gap-3"><span className="grid h-11 w-11 place-items-center rounded-xl bg-flame font-display text-2xl font-bold text-white">S</span><span className="font-display text-xl font-bold">Sour Lemon</span></div>
        <p className="mb-2 text-xs font-bold uppercase tracking-[0.2em] text-flame">Owner workspace</p>
        <h1 className="mb-2 text-4xl font-bold">Welcome back</h1>
        <p className="mb-8 text-sm text-cocoa/60">Sign in to manage today's orders and your storefront.</p>

        <form noValidate onSubmit={handleSubmit} className="flex flex-col gap-4">
          <label className="flex flex-col gap-1 text-sm font-semibold">
            Phone number
            <input
              {...validation.props('phoneNumber')}
              type="tel"
              value={phoneNumber}
              onChange={(event) => { setPhoneNumber(event.target.value); validation.changed('phoneNumber') }}
              className={`rounded-xl border border-cocoa/20 bg-white px-4 py-3 font-body text-base font-normal outline-none focus:border-flame ${validation.error('phoneNumber') ? 'border-flame bg-flame/5' : ''}`}
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
              className={`rounded-xl border border-cocoa/20 bg-white px-4 py-3 font-body text-base font-normal outline-none focus:border-flame ${validation.error('password') ? 'border-flame bg-flame/5' : ''}`}
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
      <div className="relative hidden overflow-hidden bg-cocoa p-12 text-cream lg:flex lg:flex-col lg:justify-between">
        <div className="absolute -right-24 top-16 h-80 w-80 rounded-full border-[55px] border-flame/75" />
        <div className="absolute -bottom-32 left-8 h-96 w-96 rounded-full border-[65px] border-butter/70" />
        <p className="relative text-xs font-bold uppercase tracking-[0.2em] text-butter">Sour Lemon / Admin</p>
        <div className="relative max-w-lg"><p className="font-display text-5xl font-bold leading-tight">Good things are happening in the kitchen.</p><p className="mt-5 max-w-sm text-sm leading-relaxed text-cream/70">A clear place to care for every order, cake request, and storefront update.</p></div>
        <p className="relative text-xs text-cream/55">Made for the people behind every order.</p>
      </div>
    </div>
  )
}
