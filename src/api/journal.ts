import { apiRequest } from './client'
import type { JournalImageRole, JournalPostStatus, Pagination } from './types'

export interface JournalCategory {
  id: string
  name: string
  slug: string
  description: string | null
  isActive: boolean
  sortOrder: number
  createdAt: string
  updatedAt: string
}

export interface JournalCategoryInput {
  name: string
  slug?: string
  description?: string | null
  isActive?: boolean
  sortOrder?: number
}

export interface JournalCategoryRef {
  id: string
  name: string
  slug: string
}

export interface JournalAuthor {
  id: string
  name: string
}

export interface JournalPostImage {
  id: string
  journalPostId: string
  role: JournalImageRole
  url: string
  storageKey: string
  altText: string
  caption: string | null
  sortOrder: number
  contentType: string | null
  sizeBytes: number | null
  createdAt: string
}

export interface JournalParagraphBlock {
  type: 'paragraph'
  text: string
}

export interface JournalHeadingBlock {
  type: 'heading'
  level: 2 | 3
  text: string
}

export interface JournalListBlock {
  type: 'list'
  style: 'ordered' | 'unordered'
  items: string[]
}

export interface JournalQuoteBlock {
  type: 'quote'
  text: string
  attribution?: string
}

export interface JournalImageBlock {
  type: 'image'
  imageId: string
  caption?: string
}

export type JournalBlock =
  | JournalParagraphBlock
  | JournalHeadingBlock
  | JournalListBlock
  | JournalQuoteBlock
  | JournalImageBlock

export interface JournalBody {
  version: 1
  blocks: JournalBlock[]
}

export interface JournalPostSummary {
  id: string
  categoryId: string
  category: JournalCategoryRef
  authorUserId: string | null
  author: JournalAuthor | null
  title: string
  slug: string
  excerpt: string | null
  status: JournalPostStatus
  scheduledFor: string | null
  publishedAt: string | null
  archivedAt: string | null
  createdAt: string
  updatedAt: string
  images: JournalPostImage[]
}

export interface JournalPostDetail extends JournalPostSummary {
  body: JournalBody
}

// Mutation endpoints (create/update/schedule/publish/archive) serialize the
// JournalPost row directly, with no eager-loaded category, author, or images.
export interface JournalPostRecord {
  id: string
  categoryId: string
  authorUserId: string | null
  title: string
  slug: string
  excerpt: string | null
  body: JournalBody
  status: JournalPostStatus
  scheduledFor: string | null
  publishedAt: string | null
  archivedAt: string | null
  createdAt: string
  updatedAt: string
}

export interface JournalPostInput {
  categoryId: string
  title: string
  slug?: string
  excerpt?: string | null
  body?: JournalBody
}

export interface JournalImageInput {
  role: JournalImageRole
  altText: string
  caption?: string | null
  sortOrder?: number
}

export function listJournalCategories(token: string) {
  return apiRequest<{ categories: JournalCategory[] }>('/api/journal/admin/categories', token)
}

export function createJournalCategory(token: string, input: JournalCategoryInput) {
  return apiRequest<{ category: JournalCategory }>('/api/journal/categories', token, {
    method: 'POST',
    json: input,
  })
}

export function updateJournalCategory(token: string, id: string, input: Partial<JournalCategoryInput>) {
  return apiRequest<{ category: JournalCategory }>(`/api/journal/categories/${id}`, token, {
    method: 'PATCH',
    json: input,
  })
}

export function deleteJournalCategory(token: string, id: string) {
  return apiRequest<void>(`/api/journal/categories/${id}`, token, { method: 'DELETE' })
}

export interface ListJournalPostsParams {
  categoryId?: string
  status?: JournalPostStatus
  page?: number
  limit?: number
}

export function listJournalPosts(token: string, params: ListJournalPostsParams = {}) {
  const query = new URLSearchParams()
  if (params.categoryId) query.set('categoryId', params.categoryId)
  if (params.status) query.set('status', params.status)
  if (params.page) query.set('page', String(params.page))
  if (params.limit) query.set('limit', String(params.limit))
  const search = query.toString()

  return apiRequest<{ posts: JournalPostSummary[]; pagination: Pagination }>(
    `/api/journal/admin/posts${search ? `?${search}` : ''}`,
    token,
  )
}

export function getJournalPost(token: string, id: string) {
  return apiRequest<{ post: JournalPostDetail }>(`/api/journal/admin/posts/${id}`, token)
}

export function createJournalPost(token: string, input: JournalPostInput) {
  return apiRequest<{ post: JournalPostRecord }>('/api/journal/posts', token, { method: 'POST', json: input })
}

export function updateJournalPost(token: string, id: string, input: Partial<JournalPostInput>) {
  return apiRequest<{ post: JournalPostRecord }>(`/api/journal/posts/${id}`, token, {
    method: 'PATCH',
    json: input,
  })
}

export function deleteJournalPost(token: string, id: string) {
  return apiRequest<void>(`/api/journal/posts/${id}`, token, { method: 'DELETE' })
}

export function scheduleJournalPost(token: string, id: string, scheduledFor: string) {
  return apiRequest<{ post: JournalPostRecord }>(`/api/journal/posts/${id}/schedule`, token, {
    method: 'POST',
    json: { scheduledFor },
  })
}

export function publishJournalPost(token: string, id: string) {
  return apiRequest<{ post: JournalPostRecord }>(`/api/journal/posts/${id}/publish`, token, { method: 'POST' })
}

export function archiveJournalPost(token: string, id: string) {
  return apiRequest<{ post: JournalPostRecord }>(`/api/journal/posts/${id}/archive`, token, { method: 'POST' })
}

export function uploadJournalPostImage(token: string, postId: string, file: File, input: JournalImageInput) {
  const formData = new FormData()
  formData.append('file', file)
  formData.append('role', input.role)
  formData.append('altText', input.altText)
  if (input.caption) formData.append('caption', input.caption)
  if (input.sortOrder !== undefined) formData.append('sortOrder', String(input.sortOrder))

  return apiRequest<{ image: JournalPostImage }>(`/api/journal/posts/${postId}/images`, token, {
    method: 'POST',
    body: formData,
  })
}

export function deleteJournalPostImage(token: string, postId: string, imageId: string) {
  return apiRequest<void>(`/api/journal/posts/${postId}/images/${imageId}`, token, { method: 'DELETE' })
}

export function reorderJournalPostImages(token: string, postId: string, imageIds: string[]) {
  return apiRequest<{ images: JournalPostImage[] }>(`/api/journal/posts/${postId}/images/reorder`, token, {
    method: 'PATCH',
    json: { imageIds },
  })
}
