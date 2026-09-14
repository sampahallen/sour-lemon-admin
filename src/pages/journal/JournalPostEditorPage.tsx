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
import { JournalCoverPhoto } from './JournalCoverPhoto'
import { journalPublishTiming, journalStatusTone } from './journalStatus'
import { useFormValidation, type FieldErrors } from '@/hooks/useFormValidation'

const inputClasses =
  'w-full rounded-lg border border-cocoa/20 px-3 py-2 text-sm font-normal outline-none focus:border-flame'

interface EditorForm {
  title: string
  slug: string
  categoryId: string
  excerpt: string
  blocks: JournalBlock[]
}

type ConfirmAction = 'delete' | null

const AUTOSAVE_DELAY_MS = 1500

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
  const [isScheduleOpen, setIsScheduleOpen] = useState(false)
  const [validationMode, setValidationMode] = useState<'draft' | 'publish' | 'schedule'>('draft')
  type EditorField = 'title' | 'slug' | 'categoryId' | 'excerpt' | 'blocks' | 'scheduledFor'
  const validate = (mode: 'draft' | 'publish' | 'schedule'): FieldErrors<EditorField> => {
    const errors: FieldErrors<EditorField> = {}
    if (!form) return errors
    if (!form.title.trim()) errors.title = 'Enter a title.'
    else if (form.title.trim().length > 200) errors.title = 'Keep the title under 200 characters.'
    if (!form.slug.trim()) errors.slug = 'Enter a slug.'
    else if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(form.slug.trim())) errors.slug = 'Use lowercase letters, numbers, and single hyphens only.'
    else if (form.slug.trim().length > 220) errors.slug = 'Keep the slug under 220 characters.'
    if (!form.categoryId) errors.categoryId = 'Choose a category.'
    if (mode !== 'draft') {
      if (!categories.find((category) => category.id === form.categoryId)?.isActive) errors.categoryId = 'Choose an active category before publishing.'
      if (!form.excerpt.trim()) errors.excerpt = 'Add an excerpt before publishing.'
      else if (form.excerpt.trim().length > 2_000) errors.excerpt = 'Keep the excerpt under 2,000 characters.'
      if (!hasMeaningfulContent(form.blocks)) errors.blocks = 'Add at least one content block before publishing.'
    }
    if (mode === 'schedule') {
      const date = new Date(scheduledFor)
      if (!scheduledFor || Number.isNaN(date.getTime()) || date <= new Date()) errors.scheduledFor = 'Choose a future date and time.'
    }
    return errors
  }
  const validation = useFormValidation<EditorField>('journal-post', () => validate(validationMode))

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

  useEffect(() => {
    if (!isDirty || isTransitioning) return
    if (Object.keys(validate('draft')).length) return
    const timeout = setTimeout(() => void save(), AUTOSAVE_DELAY_MS)
    return () => clearTimeout(timeout)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form, isDirty, isTransitioning])

  const save = async () => {
    if (!post || !form) return false
    if (Object.keys(validate('draft')).length) return false

    const snapshot = form
    setIsSaving(true)
    setError(null)
    try {
      const { post: updated } = await updateJournalPost(token, post.id, {
        title: snapshot.title.trim(),
        slug: snapshot.slug.trim(),
        categoryId: snapshot.categoryId,
        excerpt: snapshot.excerpt.trim() || null,
        body: { version: 1, blocks: snapshot.blocks },
      })
      // Merge only the fields the update endpoint returns, so an autosave that
      // completes while the user keeps typing can't clobber their newer keystrokes
      // by resetting `form` (unlike loadPost(), which refetches the full detail).
      setPost((current) => (current ? { ...current, ...updated } : current))
      setSavedForm(snapshot)
      return true
    } catch (caught) {
      if (!validation.server(caught, (path) => path === 'body' || path.startsWith('body.') ? 'blocks' : (['title', 'slug', 'categoryId', 'excerpt'] as string[]).includes(path) ? path as EditorField : undefined)) {
        setError(caught instanceof Error ? caught.message : 'Could not save this post.')
      }
      return false
    } finally {
      setIsSaving(false)
    }
  }

  const prepareForPublication = async (mode: 'publish' | 'schedule') => {
    if (!form) return false
    setValidationMode(mode)
    if (!validation.submit(() => validate(mode))) return false
    if (isDirty && !(await save())) return false
    return true
  }

  const runTransition = async (action: 'publish' | 'archive') => {
    if (!post) return
    setIsTransitioning(true)
    setError(null)
    setNotice(null)
    try {
      if (action === 'publish') {
        if (!(await prepareForPublication('publish'))) return
        await publishJournalPost(token, post.id)
        setNotice('Post published.')
      } else {
        if (isDirty && !(await save())) return
        await archiveJournalPost(token, post.id)
        setNotice('Post archived.')
      }
      await loadPost()
      validation.reset()
      setValidationMode('draft')
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : `Could not ${action} this post.`)
    } finally {
      setIsTransitioning(false)
    }
  }

  const handleSchedule = async () => {
    if (!post) return

    setIsTransitioning(true)
    setError(null)
    setNotice(null)
    try {
      if (!(await prepareForPublication('schedule'))) return
      await scheduleJournalPost(token, post.id, new Date(scheduledFor).toISOString())
      await loadPost()
      validation.reset()
      setValidationMode('draft')
      setNotice('Post scheduled.')
      setIsScheduleOpen(false)
    } catch (caught) {
      if (!validation.server(caught, (path) => path === 'scheduledFor' ? 'scheduledFor' : undefined)) {
        setError(caught instanceof Error ? caught.message : 'Could not schedule this post.')
      }
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

  const cover = post.images.find((image) => image.role === 'cover') ?? null

  return (
    <div>
      <PageHeader
        title="Edit Journal post"
        action={
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" onClick={goBack}>Back</Button>
            {canPublishOrSchedule ? (
              <>
                <Button variant="outline" disabled={busy} onClick={() => setIsScheduleOpen((open) => !open)}>
                  {post.status === 'scheduled' ? 'Reschedule' : 'Schedule…'}
                </Button>
                <Button disabled={busy} onClick={() => void runTransition('publish')}>
                  {isTransitioning ? 'Publishing…' : 'Publish now'}
                </Button>
              </>
            ) : post.status === 'published' ? (
              <Button variant="outline" disabled={busy} onClick={() => void runTransition('archive')}>
                {isTransitioning ? 'Archiving…' : 'Archive post'}
              </Button>
            ) : null}
          </div>
        }
      />

      <div className="mb-5 flex flex-wrap items-center gap-3">
        <StatusBadge label={post.status} tone={journalStatusTone(post.status)} />
        <span className="text-sm text-cocoa/55">{journalPublishTiming(post)}</span>
        <span className="text-sm font-semibold text-cocoa/55">
          {isSaving ? 'Saving…' : isDirty ? 'Unsaved changes' : 'All changes saved'}
        </span>
      </div>

      {error ? <p className="mb-4 rounded-lg bg-flame/10 px-3 py-2 text-sm font-semibold text-flame">{error}</p> : null}
      {notice ? <p className="mb-4 rounded-lg bg-olive/10 px-3 py-2 text-sm font-semibold text-olive">{notice}</p> : null}

      {isScheduleOpen ? (
        <div className="mb-5 flex flex-wrap items-end gap-3 rounded-xl border border-cocoa/10 bg-white p-4">
          <label className="flex min-w-64 flex-col gap-1 text-sm font-semibold">
            Schedule date and time
            <input
              {...validation.props('scheduledFor')}
              type="datetime-local"
              value={scheduledFor}
              className={`${inputClasses} ${validation.error('scheduledFor') ? 'border-flame bg-flame/5' : ''}`}
              onChange={(event) => { setScheduledFor(event.target.value); validation.changed('scheduledFor') }}
            />
            {validation.error('scheduledFor') ? <span id="journal-post-scheduledFor-error" className="text-xs text-flame">{validation.error('scheduledFor')}</span> : null}
          </label>
          <Button disabled={busy} onClick={() => void handleSchedule()}>
            {post.status === 'scheduled' ? 'Update schedule' : 'Confirm schedule'}
          </Button>
          <button type="button" className="text-sm font-semibold text-cocoa/60" onClick={() => setIsScheduleOpen(false)}>
            Cancel
          </button>
        </div>
      ) : null}

      <div className="mx-auto max-w-3xl rounded-3xl border border-cocoa/10 bg-white p-6 shadow-sm sm:p-10">
        <JournalCoverPhoto token={token} postId={post.id} cover={cover} onChanged={() => loadPost(true)} />

        <input
          {...validation.props('title')}
          value={form.title}
          maxLength={200}
          placeholder="Untitled post"
          className={`w-full bg-transparent font-display text-4xl font-bold text-cocoa outline-none placeholder:text-cocoa/25 ${validation.error('title') ? 'border-b-2 border-flame bg-flame/5' : ''}`}
          onChange={(event) => { setForm({ ...form, title: event.target.value }); validation.changed('title') }}
        />
        {validation.error('title') ? <p id="journal-post-title-error" className="text-xs text-flame">{validation.error('title')}</p> : null}

        <div className="mt-3 flex flex-wrap items-center gap-3 text-sm">
          <select
            {...validation.props('categoryId')}
            value={form.categoryId}
            className={`rounded-full border border-cocoa/20 bg-cream px-3 py-1 font-semibold text-cocoa/70 outline-none focus:border-flame ${validation.error('categoryId') ? 'border-flame' : ''}`}
            onChange={(event) => { setForm({ ...form, categoryId: event.target.value }); validation.changed('categoryId') }}
          >
            {selectableCategories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
                {category.isActive ? '' : ' (inactive)'}
              </option>
            ))}
          </select>
          {validation.error('categoryId') ? <span id="journal-post-categoryId-error" className="text-xs text-flame">{validation.error('categoryId')}</span> : null}

          <label className="flex items-center gap-1 text-cocoa/45">
            <span>/journal/</span>
            <input
              {...validation.props('slug')}
              value={form.slug}
              maxLength={220}
              className={`rounded bg-transparent px-0.5 font-semibold text-cocoa/70 outline-none focus:bg-cocoa/5 ${validation.error('slug') ? 'border-b-2 border-flame bg-flame/5' : ''}`}
              onChange={(event) => { setForm({ ...form, slug: event.target.value }); validation.changed('slug') }}
            />
          </label>
          {validation.error('slug') ? <span id="journal-post-slug-error" className="text-xs text-flame">{validation.error('slug')}</span> : null}
        </div>

        <textarea
          {...validation.props('excerpt')}
          value={form.excerpt}
          maxLength={2000}
          rows={2}
          placeholder="Add a short excerpt for the Journal card…"
          className={`mt-4 w-full resize-none bg-transparent text-lg leading-relaxed text-cocoa/60 outline-none placeholder:text-cocoa/35 ${validation.error('excerpt') ? 'border-b-2 border-flame bg-flame/5' : ''}`}
          onChange={(event) => { setForm({ ...form, excerpt: event.target.value }); validation.changed('excerpt') }}
        />
        {validation.error('excerpt') ? <p id="journal-post-excerpt-error" className="text-xs text-flame">{validation.error('excerpt')}</p> : null}

        <div id="journal-post-blocks" tabIndex={-1} className={`mt-8 border-t border-cocoa/10 pt-8 ${validation.error('blocks') ? 'rounded-xl bg-flame/5' : ''}`}>
          {validation.error('blocks') ? <p id="journal-post-blocks-error" className="mb-3 text-xs text-flame">{validation.error('blocks')}</p> : null}
          <JournalBodyEditor
            blocks={form.blocks}
            bodyImages={post.images.filter((image) => image.role === 'body')}
            token={token}
            postId={post.id}
            onChange={(blocks) => { setForm({ ...form, blocks }); validation.changed('blocks') }}
            onImagesChanged={() => loadPost(true)}
          />
        </div>
      </div>

      <div className="mx-auto mt-6 flex max-w-3xl items-center justify-between gap-4 text-sm">
        <p className="text-cocoa/50">
          {post.status === 'archived'
            ? 'This post is archived and remains available for editing.'
            : 'Publishing requires an active category, excerpt, and story content.'}
        </p>
        <button
          type="button"
          disabled={busy}
          onClick={() => setConfirmAction('delete')}
          className="shrink-0 font-semibold text-flame/70 hover:text-flame disabled:opacity-40"
        >
          Delete this post
        </button>
      </div>

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
