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
  const publishingChecklist = [
    { label: 'Title', complete: form.title.trim().length > 0 },
    { label: 'Active category', complete: Boolean(currentCategory?.isActive) },
    { label: 'Journal card summary', complete: form.excerpt.trim().length > 0 },
    { label: 'Story content', complete: hasMeaningfulContent(form.blocks) },
  ]
  const completedChecklistItems = publishingChecklist.filter((item) => item.complete).length

  return (
    <div className="mx-auto max-w-7xl">
      <div className="sticky top-0 z-20 -mx-4 mb-6 border-b border-cocoa/10 bg-cream/95 px-4 py-3 backdrop-blur md:-mx-8 md:px-8">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4">
          <div className="flex min-w-0 items-center gap-3">
            <button type="button" onClick={goBack} className="shrink-0 text-sm font-bold text-cocoa/60 hover:text-cocoa">← Journal</button>
            <div className="hidden h-8 w-px bg-cocoa/10 sm:block" />
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="truncate font-display text-xl font-bold text-cocoa">Edit story</h1>
                <StatusBadge label={post.status} tone={journalStatusTone(post.status)} />
              </div>
              <p className="text-xs font-semibold text-cocoa/45">
                {isSaving ? 'Saving changes...' : isDirty ? 'Unsaved changes' : '✓ All changes saved'}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {canPublishOrSchedule ? (
              <>
                <Button variant="outline" disabled={busy} onClick={() => setIsScheduleOpen((open) => !open)}>
                  {post.status === 'scheduled' ? 'Reschedule' : 'Schedule'}
                </Button>
                <Button disabled={busy} onClick={() => void runTransition('publish')}>
                  {isTransitioning ? 'Publishing...' : 'Publish now'}
                </Button>
              </>
            ) : post.status === 'published' ? (
              <Button variant="outline" disabled={busy} onClick={() => void runTransition('archive')}>
                {isTransitioning ? 'Archiving...' : 'Archive post'}
              </Button>
            ) : null}
          </div>
        </div>
      </div>

      {error ? <p className="mb-4 rounded-lg bg-flame/10 px-3 py-2 text-sm font-semibold text-flame">{error}</p> : null}
      {notice ? <p className="mb-4 rounded-lg bg-olive/10 px-3 py-2 text-sm font-semibold text-olive">{notice}</p> : null}

      <div className="mb-6 grid gap-3 sm:grid-cols-3" aria-label="Journal publishing steps">
        {[
          { number: '1', title: 'Write', copy: 'Add the title, cover and story.', complete: form.title.trim().length > 0 && hasMeaningfulContent(form.blocks) },
          { number: '2', title: 'Describe', copy: 'Choose a category and summary.', complete: Boolean(currentCategory?.isActive) && form.excerpt.trim().length > 0 },
          { number: '3', title: 'Publish', copy: 'Share now or choose a date.', complete: post.status === 'published' || post.status === 'scheduled' },
        ].map((step) => (
          <div key={step.number} className={`flex items-center gap-3 rounded-2xl border p-4 ${step.complete ? 'border-olive/20 bg-olive/5' : 'border-cocoa/10 bg-white'}`}>
            <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-full font-display text-sm font-bold ${step.complete ? 'bg-olive text-white' : 'bg-butter text-cocoa'}`}>
              {step.complete ? '✓' : step.number}
            </span>
            <div>
              <p className="font-display font-bold text-cocoa">{step.title}</p>
              <p className="text-xs text-cocoa/50">{step.copy}</p>
            </div>
          </div>
        ))}
      </div>

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

      <div className="mx-auto max-w-4xl overflow-hidden rounded-3xl border border-cocoa/10 bg-white shadow-sm">
        <div className="border-b border-cocoa/10 bg-butter/25 px-6 py-5 sm:px-10">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-flame">Step 1 · Write</p>
          <h2 className="mt-1 font-display text-2xl font-bold text-cocoa">Tell the story in your own voice.</h2>
          <p className="mt-1 text-sm text-cocoa/55">Everything saves automatically. Start with the title, then use the simple toolbar as you write.</p>
        </div>
        <div className="p-6 sm:p-10">
        <div className="mb-4">
          <p className="font-display text-lg font-bold text-cocoa">Cover photo</p>
          <p className="text-sm text-cocoa/50">The first image readers see on the Journal card and story page.</p>
        </div>
        <JournalCoverPhoto token={token} postId={post.id} cover={cover} onChanged={() => loadPost(true)} />

        <label htmlFor="journal-post-title" className="mb-2 mt-8 block text-xs font-bold uppercase tracking-[0.16em] text-cocoa/45">Story title</label>
        <input
            {...validation.props('title')}
          value={form.title}
          maxLength={200}
          placeholder="Give your story a memorable title"
          className={`w-full bg-transparent font-display text-4xl font-bold leading-tight text-cocoa outline-none placeholder:text-cocoa/25 sm:text-5xl ${validation.error('title') ? 'border-b-2 border-flame bg-flame/5' : ''}`}
          onChange={(event) => { setForm({ ...form, title: event.target.value }); validation.changed('title') }}
        />
        {validation.error('title') ? <p id="journal-post-title-error" className="text-xs text-flame">{validation.error('title')}</p> : null}

        <section className="mt-8 rounded-2xl border border-cocoa/10 bg-cream/45 p-5">
          <div className="mb-5">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-flame">Step 2 · Describe</p>
            <h3 className="mt-1 font-display text-xl font-bold text-cocoa">Help readers find the story.</h3>
            <p className="mt-1 text-sm text-cocoa/50">Choose where it belongs and write the short introduction shown on Journal cards.</p>
          </div>
          <label className="block text-sm font-bold text-cocoa">
            Category
            <select
            {...validation.props('categoryId')}
            value={form.categoryId}
            className={`mt-1.5 w-full rounded-lg border border-cocoa/20 bg-white px-3 py-2 font-normal text-cocoa outline-none focus:border-flame ${validation.error('categoryId') ? 'border-flame' : ''}`}
            onChange={(event) => { setForm({ ...form, categoryId: event.target.value }); validation.changed('categoryId') }}
          >
            {selectableCategories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
                {category.isActive ? '' : ' (inactive)'}
              </option>
            ))}
            </select>
          </label>
          {validation.error('categoryId') ? <span id="journal-post-categoryId-error" className="mt-1 block text-xs text-flame">{validation.error('categoryId')}</span> : null}

          <label className="mt-5 block text-sm font-bold text-cocoa">
            Story URL
            <span className="mt-1.5 flex items-center rounded-lg border border-cocoa/20 bg-white px-3 focus-within:border-flame">
              <span className="shrink-0 text-xs font-normal text-cocoa/40">/journal/</span>
              <input
                {...validation.props('slug')}
                value={form.slug}
                maxLength={220}
                className="min-w-0 flex-1 bg-transparent py-2 text-sm font-semibold text-cocoa outline-none"
                onChange={(event) => { setForm({ ...form, slug: event.target.value }); validation.changed('slug') }}
              />
            </span>
          </label>
          {validation.error('slug') ? <span id="journal-post-slug-error" className="mt-1 block text-xs text-flame">{validation.error('slug')}</span> : null}

          <label className="mt-5 block text-sm font-bold text-cocoa">
            Journal card summary
            <textarea
              {...validation.props('excerpt')}
              value={form.excerpt}
              maxLength={2000}
              rows={4}
              placeholder="In one or two sentences, tell readers what this story is about."
              className={`mt-1.5 w-full resize-y rounded-lg border border-cocoa/20 bg-white px-3 py-2 text-sm font-normal leading-relaxed text-cocoa outline-none placeholder:text-cocoa/35 focus:border-flame ${validation.error('excerpt') ? 'border-flame bg-flame/5' : ''}`}
              onChange={(event) => { setForm({ ...form, excerpt: event.target.value }); validation.changed('excerpt') }}
            />
          </label>
          <div className="mt-1 flex justify-between gap-3 text-xs text-cocoa/40">
            <span>Shown before readers open the story.</span>
            <span>{form.excerpt.length}/2000</span>
          </div>
        {validation.error('excerpt') ? <p id="journal-post-excerpt-error" className="text-xs text-flame">{validation.error('excerpt')}</p> : null}
        </section>

        <div id="journal-post-blocks" tabIndex={-1} className={`mt-8 border-t border-cocoa/10 pt-8 ${validation.error('blocks') ? 'rounded-xl bg-flame/5' : ''}`}>
          <div className="mb-4">
            <h3 className="font-display text-xl font-bold text-cocoa">Story body</h3>
            <p className="text-sm text-cocoa/50">Click into any block to write. The toolbar changes the selected block or adds a new one.</p>
          </div>
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
      </div>

      <div className="mx-auto mt-6 grid max-w-4xl gap-4 rounded-3xl bg-cocoa p-6 text-cream sm:grid-cols-[1fr_auto] sm:items-center sm:p-8">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <span className="grid h-9 w-9 place-items-center rounded-full bg-flame font-display text-sm font-bold">3</span>
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-butter">Publish</p>
              <h2 className="font-display text-2xl font-bold">Ready to share?</h2>
            </div>
          </div>
          <p className="mt-3 max-w-xl text-sm leading-relaxed text-cream/55">
            {post.status === 'archived'
              ? 'This story is archived and remains available for editing.'
              : `${completedChecklistItems} of ${publishingChecklist.length} publishing essentials complete.`}
          </p>
          <ul className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
            {publishingChecklist.map((item) => (
              <li key={item.label} className="flex items-center gap-2">
                <span className={`grid h-5 w-5 place-items-center rounded-full text-xs font-bold ${item.complete ? 'bg-olive text-white' : 'bg-cream/10 text-cream/35'}`}>
                  {item.complete ? '✓' : '·'}
                </span>
                <span className={item.complete ? 'text-cream' : 'text-cream/50'}>{item.label}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="flex flex-col items-start gap-2 sm:items-end">
          <p className="text-xs text-cream/45">{journalPublishTiming(post)}</p>
          <button
            type="button"
            disabled={busy}
            onClick={() => setConfirmAction('delete')}
            className="text-sm font-semibold text-flame hover:text-butter disabled:opacity-40"
          >
            Delete this story
          </button>
        </div>
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
