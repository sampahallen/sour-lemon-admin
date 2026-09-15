import { useEffect, useState } from 'react'
import { Drawer } from '@/components/ui/Drawer'
import { Button } from '@/components/ui/Button'
import { ToggleSwitch } from '@/components/ui/ToggleSwitch'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { useAuth } from '@/auth/authContext'
import {
  createJournalCategory,
  deleteJournalCategory,
  listJournalCategories,
  updateJournalCategory,
  type JournalCategory,
} from '@/api/journal'
import { useFormValidation, type FieldErrors } from '@/hooks/useFormValidation'

const inputClasses =
  'w-full rounded-lg border border-cocoa/20 px-3 py-2 text-sm font-normal outline-none focus:border-flame'

const emptyForm = { name: '', description: '', sortOrder: '0' }

export function JournalCategoriesDrawer({
  isOpen,
  onClose,
  onChanged,
}: {
  isOpen: boolean
  onClose: () => void
  onChanged: () => Promise<void> | void
}) {
  const { session } = useAuth()
  const token = session!.token

  const [categories, setCategories] = useState<JournalCategory[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | 'new' | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [isSaving, setIsSaving] = useState(false)
  const [pendingDelete, setPendingDelete] = useState<JournalCategory | null>(null)
  type CategoryField = 'name' | 'description' | 'sortOrder'
  const validate = (): FieldErrors<CategoryField> => {
    const errors: FieldErrors<CategoryField> = {}
    if (!form.name.trim()) errors.name = 'Enter a category name.'
    else if (form.name.trim().length > 100) errors.name = 'Keep the name under 100 characters.'
    if (form.description.trim().length > 2_000) errors.description = 'Keep the description under 2,000 characters.'
    if (!/^\d+$/.test(form.sortOrder) || Number(form.sortOrder) > 10_000) errors.sortOrder = 'Enter a whole number from 0 to 10,000.'
    return errors
  }
  const validation = useFormValidation<CategoryField>('journal-category', validate)

  const refresh = async () => {
    setIsLoading(true)
    try {
      const { categories } = await listJournalCategories(token)
      setCategories(categories)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not load categories.')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    if (isOpen) void refresh()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen])

  const startEdit = (category: JournalCategory | 'new') => {
    setError(null)
    validation.reset()
    if (category === 'new') {
      setForm(emptyForm)
    } else {
      setForm({
        name: category.name,
        description: category.description ?? '',
        sortOrder: String(category.sortOrder),
      })
    }
    setEditingId(category === 'new' ? 'new' : category.id)
  }

  const handleSubmit = async () => {
    if (!validation.submit()) return
    setIsSaving(true)
    setError(null)
    try {
      const input = {
        name: form.name.trim(),
        description: form.description.trim() || null,
        sortOrder: Number(form.sortOrder),
      }
      if (editingId && editingId !== 'new') {
        await updateJournalCategory(token, editingId, input)
      } else {
        await createJournalCategory(token, input)
      }
      setEditingId(null)
      await refresh()
      await onChanged()
    } catch (caught) {
      if (!validation.server(caught, (path) => (['name', 'description', 'sortOrder'] as string[]).includes(path) ? path as CategoryField : undefined)) {
        setError(caught instanceof Error ? caught.message : 'Could not save this category.')
      }
    } finally {
      setIsSaving(false)
    }
  }

  const handleToggleActive = async (category: JournalCategory, isActive: boolean) => {
    setError(null)
    try {
      await updateJournalCategory(token, category.id, { isActive })
      await refresh()
      await onChanged()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not update this category.')
    }
  }

  const handleDelete = async (category: JournalCategory) => {
    setError(null)
    try {
      await deleteJournalCategory(token, category.id)
      setPendingDelete(null)
      await refresh()
      await onChanged()
    } catch (caught) {
      setPendingDelete(null)
      setError(caught instanceof Error ? caught.message : 'Could not delete this category.')
    }
  }

  return (
    <Drawer isOpen={isOpen} onClose={onClose} title="Journal categories">
      <div className="flex flex-col gap-4">
        {error ? <p className="rounded-lg bg-flame/10 px-3 py-2 text-sm font-semibold text-flame">{error}</p> : null}

        {isLoading ? (
          <p className="text-cocoa/60">Loading…</p>
        ) : categories.length === 0 ? (
          <p className="rounded-xl border border-cocoa/10 bg-white p-4 text-center text-sm text-cocoa/60">
            No categories yet. Add one below.
          </p>
        ) : (
          <div className="flex flex-col divide-y divide-cocoa/10 rounded-xl border border-cocoa/10 bg-white">
            {categories.map((category) => (
              <div key={category.id} className="flex items-center justify-between gap-3 p-3">
                <div>
                  <p className="font-semibold">{category.name}</p>
                  <p className="text-xs text-cocoa/50">/{category.slug}</p>
                </div>
                <div className="flex items-center gap-3">
                  <ToggleSwitch
                    checked={category.isActive}
                    onChange={(next) => handleToggleActive(category, next)}
                  />
                  <button className="text-xs font-semibold text-flame" onClick={() => startEdit(category)}>
                    Edit
                  </button>
                  <button
                    className="text-xs font-semibold text-cocoa/60"
                    onClick={() => setPendingDelete(category)}
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {editingId ? (
          <div className="flex flex-col gap-3 rounded-xl border border-cocoa/10 bg-white p-4">
            <label className="flex flex-col gap-1 text-sm font-semibold">
              Name
              <input
                {...validation.props('name')}
                value={form.name}
                onChange={(event) => { setForm({ ...form, name: event.target.value }); validation.changed('name') }}
                className={`${inputClasses} ${validation.error('name') ? 'border-flame bg-flame/5' : ''}`}
              />
              {validation.error('name') ? <span id="journal-category-name-error" className="text-xs text-flame">{validation.error('name')}</span> : null}
            </label>
            <label className="flex flex-col gap-1 text-sm font-semibold">
              Description
              <textarea
                {...validation.props('description')}
                value={form.description}
                onChange={(event) => { setForm({ ...form, description: event.target.value }); validation.changed('description') }}
                rows={2}
                className={`${inputClasses} ${validation.error('description') ? 'border-flame bg-flame/5' : ''}`}
              />
              {validation.error('description') ? <span id="journal-category-description-error" className="text-xs text-flame">{validation.error('description')}</span> : null}
            </label>
            <label className="flex flex-col gap-1 text-sm font-semibold">
              Sort order
              <input
                {...validation.props('sortOrder')}
                value={form.sortOrder}
                onChange={(event) => { setForm({ ...form, sortOrder: event.target.value }); validation.changed('sortOrder') }}
                className={`${inputClasses} ${validation.error('sortOrder') ? 'border-flame bg-flame/5' : ''}`}
              />
              {validation.error('sortOrder') ? <span id="journal-category-sortOrder-error" className="text-xs text-flame">{validation.error('sortOrder')}</span> : null}
            </label>
            <div className="flex gap-2">
              <Button size="md" disabled={isSaving} onClick={handleSubmit}>
                {isSaving ? 'Saving…' : 'Save'}
              </Button>
              <button className="text-sm font-semibold text-cocoa/60" onClick={() => setEditingId(null)}>
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <Button variant="outline" onClick={() => startEdit('new')}>
            Add category
          </Button>
        )}
      </div>

      <ConfirmDialog
        isOpen={pendingDelete !== null}
        title="Delete category"
        message={`Delete "${pendingDelete?.name}"? Posts using this category must be moved first.`}
        confirmLabel="Delete"
        onCancel={() => setPendingDelete(null)}
        onConfirm={() => {
          if (pendingDelete) void handleDelete(pendingDelete)
        }}
      />
    </Drawer>
  )
}
