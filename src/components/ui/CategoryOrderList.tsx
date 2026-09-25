import { useState } from 'react'
import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { cn } from '@/utils/cn'

export type OrderableCategory = {
  id: string
  name: string
  isActive: boolean
}

function GripIcon() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true" className="h-5 w-5">
      <path d="M4 5.5h12M4 10h12M4 14.5h12" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />
    </svg>
  )
}

function SortableCategoryRow({ category, disabled }: { category: OrderableCategory; disabled: boolean }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: category.id,
    disabled,
  })
  const style = {
    transform: CSS.Transform.toString(transform ? { ...transform, x: 0 } : null),
    transition,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'flex items-center justify-between gap-3 border-b border-cocoa/10 bg-white p-3 last:border-b-0',
        isDragging && 'relative z-10 rounded-xl border-b-0 shadow-lg ring-2 ring-flame/25',
      )}
    >
      <p className="font-semibold">
        {category.name}
        {category.isActive ? '' : <span className="ml-1 text-xs font-normal text-cocoa/50">(inactive)</span>}
      </p>
      <button
        type="button"
        className="touch-none rounded-lg p-2 text-cocoa/55 outline-none transition hover:bg-cocoa/5 hover:text-cocoa focus-visible:ring-2 focus-visible:ring-flame disabled:cursor-wait disabled:opacity-35"
        aria-label={`Move ${category.name}`}
        disabled={disabled}
        {...attributes}
        {...listeners}
      >
        <GripIcon />
      </button>
    </div>
  )
}

export function CategoryOrderList({
  categories,
  onReorder,
}: {
  categories: OrderableCategory[]
  onReorder: (categoryIds: string[]) => Promise<boolean>
}) {
  const [orderedCategories, setOrderedCategories] = useState(categories)
  const [isSaving, setIsSaving] = useState(false)
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const handleDragEnd = async ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id || isSaving) return
    const oldIndex = orderedCategories.findIndex((category) => category.id === active.id)
    const newIndex = orderedCategories.findIndex((category) => category.id === over.id)
    if (oldIndex < 0 || newIndex < 0) return

    const previous = orderedCategories
    const next = arrayMove(orderedCategories, oldIndex, newIndex)
    setOrderedCategories(next)
    setIsSaving(true)
    const saved = await onReorder(next.map((category) => category.id))
    if (!saved) setOrderedCategories(previous)
    setIsSaving(false)
  }

  return (
    <div className="flex flex-col gap-2">
      <p id="category-order-help" className="text-xs text-cocoa/55">
        Drag a handle to move a category. With a keyboard, focus a handle and use Space, the arrow keys, then Space again.
      </p>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={(event) => void handleDragEnd(event)}>
        <SortableContext items={orderedCategories.map((category) => category.id)} strategy={verticalListSortingStrategy}>
          <div className="overflow-hidden rounded-xl border border-cocoa/10 bg-white" aria-describedby="category-order-help">
            {orderedCategories.map((category) => (
              <SortableCategoryRow key={category.id} category={category} disabled={isSaving} />
            ))}
          </div>
        </SortableContext>
      </DndContext>
      {isSaving ? <p className="text-xs font-semibold text-cocoa/50">Saving order…</p> : null}
    </div>
  )
}
