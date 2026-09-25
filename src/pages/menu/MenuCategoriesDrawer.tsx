import { useState } from 'react'
import { useAuth } from '@/auth/authContext'
import {
  createCategory,
  deleteCategory,
  reorderCategories,
  updateCategory,
  type Category,
} from '@/api/categories'
import { Button } from '@/components/ui/Button'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { CategoryOrderList } from '@/components/ui/CategoryOrderList'
import { Drawer } from '@/components/ui/Drawer'
import { ToggleSwitch } from '@/components/ui/ToggleSwitch'
import { useFormValidation, type FieldErrors } from '@/hooks/useFormValidation'

const inputClasses =
  'w-full rounded-lg border border-cocoa/20 px-3 py-2 text-sm font-normal outline-none focus:border-flame'

export function MenuCategoriesDrawer({
  isOpen,
  sectionLabel,
  siteSectionId,
  categories,
  onClose,
  onChanged,
}: {
  isOpen: boolean
  sectionLabel: string
  siteSectionId: string | null
  categories: Category[]
  onClose: () => void
  onChanged: () => Promise<void>
}) {
  const { session } = useAuth()
  const token = session!.token
  const [editingId, setEditingId] = useState<string | 'new' | null>(null)
  const [name, setName] = useState('')
  const [isOrdering, setIsOrdering] = useState(false)
  const [pendingDelete, setPendingDelete] = useState<Category | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  type CategoryField = 'name'
  const validate = (): FieldErrors<CategoryField> => {
    const errors: FieldErrors<CategoryField> = {}
    if (!name.trim()) errors.name = 'Enter a category name.'
    else if (name.trim().length > 100) errors.name = 'Keep the name under 100 characters.'
    return errors
  }
  const validation = useFormValidation<CategoryField>('menu-category', validate)

  const startEdit = (category: Category | 'new') => {
    setError(null)
    validation.reset()
    if (category === 'new') {
      setEditingId('new')
      setName('')
      return
    }
    setEditingId(category.id)
    setName(category.name)
  }

  const save = async () => {
    if (!siteSectionId || !validation.submit()) return
    setIsSaving(true)
    setError(null)
    try {
      const input = {
        siteSectionId,
        name: name.trim(),
      }
      if (editingId && editingId !== 'new') await updateCategory(token, editingId, input)
      else await createCategory(token, input)
      setEditingId(null)
      await onChanged()
    } catch (caught) {
      if (!validation.server(caught, (path) => path === 'name' ? 'name' : undefined)) {
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

  const reorder = async (categoryIds: string[]) => {
    if (!siteSectionId) return false
    setError(null)
    try {
      await reorderCategories(token, siteSectionId, categoryIds)
      await onChanged()
      return true
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not save the category order.')
      return false
    }
  }

  const closeDrawer = () => {
    setIsOrdering(false)
    setEditingId(null)
    onClose()
  }

  return (
    <Drawer isOpen={isOpen} onClose={closeDrawer} title={`${sectionLabel} categories`}>
      <div className="flex flex-col gap-4">
        {error ? <p className="rounded-lg bg-flame/10 px-3 py-2 text-sm font-semibold text-flame">{error}</p> : null}
        {!editingId && categories.length > 1 ? (
          <div className="flex justify-end">
            <button
              type="button"
              className="text-sm font-semibold text-flame"
              onClick={() => setIsOrdering((current) => !current)}
            >
              {isOrdering ? 'Done' : 'Edit order'}
            </button>
          </div>
        ) : null}
        {isOrdering ? (
          <CategoryOrderList categories={categories} onReorder={reorder} />
        ) : categories.length ? (
          <div className="divide-y divide-cocoa/10 rounded-xl border border-cocoa/10 bg-white">
            {categories.map((category) => (
              <div key={category.id} className="flex items-center justify-between gap-3 p-3">
                <p className="font-semibold">{category.name}</p>
                <div className="flex items-center gap-3">
                  <ToggleSwitch checked={category.isActive} onChange={(next) => void toggle(category, next)} />
                  <button className="text-xs font-semibold text-flame" onClick={() => startEdit(category)}>Edit</button>
                  <button className="text-xs font-semibold text-cocoa/60" onClick={() => setPendingDelete(category)}>Delete</button>
                </div>
              </div>
            ))}
          </div>
        ) : <p className="text-sm text-cocoa/60">No {sectionLabel} categories yet.</p>}

        {editingId ? (
          <div className="flex flex-col gap-3 rounded-xl border border-cocoa/10 bg-white p-4">
            <label className="flex flex-col gap-1 text-sm font-semibold">
              Name
              <input {...validation.props('name')} value={name} onChange={(event) => { setName(event.target.value); validation.changed('name') }} className={`${inputClasses} ${validation.error('name') ? 'border-flame bg-flame/5' : ''}`} />
              {validation.error('name') ? <span id="menu-category-name-error" className="text-xs text-flame">{validation.error('name')}</span> : null}
            </label>
            <div className="flex gap-2">
              <Button disabled={!siteSectionId || isSaving} onClick={() => void save()}>
                {isSaving ? 'Saving…' : 'Save category'}
              </Button>
              <button className="text-sm font-semibold text-cocoa/60" onClick={() => setEditingId(null)}>Cancel</button>
            </div>
          </div>
        ) : isOrdering ? null : (
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
