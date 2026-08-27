import { apiRequest } from './client'

export interface Category {
  id: string
  siteSectionId: string
  name: string
  slug: string
  isActive: boolean
  sortOrder: number
}

export interface CategoryInput {
  siteSectionId: string
  name: string
  slug?: string
  isActive?: boolean
  sortOrder?: number
}

export interface CategorySiteSection {
  id: string
  key: string
  name: string
}

export function listCategories(
  token: string,
  params: { siteSectionId?: string; sectionKey?: string } = {},
) {
  const query = new URLSearchParams()
  if (params.siteSectionId) query.set('siteSectionId', params.siteSectionId)
  if (params.sectionKey) query.set('sectionKey', params.sectionKey)
  const search = query.toString()
  return apiRequest<{ categories: Category[]; siteSection: CategorySiteSection | null }>(
    `/api/categories${search ? `?${search}` : ''}`,
    token,
  )
}

export function createCategory(token: string, input: CategoryInput) {
  return apiRequest<{ category: Category }>('/api/categories', token, { method: 'POST', json: input })
}

export function updateCategory(token: string, id: string, input: Partial<CategoryInput>) {
  return apiRequest<{ category: Category }>(`/api/categories/${id}`, token, {
    method: 'PATCH',
    json: input,
  })
}

export function deleteCategory(token: string, id: string) {
  return apiRequest<void>(`/api/categories/${id}`, token, { method: 'DELETE' })
}
