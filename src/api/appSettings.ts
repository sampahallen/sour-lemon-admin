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

export type AppSettingKey = (typeof APP_SETTING_KEYS)[keyof typeof APP_SETTING_KEYS]

export interface AppSettingValueMap {
  business_whatsapp_number: string | null
  pickup_location: string | null
  manual_payment_review: boolean
  delivery_fee_mode: DeliveryFeeMode
  menu_scheduling_enabled: boolean
}

export type AppSettingUpdate = {
  [K in AppSettingKey]: { key: K; value: AppSettingValueMap[K] }
}[AppSettingKey]

export interface AppSetting {
  key: AppSettingKey
  value: AppSettingValueMap[AppSettingKey]
  description: string | null
  updatedAt: string
}

export function listAppSettings(token: string) {
  return apiRequest<{ settings: AppSetting[] }>('/api/app-settings', token)
}

export function updateAppSettings(token: string, updates: AppSettingUpdate[]) {
  return apiRequest<{ settings: AppSetting[] }>('/api/app-settings', token, {
    method: 'PATCH',
    json: { updates },
  })
}
