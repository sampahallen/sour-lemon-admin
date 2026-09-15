import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { useBlocker } from 'react-router'
import { useAuth } from '@/auth/authContext'
import {
  APP_SETTING_KEYS,
  listAppSettings,
  updateAppSettings,
  type AppSetting,
  type AppSettingUpdate,
} from '@/api/appSettings'
import type { DeliveryFeeMode } from '@/api/types'
import { Button } from '@/components/ui/Button'
import { PageHeader } from '@/components/ui/PageHeader'
import { ToggleSwitch } from '@/components/ui/ToggleSwitch'
import { normalizePhoneNumber } from '@/utils/phoneNumber'
import { useFormValidation, type FieldErrors } from '@/hooks/useFormValidation'

interface SettingsValues {
  whatsappNumber: string
  pickupLocation: string
  manualPaymentReview: boolean
  deliveryFeeMode: DeliveryFeeMode
  menuSchedulingEnabled: boolean
}

const defaults: SettingsValues = {
  whatsappNumber: '',
  pickupLocation: '',
  manualPaymentReview: true,
  deliveryFeeMode: 'rider',
  menuSchedulingEnabled: false,
}

const toValues = (settings: AppSetting[]): SettingsValues => {
  const values = { ...defaults }
  for (const setting of settings) {
    if (setting.key === APP_SETTING_KEYS.businessWhatsappNumber) values.whatsappNumber = (setting.value as string | null) ?? ''
    if (setting.key === APP_SETTING_KEYS.pickupLocation) values.pickupLocation = (setting.value as string | null) ?? ''
    if (setting.key === APP_SETTING_KEYS.manualPaymentReview) values.manualPaymentReview = setting.value as boolean
    if (setting.key === APP_SETTING_KEYS.deliveryFeeMode) values.deliveryFeeMode = setting.value as DeliveryFeeMode
    if (setting.key === APP_SETTING_KEYS.menuSchedulingEnabled) values.menuSchedulingEnabled = setting.value as boolean
  }
  return values
}

const fieldClassName = 'w-full rounded-lg border border-cocoa/20 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-flame focus:ring-2 focus:ring-flame/15'

export function SettingsPage() {
  const { session } = useAuth()
  const token = session!.token
  const [values, setValues] = useState(defaults)
  const [savedValues, setSavedValues] = useState(defaults)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  const isDirty = useMemo(
    () => JSON.stringify(values) !== JSON.stringify(savedValues),
    [savedValues, values],
  )
  const normalizedWhatsappNumber = values.whatsappNumber.trim()
    ? normalizePhoneNumber(values.whatsappNumber)
    : null
  const whatsappError = normalizedWhatsappNumber && !/^\+[1-9]\d{7,14}$/.test(normalizedWhatsappNumber)
    ? 'Enter a valid phone number, including the country code if it is outside Ghana.'
    : null
  const pickupError = values.pickupLocation.length > 500
    ? 'Keep the pickup location under 500 characters.'
    : null
  type SettingsField = 'whatsappNumber' | 'pickupLocation'
  const validate = (): FieldErrors<SettingsField> => ({
    ...(whatsappError ? { whatsappNumber: whatsappError } : {}),
    ...(pickupError ? { pickupLocation: pickupError } : {}),
  })
  const validation = useFormValidation<SettingsField>('settings', validate)
  const blocker = useBlocker(isDirty)

  useEffect(() => {
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!isDirty) return
      event.preventDefault()
    }
    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [isDirty])

  useEffect(() => {
    let active = true
    listAppSettings(token)
      .then(({ settings }) => {
        if (!active) return
        const nextValues = toValues(settings)
        setValues(nextValues)
        setSavedValues(nextValues)
      })
      .catch((error: unknown) => {
        if (active) setLoadError(error instanceof Error ? error.message : 'Settings could not be loaded.')
      })
      .finally(() => {
        if (active) setIsLoading(false)
      })
    return () => {
      active = false
    }
  }, [token])

  const setValue = <K extends keyof SettingsValues>(key: K, value: SettingsValues[K]) => {
    setValues((current) => ({ ...current, [key]: value }))
    if (key === 'whatsappNumber' || key === 'pickupLocation') validation.changed(key)
    setSaveError(null)
    setSuccessMessage(null)
  }

  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!isDirty || !validation.submit()) return

    const updates: AppSettingUpdate[] = []
    if (values.whatsappNumber !== savedValues.whatsappNumber) {
      updates.push({ key: APP_SETTING_KEYS.businessWhatsappNumber, value: normalizedWhatsappNumber })
    }
    if (values.pickupLocation !== savedValues.pickupLocation) {
      updates.push({ key: APP_SETTING_KEYS.pickupLocation, value: values.pickupLocation.trim() || null })
    }
    if (values.manualPaymentReview !== savedValues.manualPaymentReview) {
      updates.push({ key: APP_SETTING_KEYS.manualPaymentReview, value: values.manualPaymentReview })
    }
    if (values.deliveryFeeMode !== savedValues.deliveryFeeMode) {
      updates.push({ key: APP_SETTING_KEYS.deliveryFeeMode, value: values.deliveryFeeMode })
    }
    if (values.menuSchedulingEnabled !== savedValues.menuSchedulingEnabled) {
      updates.push({ key: APP_SETTING_KEYS.menuSchedulingEnabled, value: values.menuSchedulingEnabled })
    }

    setIsSaving(true)
    setSaveError(null)
    setSuccessMessage(null)
    try {
      const { settings } = await updateAppSettings(token, updates)
      const nextValues = toValues(settings)
      setValues(nextValues)
      setSavedValues(nextValues)
      validation.reset()
      setSuccessMessage('Settings saved. New orders and customer handoffs will use these values.')
    } catch (error) {
      if (!validation.server(error, (path) => {
        const index = Number(/^updates\.(\d+)\.value$/.exec(path)?.[1])
        if (!Number.isInteger(index)) return undefined
        const key = updates[index]?.key
        if (key === APP_SETTING_KEYS.businessWhatsappNumber) return 'whatsappNumber'
        if (key === APP_SETTING_KEYS.pickupLocation) return 'pickupLocation'
        return undefined
      })) setSaveError(error instanceof Error ? error.message : 'Settings could not be saved.')
    } finally {
      setIsSaving(false)
    }
  }

  if (isLoading) return <p className="text-cocoa/60">Loading settings…</p>

  if (loadError) {
    return (
      <div>
        <PageHeader title="Settings" />
        <div role="alert" className="max-w-xl rounded-xl border border-flame/25 bg-flame/5 p-5 text-sm text-cocoa">
          <p className="font-semibold">Settings could not be loaded.</p>
          <p className="mt-1 text-cocoa/70">{loadError}</p>
          <Button className="mt-4" size="md" onClick={() => window.location.reload()}>Try again</Button>
        </div>
      </div>
    )
  }

  return (
    <div className="pb-28">
      <PageHeader title="Settings" />
      <form noValidate onSubmit={save} className="flex max-w-2xl flex-col gap-5">
        <section className="rounded-xl border border-cocoa/10 bg-white p-5">
          <label htmlFor="settings-whatsappNumber" className="font-display text-lg font-bold">Business WhatsApp number</label>
          <p className="mb-3 mt-1 text-sm text-cocoa/70">Where customer order and delivery messages are sent.</p>
          <input
            {...validation.props('whatsappNumber')}
            value={values.whatsappNumber}
            onChange={(event) => setValue('whatsappNumber', event.target.value)}
            placeholder="+233 20 123 4567"
            className={`${fieldClassName} ${validation.error('whatsappNumber') ? 'border-flame bg-flame/5' : ''}`}
          />
          {validation.error('whatsappNumber') ? <p id="settings-whatsappNumber-error" className="mt-2 text-sm text-flame">{validation.error('whatsappNumber')}</p> : null}
        </section>

        <section className="rounded-xl border border-cocoa/10 bg-white p-5">
          <label htmlFor="settings-pickupLocation" className="font-display text-lg font-bold">Pickup location</label>
          <p className="mb-3 mt-1 text-sm text-cocoa/70">Shared with customers collecting an order or arranging their own rider.</p>
          <textarea
            {...validation.props('pickupLocation')}
            rows={3}
            value={values.pickupLocation}
            onChange={(event) => setValue('pickupLocation', event.target.value)}
            placeholder="e.g. 12 Volta Street, Osu"
            className={`${fieldClassName} resize-y ${validation.error('pickupLocation') ? 'border-flame bg-flame/5' : ''}`}
          />
          {validation.error('pickupLocation') ? <p id="settings-pickupLocation-error" className="mt-2 text-sm text-flame">{validation.error('pickupLocation')}</p> : null}
        </section>

        <section className="rounded-xl border border-cocoa/10 bg-white p-5">
          <h2 className="font-display text-lg font-bold">Payment review</h2>
          <p className="mb-3 mt-1 text-sm text-cocoa/70">Require a manual double-check before a verified online payment is confirmed.</p>
          <ToggleSwitch
            label={values.manualPaymentReview ? 'Manual review required' : 'Auto-confirm verified payments'}
            checked={values.manualPaymentReview}
            onChange={(next) => setValue('manualPaymentReview', next)}
          />
        </section>

        <fieldset className="rounded-xl border border-cocoa/10 bg-white p-5">
          <legend className="px-1 font-display text-lg font-bold">Delivery fee</legend>
          <p className="mb-3 text-sm text-cocoa/70">Choose whether delivery cost is included in checkout or handled with the rider.</p>
          <div className="grid gap-3 text-sm font-semibold sm:grid-cols-2">
            {([
              ['included', 'Included in order price'],
              ['rider', 'Handled separately with rider'],
            ] as const).map(([mode, label]) => (
              <label key={mode} className="flex cursor-pointer items-center gap-3 rounded-lg border border-cocoa/10 p-3">
                <input
                  type="radio"
                  name="delivery-fee-mode"
                  checked={values.deliveryFeeMode === mode}
                  onChange={() => setValue('deliveryFeeMode', mode)}
                />
                {label}
              </label>
            ))}
          </div>
        </fieldset>

        <section className="rounded-xl border border-cocoa/10 bg-white p-5">
          <h2 className="font-display text-lg font-bold">Menu scheduling</h2>
          <p className="mb-3 mt-1 text-sm text-cocoa/70">Allow menu availability to be scheduled in advance.</p>
          <ToggleSwitch
            label={values.menuSchedulingEnabled ? 'Scheduling enabled' : 'Manual updates only'}
            checked={values.menuSchedulingEnabled}
            onChange={(next) => setValue('menuSchedulingEnabled', next)}
          />
        </section>

        <div className="sticky bottom-4 z-10 rounded-xl border border-cocoa/10 bg-cream/95 p-4 shadow-lg backdrop-blur">
          {saveError ? <p role="alert" className="mb-3 text-sm text-flame">{saveError} Your changes have not been cleared.</p> : null}
          {successMessage ? <p role="status" className="mb-3 text-sm font-semibold text-olive">{successMessage}</p> : null}
          <div className="flex items-center justify-between gap-4">
            <p className="text-sm text-cocoa/65">{isDirty ? 'You have unsaved changes.' : 'Everything is up to date.'}</p>
            <Button type="submit" disabled={!isDirty || isSaving}>
              {isSaving ? 'Saving…' : 'Save all changes'}
            </Button>
          </div>
        </div>
      </form>

      {blocker.state === 'blocked' ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-cocoa/35 p-4" role="dialog" aria-modal="true" aria-labelledby="leave-title">
          <div className="w-full max-w-md rounded-2xl bg-cream p-6 shadow-xl">
            <h2 id="leave-title" className="font-display text-xl font-bold">Leave without saving?</h2>
            <p className="mt-2 text-sm text-cocoa/70">Your settings changes will be lost.</p>
            <div className="mt-5 flex justify-end gap-3">
              <Button variant="outline" accent="cocoa" onClick={() => blocker.reset()}>Stay here</Button>
              <Button onClick={() => blocker.proceed()}>Discard changes</Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
