import { useState } from 'react'
import { useAuth } from '@/auth/authContext'
import {
  createCategory,
  deleteCategory,
  updateCategory,
  type Category,
} from '@/api/categories'
import { Button } from '@/components/ui/Button'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { Drawer } from '@/components/ui/Drawer'
import { ToggleSwitch } from '@/components/ui/ToggleSwitch'
import { useFormValidation, type FieldErrors } from '@/hooks/useFormValidation'

const inputClasses =
  'w-full rounded-lg border border-cocoa/20 px-3 py-2 text-sm font-normal outline-none focus:border-flame'

export function MenuCategoriesDrawer({
  isOpen,
  siteSectionId,
  categories,
  onClose,
  onChanged,
}: {
  isOpen: boolean
  siteSectionId: string | null
  categories: Category[]
  onClose: () => void
  onChanged: () => Promise<void>
}) {
  const { session } = useAuth()
  const token = session!.token
  const [editingId, setEditingId] = useState<string | 'new' | null>(null)
  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')
  const [sortOrder, setSortOrder] = useState('0')
  const [pendingDelete, setPendingDelete] = useState<Category | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  type CategoryField = 'name' | 'slug' | 'sortOrder'
  const validate = (): FieldErrors<CategoryField> => {
    const errors: FieldErrors<CategoryField> = {}
    if (!name.trim()) errors.name = 'Enter a category name.'
    else if (name.trim().length > 100) errors.name = 'Keep the name under 100 characters.'
    if (slug.trim() && !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug.trim())) errors.slug = 'Use lowercase letters, numbers, and single hyphens only.'
    else if (slug.trim().length > 120) errors.slug = 'Keep the slug under 120 characters.'
    if (!/^\d+$/.test(sortOrder) || Number(sortOrder) > 10_000) errors.sortOrder = 'Enter a whole number from 0 to 10,000.'
    return errors
  }
  const validation = useFormValidation<CategoryField>('menu-category', validate)

  const startEdit = (category: Category | 'new') => {
    setError(null)
    validation.reset()
    if (category === 'new') {
      setEditingId('new')
      setName('')
      setSlug('')
      setSortOrder(String(categories.length * 10))
      return
    }
    setEditingId(category.id)
    setName(category.name)
    setSlug(category.slug)
    setSortOrder(String(category.sortOrder))
  }

  const save = async () => {
    if (!siteSectionId || !validation.submit()) return
    setIsSaving(true)
    setError(null)
    try {
      const input = {
        siteSectionId,
        name: name.trim(),
        ...(slug.trim() ? { slug: slug.trim() } : {}),
        sortOrder: Number(sortOrder),
      }
      if (editingId && editingId !== 'new') await updateCategory(token, editingId, input)
      else await createCategory(token, input)
      setEditingId(null)
      await onChanged()
    } catch (caught) {
      if (!validation.server(caught, (path) => (['name', 'slug', 'sortOrder'] as string[]).includes(path) ? path as CategoryField : undefined)) {
        setError(caught instanceof Error ? caught.message : 'Could not save this category.')
      }
    } finally {
      setIsSaving(false)
    }
  }

  const toggle = async (category: Category, isActive: boolean) => {
    setError(null)
    try {
      await updateCategory(token, category.id, { isActive })
      await onChanged()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not update this category.')
    }
  }

  const remove = async () => {
    if (!pendingDelete) return
    setError(null)
    try {
      await deleteCategory(token, pendingDelete.id)
      setPendingDelete(null)
      await onChanged()
    } catch (caught) {
      setPendingDelete(null)
      setError(caught instanceof Error ? caught.message : 'Could not delete this category.')
    }
  }

  return (
    <Drawer isOpen={isOpen} onClose={onClose} title="Bakery categories">
      <div className="flex flex-col gap-4">
        {error ? <p className="rounded-lg bg-flame/10 px-3 py-2 text-sm font-semibold text-flame">{error}</p> : null}
        {categories.length ? (
          <div className="divide-y divide-cocoa/10 rounded-xl border border-cocoa/10 bg-white">
            {categories.map((category) => (
              <div key={category.id} className="flex items-center justify-between gap-3 p-3">
                <div>
                  <p className="font-semibold">{category.name}</p>
                  <p className="text-xs text-cocoa/50">/{category.slug}</p>
                </div>
                <div className="flex items-center gap-3">
                  <ToggleSwitch checked={category.isActive} onChange={(next) => void toggle(category, next)} />
                  <button className="text-xs font-semibold text-flame" onClick={() => startEdit(category)}>Edit</button>
                  <button className="text-xs font-semibold text-cocoa/60" onClick={() => setPendingDelete(category)}>Delete</button>
                </div>
              </div>
            ))}
          </div>
        ) : <p className="text-sm text-cocoa/60">No Bakery categories yet.</p>}

        {editingId ? (
          <div className="flex flex-col gap-3 rounded-xl border border-cocoa/10 bg-white p-4">
            <label className="flex flex-col gap-1 text-sm font-semibold">
              Name
              <input {...validation.props('name')} value={name} onChange={(event) => { setName(event.target.value); validation.changed('name') }} className={`${inputClasses} ${validation.error('name') ? 'border-flame bg-flame/5' : ''}`} />
              {validation.error('name') ? <span id="menu-category-name-error" className="text-xs text-flame">{validation.error('name')}</span> : null}
            </label>
            <label className="flex flex-col gap-1 text-sm font-semibold">
              Slug {editingId === 'new' ? '(optional)' : ''}
              <input {...validation.props('slug')} value={slug} onChange={(event) => { setSlug(event.target.value); validation.changed('slug') }} className={`${inputClasses} ${validation.error('slug') ? 'border-flame bg-flame/5' : ''}`} />
              {validation.error('slug') ? <span id="menu-category-slug-error" className="text-xs text-flame">{validation.error('slug')}</span> : null}
            </label>
            <label className="flex flex-col gap-1 text-sm font-semibold">
              Sort order
              <input {...validation.props('sortOrder')} type="number" min="0" value={sortOrder} onChange={(event) => { setSortOrder(event.target.value); validation.changed('sortOrder') }} className={`${inputClasses} ${validation.error('sortOrder') ? 'border-flame bg-flame/5' : ''}`} />
              {validation.error('sortOrder') ? <span id="menu-category-sortOrder-error" className="text-xs text-flame">{validation.error('sortOrder')}</span> : null}
            </label>
            <div className="flex gap-2">
              <Button disabled={!siteSectionId || isSaving} onClick={() => void save()}>
                {isSaving ? 'Saving…' : 'Save category'}
              </Button>
              <button className="text-sm font-semibold text-cocoa/60" onClick={() => setEditingId(null)}>Cancel</button>
            </div>
          </div>
        ) : (
          <Button variant="outline" disabled={!siteSectionId} onClick={() => startEdit('new')}>Add category</Button>
        )}
      </div>

      <ConfirmDialog
        isOpen={pendingDelete !== null}
        title="Delete category"
        message={`Delete "${pendingDelete?.name}"? Its products must be moved or deleted first.`}
        confirmLabel="Delete"
        onCancel={() => setPendingDelete(null)}
        onConfirm={() => void remove()}
      />
    </Drawer>
  )
}
