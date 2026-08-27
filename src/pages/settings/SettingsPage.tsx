import { useEffect, useState } from 'react'
import { PageHeader } from '@/components/ui/PageHeader'
import { Button } from '@/components/ui/Button'
import { ToggleSwitch } from '@/components/ui/ToggleSwitch'
import { useAuth } from '@/auth/authContext'
import { normalizePhoneNumber } from '@/utils/phoneNumber'
import {
  APP_SETTING_KEYS,
  listAppSettings,
  updateBusinessWhatsappNumber,
  updateDeliveryFeeMode,
  updateManualPaymentReview,
  updateMenuSchedulingEnabled,
  updatePickupLocation,
} from '@/api/appSettings'
import type { DeliveryFeeMode } from '@/api/types'

export function SettingsPage() {
  const { session } = useAuth()
  const token = session!.token

  const [whatsappNumber, setWhatsappNumber] = useState('')
  const [pickupLocation, setPickupLocation] = useState('')
  const [manualPaymentReview, setManualPaymentReview] = useState(true)
  const [deliveryFeeMode, setDeliveryFeeMode] = useState<DeliveryFeeMode>('rider')
  const [menuSchedulingEnabled, setMenuSchedulingEnabled] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [savingKey, setSavingKey] = useState<string | null>(null)

  const load = async () => {
    const { settings } = await listAppSettings(token)
    for (const setting of settings) {
      if (setting.key === APP_SETTING_KEYS.businessWhatsappNumber) setWhatsappNumber((setting.value as string | null) ?? '')
      if (setting.key === APP_SETTING_KEYS.pickupLocation) setPickupLocation((setting.value as string | null) ?? '')
      if (setting.key === APP_SETTING_KEYS.manualPaymentReview) setManualPaymentReview(Boolean(setting.value))
      if (setting.key === APP_SETTING_KEYS.deliveryFeeMode) setDeliveryFeeMode(setting.value as DeliveryFeeMode)
      if (setting.key === APP_SETTING_KEYS.menuSchedulingEnabled) setMenuSchedulingEnabled(Boolean(setting.value))
    }
  }

  useEffect(() => {
    load().finally(() => setIsLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (isLoading) return <p className="text-cocoa/60">Loading…</p>

  const save = async (key: string, action: () => Promise<unknown>) => {
    setSavingKey(key)
    try {
      await action()
    } finally {
      setSavingKey(null)
    }
  }

  return (
    <div>
      <PageHeader title="Settings" />

      <div className="flex max-w-xl flex-col gap-6">
        <section className="rounded-xl border border-cocoa/10 bg-white p-5">
          <h2 className="mb-2 font-display text-lg font-bold">Business WhatsApp number</h2>
          <p className="mb-3 text-sm text-cocoa/70">Where customer order messages get sent.</p>
          <div className="flex gap-2">
            <input
              value={whatsappNumber}
              onChange={(event) => setWhatsappNumber(event.target.value)}
              placeholder="+233 20 123 4567"
              className="flex-1 rounded-lg border border-cocoa/20 px-3 py-2 text-sm"
            />
            <Button
              size="md"
              disabled={savingKey === APP_SETTING_KEYS.businessWhatsappNumber}
              onClick={() =>
                save(APP_SETTING_KEYS.businessWhatsappNumber, () =>
                  updateBusinessWhatsappNumber(token, whatsappNumber ? normalizePhoneNumber(whatsappNumber) : null),
                )
              }
            >
              Save
            </Button>
          </div>
        </section>

        <section className="rounded-xl border border-cocoa/10 bg-white p-5">
          <h2 className="mb-2 font-display text-lg font-bold">Pickup location</h2>
          <p className="mb-3 text-sm text-cocoa/70">Shown to customers arranging their own delivery rider.</p>
          <div className="flex gap-2">
            <input
              value={pickupLocation}
              onChange={(event) => setPickupLocation(event.target.value)}
              placeholder="e.g. 12 Volta Street, Osu"
              className="flex-1 rounded-lg border border-cocoa/20 px-3 py-2 text-sm"
            />
            <Button
              size="md"
              disabled={savingKey === APP_SETTING_KEYS.pickupLocation}
              onClick={() =>
                save(APP_SETTING_KEYS.pickupLocation, () =>
                  updatePickupLocation(token, pickupLocation || null),
                )
              }
            >
              Save
            </Button>
          </div>
        </section>

        <section className="rounded-xl border border-cocoa/10 bg-white p-5">
          <h2 className="mb-2 font-display text-lg font-bold">Payment review</h2>
          <p className="mb-3 text-sm text-cocoa/70">
            Require a manual double-check before an online payment counts as confirmed.
          </p>
          <ToggleSwitch
            label={manualPaymentReview ? 'Manual review required' : 'Auto-confirm verified payments'}
            checked={manualPaymentReview}
            onChange={(next) => {
              setManualPaymentReview(next)
              save(APP_SETTING_KEYS.manualPaymentReview, () => updateManualPaymentReview(token, next))
            }}
          />
        </section>

        <section className="rounded-xl border border-cocoa/10 bg-white p-5">
          <h2 className="mb-2 font-display text-lg font-bold">Delivery fee</h2>
          <p className="mb-3 text-sm text-cocoa/70">Whether delivery cost is included in the order or handled with the rider.</p>
          <div className="flex gap-4 text-sm font-semibold">
            <label className="flex items-center gap-2">
              <input
                type="radio"
                checked={deliveryFeeMode === 'included'}
                onChange={() => {
                  setDeliveryFeeMode('included')
                  save(APP_SETTING_KEYS.deliveryFeeMode, () => updateDeliveryFeeMode(token, 'included'))
                }}
              />
              Included in order price
            </label>
            <label className="flex items-center gap-2">
              <input
                type="radio"
                checked={deliveryFeeMode === 'rider'}
                onChange={() => {
                  setDeliveryFeeMode('rider')
                  save(APP_SETTING_KEYS.deliveryFeeMode, () => updateDeliveryFeeMode(token, 'rider'))
                }}
              />
              Handled separately with rider
            </label>
          </div>
        </section>

        <section className="rounded-xl border border-cocoa/10 bg-white p-5">
          <h2 className="mb-2 font-display text-lg font-bold">Menu scheduling</h2>
          <p className="mb-3 text-sm text-cocoa/70">Allow scheduling a menu change in advance instead of always updating manually.</p>
          <ToggleSwitch
            label={menuSchedulingEnabled ? 'Scheduling enabled' : 'Manual updates only'}
            checked={menuSchedulingEnabled}
            onChange={(next) => {
              setMenuSchedulingEnabled(next)
              save(APP_SETTING_KEYS.menuSchedulingEnabled, () => updateMenuSchedulingEnabled(token, next))
            }}
          />
        </section>
      </div>
    </div>
  )
}
