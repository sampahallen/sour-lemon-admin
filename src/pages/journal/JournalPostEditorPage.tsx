import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
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
import { Drawer } from '@/components/ui/Drawer'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { JournalBodyEditor } from './JournalBodyEditor'
import { JournalCoverPhoto } from './JournalCoverPhoto'
import { journalPublishTiming, journalStatusTone } from './journalStatus'
import { useFormValidation, type FieldErrors } from '@/hooks/useFormValidation'

const inputClasses =
  'w-full rounded-lg border border-cocoa/20 px-3 py-2 text-sm font-normal outline-none focus:border-flame'

interface EditorForm {
  title: string
  categoryId: string
  excerpt: string
  blocks: JournalBlock[]
}

type ConfirmAction = 'delete' | null

const AUTOSAVE_DELAY_MS = 1500

const formFromPost = (post: JournalPostDetail): EditorForm => ({
  title: post.title,
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
  const [openPanel, setOpenPanel] = useState<'details' | 'publish' | null>(null)
  const [publishMode, setPublishMode] = useState<'now' | 'schedule'>('now')
  const actionBarRef = useRef<HTMLDivElement>(null)
  const [actionBarHeight, setActionBarHeight] = useState(80)

  useEffect(() => {
    const bar = actionBarRef.current
    if (!bar) return
    const updateHeight = () => setActionBarHeight(Math.ceil(bar.getBoundingClientRect().height))
    updateHeight()
    const observer = new ResizeObserver(updateHeight)
    observer.observe(bar)
    return () => observer.disconnect()
  }, [isLoading, post?.id])
  const [validationMode, setValidationMode] = useState<'draft' | 'publish' | 'schedule'>('draft')
  type EditorField = 'title' | 'categoryId' | 'excerpt' | 'blocks' | 'scheduledFor'
  const validate = (mode: 'draft' | 'publish' | 'schedule'): FieldErrors<EditorField> => {
    const errors: FieldErrors<EditorField> = {}
    if (!form) return errors
    if (!form.title.trim()) errors.title = 'Enter a title.'
    else if (form.title.trim().length > 200) errors.title = 'Keep the title under 200 characters.'
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
      if (!validation.server(caught, (path) => path === 'body' || path.startsWith('body.') ? 'blocks' : (['title', 'categoryId', 'excerpt'] as string[]).includes(path) ? path as EditorField : undefined)) {
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
      setOpenPanel(null)
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
      setOpenPanel(null)
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
    <div className="mx-auto max-w-6xl" style={{ '--journal-actions-height': `${actionBarHeight}px` } as CSSProperties}>
      <div ref={actionBarRef} className="relative z-10 -mx-4 mb-8 border-b border-cocoa/10 bg-white/95 px-4 py-3 backdrop-blur sm:sticky sm:top-16 sm:z-20 md:-mx-8 md:px-8">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <button type="button" onClick={goBack} className="shrink-0 text-sm font-bold text-cocoa/60 hover:text-cocoa">← Journal</button>
            <div className="hidden h-8 w-px bg-cocoa/10 sm:block" />
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="max-w-52 truncate text-sm font-bold text-cocoa sm:max-w-72">{form.title || 'Untitled story'}</h1>
                <StatusBadge label={post.status} tone={journalStatusTone(post.status)} />
              </div>
              <p className="text-xs font-semibold text-cocoa/45">
                {isSaving ? 'Saving…' : isDirty ? 'Unsaved changes' : 'Saved'}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" accent="cocoa" onClick={() => setOpenPanel('details')}>Post details</Button>
            {canPublishOrSchedule ? (
              <Button onClick={() => { setPublishMode(post.status === 'scheduled' ? 'schedule' : 'now'); setOpenPanel('publish') }}>Publish</Button>
            ) : null}
            <details className="relative">
              <summary className="flex min-h-10 cursor-pointer list-none items-center rounded-xl border border-cocoa/20 bg-white px-3 text-sm font-bold text-cocoa" aria-label="More post actions">More</summary>
              <div className="absolute right-0 top-12 z-30 w-44 rounded-xl border border-cocoa/10 bg-white p-1 shadow-lg">
                {post.status === 'published' ? <button type="button" disabled={busy} onClick={() => void runTransition('archive')} className="w-full rounded-lg px-3 py-2 text-left text-sm font-semibold hover:bg-cocoa/5">Archive post</button> : null}
                <button type="button" disabled={busy} onClick={() => setConfirmAction('delete')} className="w-full rounded-lg px-3 py-2 text-left text-sm font-semibold text-flame hover:bg-flame/5">Delete post</button>
              </div>
            </details>
          </div>
        </div>
      </div>

      {error ? <p className="mb-4 rounded-lg bg-flame/10 px-3 py-2 text-sm font-semibold text-flame">{error}</p> : null}
      {notice ? <p className="mb-4 rounded-lg bg-olive/10 px-3 py-2 text-sm font-semibold text-olive">{notice}</p> : null}

      <article className="mx-auto w-full max-w-5xl rounded-2xl border border-cocoa/10 bg-white px-2 py-6 shadow-sm sm:px-8 sm:py-10 lg:px-12">
        <label htmlFor="journal-post-title" className="mb-2 block text-xs font-bold uppercase tracking-[0.16em] text-cocoa/45">Title</label>
        <input
          {...validation.props('title')}
          value={form.title}
          maxLength={200}
          placeholder="Untitled story"
          className={`journal-title-anchor w-full bg-transparent font-display text-3xl font-bold leading-tight text-cocoa outline-none placeholder:text-cocoa/25 sm:text-5xl ${validation.error('title') ? 'border-b-2 border-flame bg-flame/5' : ''}`}
          onChange={(event) => { setForm({ ...form, title: event.target.value }); validation.changed('title') }}
        />
        {validation.error('title') ? <p id="journal-post-title-error" className="text-xs text-flame">{validation.error('title')}</p> : null}
        <div className="mt-7"><JournalCoverPhoto token={token} postId={post.id} cover={cover} onChanged={() => loadPost(true)} /></div>
        <div id="journal-post-blocks" tabIndex={-1} className={`journal-editor-anchor mt-6 ${validation.error('blocks') ? 'rounded-xl bg-flame/5' : ''}`}>
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
      </article>

      <Drawer isOpen={openPanel !== null} onClose={() => setOpenPanel(null)} title={openPanel === 'publish' ? 'Publish story' : 'Post details'}>
        <div className="flex flex-col gap-5">
          <p className="text-sm text-cocoa/60">{openPanel === 'publish' ? 'Check the details readers will see, then publish now or choose a time.' : 'These details appear on the Journal card and story page.'}</p>
          {error ? <p role="alert" className="rounded-lg bg-flame/10 p-3 text-sm text-flame">{error}</p> : null}
          {(validation.error('title') || validation.error('blocks')) ? (
            <div role="alert" className="rounded-xl border border-flame/20 bg-flame/5 p-4 text-sm text-flame">
              <p className="font-bold">Finish the story before publishing.</p>
              {validation.error('title') ? <p>{validation.error('title')}</p> : null}
              {validation.error('blocks') ? <p>{validation.error('blocks')}</p> : null}
              <button type="button" className="mt-2 font-bold underline" onClick={() => {
                const target = validation.error('title') ? document.getElementById('journal-post-title') : document.getElementById('journal-post-blocks')
                setOpenPanel(null)
                window.setTimeout(() => target?.focus(), 100)
              }}>Go to story</button>
            </div>
          ) : null}
          <label className="flex flex-col gap-2 text-sm font-bold text-cocoa">
            Category
            <select
              {...validation.props('categoryId')}
              value={form.categoryId}
              className={`${inputClasses} bg-white ${validation.error('categoryId') ? 'border-flame bg-flame/5' : ''}`}
              onChange={(event) => { setForm({ ...form, categoryId: event.target.value }); validation.changed('categoryId') }}
            >
              {selectableCategories.map((category) => <option key={category.id} value={category.id}>{category.name}{category.isActive ? '' : ' (inactive)'}</option>)}
            </select>
            {validation.error('categoryId') ? <span id="journal-post-categoryId-error" className="text-xs font-normal text-flame">{validation.error('categoryId')}</span> : null}
          </label>
          <label className="flex flex-col gap-2 text-sm font-bold text-cocoa">
            Summary
            <textarea
              {...validation.props('excerpt')}
              value={form.excerpt}
              maxLength={2000}
              rows={4}
              placeholder="A short introduction for the Journal card"
              className={`${inputClasses} resize-y bg-white leading-relaxed ${validation.error('excerpt') ? 'border-flame bg-flame/5' : ''}`}
              onChange={(event) => { setForm({ ...form, excerpt: event.target.value }); validation.changed('excerpt') }}
            />
            <span className="text-xs font-normal text-cocoa/45">{form.excerpt.length}/2000 characters</span>
            {validation.error('excerpt') ? <span id="journal-post-excerpt-error" className="text-xs font-normal text-flame">{validation.error('excerpt')}</span> : null}
          </label>
          {openPanel === 'publish' ? (
            <div className="border-t border-cocoa/10 pt-5">
              <p className="mb-3 text-sm font-bold text-cocoa">When should this go live?</p>
              <div className="grid gap-2 sm:grid-cols-2">
                <label className={`cursor-pointer rounded-xl border p-3 text-sm font-semibold ${publishMode === 'now' ? 'border-flame bg-flame/5' : 'border-cocoa/15 bg-white'}`}><input type="radio" name="publish-mode" checked={publishMode === 'now'} onChange={() => setPublishMode('now')} className="mr-2" />Publish now</label>
                <label className={`cursor-pointer rounded-xl border p-3 text-sm font-semibold ${publishMode === 'schedule' ? 'border-flame bg-flame/5' : 'border-cocoa/15 bg-white'}`}><input type="radio" name="publish-mode" checked={publishMode === 'schedule'} onChange={() => setPublishMode('schedule')} className="mr-2" />Schedule</label>
              </div>
              {publishMode === 'schedule' ? (
                <label className="mt-4 flex flex-col gap-2 text-sm font-bold">
                  Date and time
                  <input {...validation.props('scheduledFor')} type="datetime-local" value={scheduledFor} className={`${inputClasses} bg-white ${validation.error('scheduledFor') ? 'border-flame bg-flame/5' : ''}`} onChange={(event) => { setScheduledFor(event.target.value); validation.changed('scheduledFor') }} />
                  {validation.error('scheduledFor') ? <span id="journal-post-scheduledFor-error" className="text-xs font-normal text-flame">{validation.error('scheduledFor')}</span> : null}
                </label>
              ) : null}
              <p className="mt-4 text-xs text-cocoa/55">Current status: {journalPublishTiming(post)}</p>
              <Button className="mt-5 w-full" disabled={busy} onClick={() => publishMode === 'schedule' ? void handleSchedule() : void runTransition('publish')}>
                {busy ? 'Working…' : publishMode === 'schedule' ? post.status === 'scheduled' ? 'Update schedule' : 'Schedule story' : 'Publish now'}
              </Button>
            </div>
          ) : (
            <Button className="w-full" disabled={busy} onClick={() => {
              setValidationMode('draft')
              if (!validation.submit(() => validate('draft'))) return
              void save().then((saved) => { if (saved) setOpenPanel(null) })
            }}>
              {isSaving ? 'Saving…' : 'Save details'}
            </Button>
          )}
        </div>
      </Drawer>

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
