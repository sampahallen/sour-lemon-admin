import { http, HttpResponse } from 'msw'
import { siteSections } from '../db'

export const siteSectionHandlers = [
  http.get('*/api/site-sections', () => {
    return HttpResponse.json({ sections: siteSections })
  }),

  http.patch('*/api/site-sections/:id', async ({ request, params }) => {
    const section = siteSections.find((item) => item.id === params.id)
    if (!section) return new HttpResponse(null, { status: 404 })

    const input = (await request.json()) as { isEnabled?: boolean; showComingSoon?: boolean }
    Object.assign(section, input)

    return HttpResponse.json({ section })
  }),
]
