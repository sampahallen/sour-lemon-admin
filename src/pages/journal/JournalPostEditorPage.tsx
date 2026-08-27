import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import { useAuth } from '@/auth/authContext'
import {
  archiveJournalPost,
  deleteJournalPost,
  getJournalPost,
  listJournalCategories,
  publishJournalPost,
  scheduleJournalPost,
  updateJournalPost,
  type JournalBlock,
  type JournalCategory,
  type JournalPostDetail,
} from '@/api/journal'
import { Button } from '@/components/ui/Button'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { PageHeader } from '@/components/ui/PageHeader'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { JournalBodyEditor } from './JournalBodyEditor'
import { JournalImagesPanel } from './JournalImagesPanel'
import { journalPublishTiming, journalStatusTone } from './journalStatus'

const inputClasses =
  'w-full rounded-lg border border-cocoa/20 px-3 py-2 text-sm font-normal outline-none focus:border-flame'

interface EditorForm {
  title: string
  slug: string
  categoryId: string
  excerpt: string
  blocks: JournalBlock[]
}

type ConfirmAction = 'publish' | 'archive' | 'delete' | null

const formFromPost = (post: JournalPostDetail): EditorForm => ({
  title: post.title,
  slug: post.slug,
  categoryId: post.categoryId,
  excerpt: post.excerpt ?? '',
  blocks: post.body.blocks,
})

const hasMeaningfulContent = (blocks: JournalBlock[]) =>
  blocks.some((block) => {
    switch (block.type) {
      case 'paragraph':
      case 'heading':
      case 'quote':
        return block.text.trim().length > 0
      case 'list':
        return block.items.some((item) => item.trim().length > 0)
      case 'image':
        return block.imageId.length > 0
    }
  })

const toLocalDateTime = (value: string | null) => {
  if (!value) return ''
  const date = new Date(value)
  const offset = date.getTimezoneOffset() * 60_000
  return new Date(date.getTime() - offset).toISOString().slice(0, 16)
}

export function JournalPostEditorPage() {
  const { postId } = useParams()
  const { session } = useAuth()
  const token = session!.token
  const navigate = useNavigate()

  const [post, setPost] = useState<JournalPostDetail | null>(null)
  const [categories, setCategories] = useState<JournalCategory[]>([])
  const [form, setForm] = useState<EditorForm | null>(null)
  const [savedForm, setSavedForm] = useState<EditorForm | null>(null)
  const [scheduledFor, setScheduledFor] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [isTransitioning, setIsTransitioning] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [confirmAction, setConfirmAction] = useState<ConfirmAction>(null)

  const isDirty = useMemo(
    () => form !== null && savedForm !== null && JSON.stringify(form) !== JSON.stringify(savedForm),
    [form, savedForm],
  )

  const loadPost = async (preserveForm = false) => {
    if (!postId) return
    const { post } = await getJournalPost(token, postId)
    setPost(post)
    setScheduledFor(toLocalDateTime(post.scheduledFor))
    if (!preserveForm) {
      const nextForm = formFromPost(post)
      setForm(nextForm)
      setSavedForm(nextForm)
    }
  }

  useEffect(() => {
    let active = true
    const load = async () => {
      if (!postId) return
      setIsLoading(true)
      setError(null)
      try {
        const [{ post }, { categories }] = await Promise.all([
          getJournalPost(token, postId),
          listJournalCategories(token),
        ])
        if (!active) return
        const nextForm = formFromPost(post)
        setPost(post)
        setForm(nextForm)
        setSavedForm(nextForm)
        setScheduledFor(toLocalDateTime(post.scheduledFor))
        setCategories(categories)
      } catch (caught) {
        if (active) setError(caught instanceof Error ? caught.message : 'Could not load this Journal post.')
      } finally {
        if (active) setIsLoading(false)
      }
    }
    void load()
    return () => {
      active = false
    }
  }, [postId, token])

  useEffect(() => {
    if (!isDirty) return
    const warnBeforeUnload = (event: BeforeUnloadEvent) => event.preventDefault()
    window.addEventListener('beforeunload', warnBeforeUnload)
    return () => window.removeEventListener('beforeunload', warnBeforeUnload)
  }, [isDirty])

  const save = async () => {
    if (!post || !form) return false
    if (!form.title.trim() || !form.slug.trim() || !form.categoryId) {
      setError('Title, slug, and category are required.')
      return false
    }

    setIsSaving(true)
    setError(null)
    setNotice(null)
    try {
      await updateJournalPost(token, post.id, {
        title: form.title.trim(),
        slug: form.slug.trim(),
        categoryId: form.categoryId,
        excerpt: form.excerpt.trim() || null,
        body: { version: 1, blocks: form.blocks },
      })
      await loadPost()
      setNotice('Draft saved.')
      return true
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not save this post.')
      return false
    } finally {
      setIsSaving(false)
    }
  }

  const prepareForPublication = async () => {
    if (!form) return false
    if (isDirty && !(await save())) return false
    if (!form.excerpt.trim() || !hasMeaningfulContent(form.blocks)) {
      setError('Add an excerpt and at least one content block before publishing or scheduling.')
      return false
    }
    const selectedCategory = categories.find((category) => category.id === form.categoryId)
    if (!selectedCategory?.isActive) {
      setError('Choose an active category before publishing or scheduling.')
      return false
    }
    return true
  }

  const runTransition = async (action: 'publish' | 'archive') => {
    if (!post) return
    setConfirmAction(null)
    setIsTransitioning(true)
    setError(null)
    setNotice(null)
    try {
      if (action === 'publish') {
        if (!(await prepareForPublication())) return
        await publishJournalPost(token, post.id)
        setNotice('Post published.')
      } else {
        if (isDirty && !(await save())) return
        await archiveJournalPost(token, post.id)
        setNotice('Post archived.')
      }
      await loadPost()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : `Could not ${action} this post.`)
    } finally {
      setIsTransitioning(false)
    }
  }

  const handleSchedule = async () => {
    if (!post) return
    const date = new Date(scheduledFor)
    if (!scheduledFor || Number.isNaN(date.getTime()) || date <= new Date()) {
      setError('Choose a future date and time.')
      return
    }

    setIsTransitioning(true)
    setError(null)
    setNotice(null)
    try {
      if (!(await prepareForPublication())) return
      await scheduleJournalPost(token, post.id, date.toISOString())
      await loadPost()
      setNotice('Post scheduled.')
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not schedule this post.')
    } finally {
      setIsTransitioning(false)
    }
  }

  const handleDelete = async () => {
    if (!post) return
    setConfirmAction(null)
    setIsTransitioning(true)
    setError(null)
    try {
      await deleteJournalPost(token, post.id)
      navigate('/journal', { replace: true })
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not delete this post.')
      setIsTransitioning(false)
    }
  }

  const goBack = () => {
    if (isDirty && !window.confirm('Discard your unsaved Journal changes?')) return
    navigate('/journal')
  }

  if (isLoading) return <p className="text-cocoa/60">Loading Journal post…</p>

  if (!post || !form) {
    return (
      <div className="rounded-xl border border-flame/20 bg-white p-8 text-center">
        <p className="font-semibold text-flame">{error ?? 'Journal post not found.'}</p>
        <Button className="mt-4" variant="outline" onClick={() => navigate('/journal')}>Back to Journal</Button>
      </div>
    )
  }

  const currentCategory = categories.find((category) => category.id === form.categoryId)
  const selectableCategories = categories.filter(
    (category) => category.isActive || category.id === currentCategory?.id,
  )
  const canPublishOrSchedule = post.status === 'draft' || post.status === 'scheduled'
  const busy = isSaving || isTransitioning

  return (
    <div>
      <PageHeader
        title="Edit Journal post"
        action={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={goBack}>Back</Button>
            <Button disabled={!isDirty || busy} onClick={() => void save()}>
              {isSaving ? 'Saving…' : isDirty ? 'Save changes' : 'Saved'}
            </Button>
          </div>
        }
      />

      <div className="mb-5 flex flex-wrap items-center gap-3">
        <StatusBadge label={post.status} tone={journalStatusTone(post.status)} />
        <span className="text-sm text-cocoa/55">{journalPublishTiming(post)}</span>
        {isDirty ? <span className="text-sm font-semibold text-flame">Unsaved changes</span> : null}
      </div>

      {error ? <p className="mb-4 rounded-lg bg-flame/10 px-3 py-2 text-sm font-semibold text-flame">{error}</p> : null}
      {notice ? <p className="mb-4 rounded-lg bg-olive/10 px-3 py-2 text-sm font-semibold text-olive">{notice}</p> : null}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="flex flex-col gap-6">
          <section className="rounded-xl border border-cocoa/10 bg-white p-5">
            <h2 className="mb-4 font-display text-lg font-bold">Post details</h2>
            <div className="grid gap-4 md:grid-cols-2">
              <label className="flex flex-col gap-1 text-sm font-semibold md:col-span-2">
                Title
                <input
                  value={form.title}
                  maxLength={200}
                  className={inputClasses}
                  onChange={(event) => setForm({ ...form, title: event.target.value })}
                />
              </label>
              <label className="flex flex-col gap-1 text-sm font-semibold">
                Slug
                <input
                  value={form.slug}
                  maxLength={220}
                  className={inputClasses}
                  onChange={(event) => setForm({ ...form, slug: event.target.value })}
                />
                <span className="font-normal text-cocoa/45">Lowercase letters, numbers, and hyphens only.</span>
              </label>
              <label className="flex flex-col gap-1 text-sm font-semibold">
                Category
                <select
                  value={form.categoryId}
                  className={inputClasses}
                  onChange={(event) => setForm({ ...form, categoryId: event.target.value })}
                >
                  {selectableCategories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}{category.isActive ? '' : ' (inactive)'}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1 text-sm font-semibold md:col-span-2">
                Excerpt
                <textarea
                  value={form.excerpt}
                  maxLength={2000}
                  rows={3}
                  className={inputClasses}
                  placeholder="A short introduction shown on Journal cards."
                  onChange={(event) => setForm({ ...form, excerpt: event.target.value })}
                />
              </label>
            </div>
          </section>

          <section className="rounded-xl border border-cocoa/10 bg-cream/50 p-5">
            <h2 className="mb-4 font-display text-lg font-bold">Story content</h2>
            <JournalBodyEditor
              blocks={form.blocks}
              bodyImages={post.images.filter((image) => image.role === 'body')}
              onChange={(blocks) => setForm({ ...form, blocks })}
            />
          </section>

          <section className="rounded-xl border border-cocoa/10 bg-white p-5">
            <h2 className="mb-4 font-display text-lg font-bold">Publishing</h2>
            {canPublishOrSchedule ? (
              <div className="flex flex-col gap-4">
                <div className="flex flex-wrap items-end gap-3">
                  <label className="flex min-w-64 flex-col gap-1 text-sm font-semibold">
                    Schedule date and time
                    <input
                      type="datetime-local"
                      value={scheduledFor}
                      className={inputClasses}
                      onChange={(event) => setScheduledFor(event.target.value)}
                    />
                  </label>
                  <Button variant="outline" disabled={busy || !scheduledFor} onClick={() => void handleSchedule()}>
                    {post.status === 'scheduled' ? 'Reschedule' : 'Schedule'}
                  </Button>
                  <Button disabled={busy} onClick={() => setConfirmAction('publish')}>Publish now</Button>
                </div>
                <p className="text-sm text-cocoa/55">Publishing requires an active category, excerpt, and story content.</p>
              </div>
            ) : post.status === 'published' ? (
              <Button variant="outline" disabled={busy} onClick={() => setConfirmAction('archive')}>Archive post</Button>
            ) : (
              <p className="text-sm text-cocoa/55">This post is archived and remains available for editing.</p>
            )}
          </section>

          <section className="rounded-xl border border-flame/20 bg-flame/5 p-5">
            <h2 className="font-display text-lg font-bold text-flame">Delete post</h2>
            <p className="mb-4 mt-1 text-sm text-cocoa/60">This removes the post and its stored Journal images.</p>
            <Button variant="outline" disabled={busy} onClick={() => setConfirmAction('delete')}>Delete post</Button>
          </section>
        </div>

        <aside className="self-start rounded-xl border border-cocoa/10 bg-white p-5 xl:sticky xl:top-6">
          <h2 className="mb-4 font-display text-lg font-bold">Photos</h2>
          <JournalImagesPanel
            token={token}
            post={post}
            onChanged={() => loadPost(true)}
            onInsertBlock={(image) => {
              setForm({
                ...form,
                blocks: [...form.blocks, { type: 'image', imageId: image.id, caption: image.caption ?? '' }],
              })
            }}
          />
        </aside>
      </div>

      <ConfirmDialog
        isOpen={confirmAction === 'publish'}
        title="Publish Journal post"
        message="Publish this post now? It will become visible in the customer Journal."
        confirmLabel="Publish"
        onCancel={() => setConfirmAction(null)}
        onConfirm={() => void runTransition('publish')}
      />
      <ConfirmDialog
        isOpen={confirmAction === 'archive'}
        title="Archive Journal post"
        message="Archive this post? It will no longer appear in the customer Journal."
        confirmLabel="Archive"
        onCancel={() => setConfirmAction(null)}
        onConfirm={() => void runTransition('archive')}
      />
      <ConfirmDialog
        isOpen={confirmAction === 'delete'}
        title="Delete Journal post"
        message="Delete this post and its images? This action cannot be undone."
        confirmLabel="Delete"
        onCancel={() => setConfirmAction(null)}
        onConfirm={() => void handleDelete()}
      />
    </div>
  )
}
