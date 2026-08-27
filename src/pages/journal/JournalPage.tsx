import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router'
import { PageHeader } from '@/components/ui/PageHeader'
import { DataTable } from '@/components/ui/DataTable'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { Button } from '@/components/ui/Button'
import { cn } from '@/utils/cn'
import { useAuth } from '@/auth/authContext'
import { listJournalCategories, listJournalPosts, type JournalCategory, type JournalPostSummary } from '@/api/journal'
import { JOURNAL_POST_STATUSES, type JournalPostStatus, type Pagination } from '@/api/types'
import { journalPublishTiming, journalStatusTone } from './journalStatus'
import { JournalCategoriesDrawer } from './JournalCategoriesDrawer'
import { JournalPostCreateDrawer } from './JournalPostCreateDrawer'

const PAGE_SIZE = 20

export function JournalPage() {
  const { session } = useAuth()
  const token = session!.token
  const navigate = useNavigate()

  const [categories, setCategories] = useState<JournalCategory[]>([])
  const [categoriesError, setCategoriesError] = useState<string | null>(null)

  const [statusFilter, setStatusFilter] = useState<JournalPostStatus | null>(null)
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null)
  const [page, setPage] = useState(1)

  const [posts, setPosts] = useState<JournalPostSummary[]>([])
  const [pagination, setPagination] = useState<Pagination | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [isCategoriesOpen, setIsCategoriesOpen] = useState(false)
  const [isCreateOpen, setIsCreateOpen] = useState(false)

  const loadCategories = async () => {
    try {
      const { categories } = await listJournalCategories(token)
      setCategories(categories)
      setCategoriesError(null)
    } catch (caught) {
      setCategoriesError(caught instanceof Error ? caught.message : 'Could not load Journal categories.')
    }
  }

  const loadPosts = async () => {
    setIsLoading(true)
    setError(null)
    try {
      const { posts, pagination } = await listJournalPosts(token, {
        status: statusFilter ?? undefined,
        categoryId: categoryFilter ?? undefined,
        page,
        limit: PAGE_SIZE,
      })
      setPosts(posts)
      setPagination(pagination)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not load Journal posts.')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    void loadCategories()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    void loadPosts()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter, categoryFilter, page, token])

  const changeStatusFilter = (next: JournalPostStatus | null) => {
    setStatusFilter(next)
    setPage(1)
  }

  const changeCategoryFilter = (next: string | null) => {
    setCategoryFilter(next)
    setPage(1)
  }

  const handleCategoriesChanged = async () => {
    await loadCategories()
    await loadPosts()
  }

  const activeCategories = categories.filter((category) => category.isActive)

  return (
    <div>
      <PageHeader
        title="Journal"
        action={
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setIsCategoriesOpen(true)}>
              Manage categories
            </Button>
            <Button
              onClick={() => setIsCreateOpen(true)}
              disabled={activeCategories.length === 0}
            >
              New post
            </Button>
          </div>
        }
      />

      {categoriesError ? (
        <p className="mb-4 rounded-lg bg-flame/10 px-3 py-2 text-sm font-semibold text-flame">{categoriesError}</p>
      ) : null}

      {activeCategories.length === 0 && !categoriesError ? (
        <p className="mb-4 rounded-lg bg-butter/30 px-3 py-2 text-sm font-semibold text-cocoa">
          Add an active category before creating a post.
        </p>
      ) : null}

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2 text-sm">
          <button
            className={cn(
              'rounded-full px-3 py-1 font-semibold',
              statusFilter === null ? 'bg-flame text-cream' : 'bg-cocoa/10 text-cocoa/70',
            )}
            onClick={() => changeStatusFilter(null)}
          >
            All statuses
          </button>
          {JOURNAL_POST_STATUSES.map((status) => (
            <button
              key={status}
              className={cn(
                'rounded-full px-3 py-1 font-semibold capitalize',
                statusFilter === status ? 'bg-flame text-cream' : 'bg-cocoa/10 text-cocoa/70',
              )}
              onClick={() => changeStatusFilter(status)}
            >
              {status}
            </button>
          ))}
        </div>

        <select
          value={categoryFilter ?? ''}
          onChange={(event) => changeCategoryFilter(event.target.value || null)}
          className="rounded-lg border border-cocoa/20 px-3 py-1.5 text-sm font-semibold text-cocoa/70 outline-none focus:border-flame"
        >
          <option value="">All categories</option>
          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
              {category.isActive ? '' : ' (inactive)'}
            </option>
          ))}
        </select>
      </div>

      {isLoading ? (
        <p className="text-cocoa/60">Loading…</p>
      ) : error ? (
        <div className="rounded-xl border border-flame/20 bg-flame/5 p-8 text-center">
          <p className="mb-3 font-semibold text-flame">{error}</p>
          <Button variant="outline" onClick={() => void loadPosts()}>
            Try again
          </Button>
        </div>
      ) : (
        <>
          <DataTable
            columns={[
              {
                header: 'Cover',
                render: (post: JournalPostSummary) => {
                  const cover = post.images.find((image) => image.role === 'cover')
                  return cover ? (
                    <img src={cover.url} alt={cover.altText} className="h-12 w-12 rounded-lg object-cover" />
                  ) : (
                    <div className="h-12 w-12 rounded-lg bg-cocoa/10" />
                  )
                },
              },
              { header: 'Title', render: (post: JournalPostSummary) => post.title },
              { header: 'Category', render: (post: JournalPostSummary) => post.category.name },
              {
                header: 'Status',
                render: (post: JournalPostSummary) => (
                  <StatusBadge label={post.status} tone={journalStatusTone(post.status)} />
                ),
              },
              {
                header: 'Updated',
                render: (post: JournalPostSummary) => new Date(post.updatedAt).toLocaleString(),
              },
              { header: 'Timing', render: (post: JournalPostSummary) => journalPublishTiming(post) },
            ]}
            rows={posts}
            rowKey={(post) => post.id}
            onRowClick={(post) => navigate(`/journal/${post.id}`)}
            emptyState="No journal posts match this filter."
          />

          {pagination && pagination.totalPages > 1 ? (
            <div className="mt-4 flex items-center justify-between text-sm font-semibold text-cocoa/70">
              <button
                className="disabled:opacity-40"
                disabled={pagination.page <= 1}
                onClick={() => setPage((current) => Math.max(1, current - 1))}
              >
                ← Previous
              </button>
              <span>
                Page {pagination.page} of {pagination.totalPages}
              </span>
              <button
                className="disabled:opacity-40"
                disabled={pagination.page >= pagination.totalPages}
                onClick={() => setPage((current) => current + 1)}
              >
                Next →
              </button>
            </div>
          ) : null}
        </>
      )}

      <JournalCategoriesDrawer
        isOpen={isCategoriesOpen}
        onClose={() => setIsCategoriesOpen(false)}
        onChanged={handleCategoriesChanged}
      />

      <JournalPostCreateDrawer
        isOpen={isCreateOpen}
        categories={activeCategories}
        defaultCategoryId={activeCategories[0]?.id ?? null}
        onClose={() => setIsCreateOpen(false)}
      />
    </div>
  )
}
