import { http, HttpResponse } from 'msw'
import { appSettings } from '../db'

export const appSettingHandlers = [
  http.get('*/api/app-settings', () => {
    return HttpResponse.json({ settings: appSettings })
  }),

  http.patch('*/api/app-settings/:key', async ({ request, params }) => {
    const setting = appSettings.find((item) => item.key === params.key)
    if (!setting) return new HttpResponse(null, { status: 404 })

    const { value, description } = (await request.json()) as { value: unknown; description?: string }
    setting.value = value
    if (description !== undefined) setting.description = description
    setting.updatedAt = new Date().toISOString()

    return HttpResponse.json({ setting })
  }),
]
