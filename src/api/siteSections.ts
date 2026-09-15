import { apiRequest } from './client'

export interface SiteSection {
  id: string
  key: string
  name: string
  isEnabled: boolean
  showComingSoon: boolean
  sortOrder: number
}

export function listSiteSections(token: string) {
  return apiRequest<{ sections: SiteSection[] }>('/api/site-sections', token)
}

export function updateSiteSection(
  token: string,
  id: string,
  input: { isEnabled?: boolean; showComingSoon?: boolean },
) {
  return apiRequest<{ section: SiteSection }>(`/api/site-sections/${id}`, token, {
    method: 'PATCH',
    json: input,
  })
}
