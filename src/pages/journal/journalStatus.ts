import type { StatusTone } from '@/components/ui/StatusBadge'
import type { JournalPostStatus } from '@/api/types'

export function journalStatusTone(status: JournalPostStatus): StatusTone {
  switch (status) {
    case 'archived':
      return 'negative'
    case 'scheduled':
      return 'warning'
    case 'published':
      return 'positive'
    default:
      return 'neutral'
  }
}

interface JournalPublishTimingFields {
  status: JournalPostStatus
  scheduledFor: string | null
  publishedAt: string | null
  archivedAt: string | null
}

export function journalPublishTiming(post: JournalPublishTimingFields): string {
  switch (post.status) {
    case 'scheduled':
      return post.scheduledFor ? `Scheduled for ${new Date(post.scheduledFor).toLocaleString()}` : 'Scheduled'
    case 'published':
      return post.publishedAt ? `Published ${new Date(post.publishedAt).toLocaleString()}` : 'Published'
    case 'archived':
      return post.archivedAt ? `Archived ${new Date(post.archivedAt).toLocaleString()}` : 'Archived'
    default:
      return 'Not scheduled'
  }
}
