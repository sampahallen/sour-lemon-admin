import { apiRequest } from './client'
import type { DeliveryFeeMode } from './types'

// Real keys seeded in sour-lemon-backend/src/database/seeders/20260825000100-seed-site-configuration.cjs
export const APP_SETTING_KEYS = {
  businessWhatsappNumber: 'business_whatsapp_number',
  pickupLocation: 'pickup_location',
  manualPaymentReview: 'manual_payment_review',
  deliveryFeeMode: 'delivery_fee_mode',
  menuSchedulingEnabled: 'menu_scheduling_enabled',
} as const

export interface AppSetting<TValue = unknown> {
  key: string
  value: TValue
  description: string | null
  updatedAt: string
}

export function listAppSettings(token: string) {
  return apiRequest<{ settings: AppSetting[] }>('/api/app-settings', token)
}

function updateSetting<TValue>(token: string, key: string, value: TValue) {
  return apiRequest<{ setting: AppSetting<TValue> }>(`/api/app-settings/${key}`, token, {
    method: 'PATCH',
    json: { value },
  })
}

export function updateBusinessWhatsappNumber(token: string, phoneNumber: string | null) {
  return updateSetting(token, APP_SETTING_KEYS.businessWhatsappNumber, phoneNumber)
}

export function updatePickupLocation(token: string, location: string | null) {
  return updateSetting(token, APP_SETTING_KEYS.pickupLocation, location)
}

export function updateManualPaymentReview(token: string, enabled: boolean) {
  return updateSetting(token, APP_SETTING_KEYS.manualPaymentReview, enabled)
}

export function updateDeliveryFeeMode(token: string, mode: DeliveryFeeMode) {
  return updateSetting(token, APP_SETTING_KEYS.deliveryFeeMode, mode)
}

export function updateMenuSchedulingEnabled(token: string, enabled: boolean) {
  return updateSetting(token, APP_SETTING_KEYS.menuSchedulingEnabled, enabled)
}
