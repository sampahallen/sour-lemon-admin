import { useState } from 'react'
import { useNavigate } from 'react-router'
import { Drawer } from '@/components/ui/Drawer'
import { Button } from '@/components/ui/Button'
import { useAuth } from '@/auth/authContext'
import { createJournalPost, type JournalCategory } from '@/api/journal'

const inputClasses =
  'w-full rounded-lg border border-cocoa/20 px-3 py-2 text-sm font-normal outline-none focus:border-flame'

export function JournalPostCreateDrawer({
  isOpen,
  categories,
  defaultCategoryId,
  onClose,
}: {
  isOpen: boolean
  categories: JournalCategory[]
  defaultCategoryId: string | null
  onClose: () => void
}) {
  const { session } = useAuth()
  const token = session!.token
  const navigate = useNavigate()

  const [title, setTitle] = useState('')
  const [categoryId, setCategoryId] = useState(defaultCategoryId ?? '')
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const reset = () => {
    setTitle('')
    setCategoryId(defaultCategoryId ?? '')
    setError(null)
  }

  const handleClose = () => {
    reset()
    onClose()
  }

  const handleSubmit = async () => {
    if (!title.trim() || !categoryId) return
    setIsSaving(true)
    setError(null)
    try {
      const { post } = await createJournalPost(token, { title: title.trim(), categoryId })
      reset()
      onClose()
      navigate(`/journal/${post.id}`)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not create this post.')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Drawer isOpen={isOpen} onClose={handleClose} title="New journal post">
      <div className="flex flex-col gap-4">
        {error ? <p className="rounded-lg bg-flame/10 px-3 py-2 text-sm font-semibold text-flame">{error}</p> : null}

        <label className="flex flex-col gap-1 text-sm font-semibold">
          Title
          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            className={inputClasses}
            placeholder="e.g. Behind the scenes: our new mini cakes"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm font-semibold">
          Category
          <select
            value={categoryId}
            onChange={(event) => setCategoryId(event.target.value)}
            className={inputClasses}
          >
            <option value="">Choose a category…</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        </label>

        {categories.length === 0 ? (
          <p className="text-sm text-cocoa/60">Add a category first, then come back to create a post.</p>
        ) : null}

        <Button disabled={!title.trim() || !categoryId || isSaving} onClick={handleSubmit}>
          {isSaving ? 'Creating…' : 'Create post'}
        </Button>
      </div>
    </Drawer>
  )
}
