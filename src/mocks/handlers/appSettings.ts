import { http, HttpResponse } from 'msw'
import { appSettings } from '../db'

export const appSettingHandlers = [
  http.get('*/api/app-settings', () => {
    return HttpResponse.json({ settings: appSettings })
  }),

  http.patch('*/api/app-settings', async ({ request }) => {
    const { updates } = (await request.json()) as {
      updates: Array<{ key: string; value: unknown }>
    }
    const keys = new Set(updates.map((update) => update.key))
    const hasInvalidUpdate = keys.size !== updates.length
      || updates.some((update) => !appSettings.some((setting) => setting.key === update.key))
    if (hasInvalidUpdate) {
      return HttpResponse.json({ error: 'Request validation failed' }, { status: 400 })
    }

    const updatedAt = new Date().toISOString()
    for (const update of updates) {
      const setting = appSettings.find((item) => item.key === update.key)!
      setting.value = update.value as never
      setting.updatedAt = updatedAt
    }

    return HttpResponse.json({ settings: appSettings })
  }),
]
