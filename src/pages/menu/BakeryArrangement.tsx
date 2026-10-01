import { useCallback, useEffect, useRef, useState } from 'react'
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
import {
  getBakeryArrangement,
  reorderBakeryProducts,
  type BakeryArrangementProduct,
} from '@/api/products'
import { ApiRequestError } from '@/api/client'
import { Button } from '@/components/ui/Button'
import { cn } from '@/utils/cn'

function SortableProductRow({
  product,
  position,
  count,
  visibleCount,
  isLargePreview,
  isTallPreview,
  disabled,
  onMove,
  onFeature,
}: {
  product: BakeryArrangementProduct
  position: number
  count: number
  visibleCount: number
  isLargePreview: boolean
  isTallPreview: boolean
  disabled: boolean
  onMove: (from: number, to: number) => void
  onFeature: (productId: string, slot: 0 | 1) => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: product.id,
    disabled,
  })
  const style = { transform: CSS.Transform.toString(transform ? { ...transform, x: 0 } : null), transition }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'flex flex-wrap items-center gap-3 border-b border-cocoa/10 bg-white p-3 last:border-b-0',
        (isLargePreview || isTallPreview) && 'bg-butter/20',
        isDragging && 'relative z-10 rounded-xl shadow-lg ring-2 ring-flame/25',
      )}
    >
      <span className="w-6 shrink-0 text-center text-xs font-bold text-cocoa/45">{position + 1}</span>
      <div className="h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-butter/40">
        {product.coverImageUrl ? (
          <img src={product.coverImageUrl} alt="" className="h-full w-full object-cover" />
        ) : <span className="grid h-full place-items-center text-[0.6rem] font-semibold text-cocoa/50">No photo</span>}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-bold text-cocoa">{product.name}</p>
        <p className="truncate text-xs text-cocoa/55">{product.category.name}</p>
        <p className={cn('text-xs font-semibold', product.isCurrentlyVisible ? 'text-olive' : 'text-cocoa/50')}>
          {isLargePreview ? 'Huge preview' : isTallPreview ? 'Tall preview' : product.isCurrentlyVisible ? 'Visible now' : 'Hidden from customers now'}
        </p>
      </div>
      <div className="ml-auto flex flex-wrap items-center justify-end gap-1">
        <button type="button" disabled={disabled || isLargePreview || (product.isCurrentlyVisible ? visibleCount < 2 : position === 0)} onClick={() => product.isCurrentlyVisible ? onFeature(product.id, 0) : onMove(position, 0)} className="rounded-lg px-2 py-1 text-xs font-bold text-flame hover:bg-flame/10 disabled:opacity-30" aria-label={product.isCurrentlyVisible ? `Make ${product.name} the huge preview` : `Move ${product.name} to the top`}>
          {product.isCurrentlyVisible ? <><span className="sm:hidden">Huge</span><span className="hidden sm:inline">Make huge</span></> : 'Top'}
        </button>
        {product.isCurrentlyVisible && visibleCount >= 2 ? (
          <button type="button" disabled={disabled || isTallPreview} onClick={() => onFeature(product.id, 1)} className="rounded-lg px-2 py-1 text-xs font-bold text-flame hover:bg-flame/10 disabled:opacity-30" aria-label={`Make ${product.name} the tall preview`}>
            <span className="sm:hidden">Tall</span><span className="hidden sm:inline">Make tall</span>
          </button>
        ) : null}
        <button type="button" disabled={disabled || position === 0} onClick={() => onMove(position, position - 1)} className="rounded-lg px-2 py-1 text-sm font-bold text-cocoa hover:bg-cocoa/5 disabled:opacity-30" aria-label={`Move ${product.name} up`}>↑</button>
        <button type="button" disabled={disabled || position === count - 1} onClick={() => onMove(position, position + 1)} className="rounded-lg px-2 py-1 text-sm font-bold text-cocoa hover:bg-cocoa/5 disabled:opacity-30" aria-label={`Move ${product.name} down`}>↓</button>
        <button
          type="button"
          className="touch-none rounded-lg p-2 text-cocoa/55 outline-none hover:bg-cocoa/5 focus-visible:ring-2 focus-visible:ring-flame disabled:opacity-30"
          aria-label={`Drag ${product.name}`}
          disabled={disabled}
          {...attributes}
          {...listeners}
        >
          <svg viewBox="0 0 20 20" aria-hidden="true" className="h-5 w-5"><path d="M4 5.5h12M4 10h12M4 14.5h12" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" /></svg>
        </button>
      </div>
    </div>
  )
}

export function BakeryArrangement({ token, onClose, onSaved }: {
  token: string
  onClose: () => void
  onSaved: () => Promise<void> | void
}) {
  const [products, setProducts] = useState<BakeryArrangementProduct[]>([])
  const [savedIds, setSavedIds] = useState<string[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const closeButtonRef = useRef<HTMLButtonElement>(null)
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const load = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const { products: arranged } = await getBakeryArrangement(token)
      setProducts(arranged)
      setSavedIds(arranged.map((product) => product.id))
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not load Bakery products.')
    } finally {
      setIsLoading(false)
    }
  }, [token])

  useEffect(() => {
    // oxlint-disable-next-line react/set-state-in-effect
    void load()
    closeButtonRef.current?.focus()
  }, [load])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !isSaving) onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [isSaving, onClose])

  const move = (from: number, to: number) => {
    if (from === to || isSaving) return
    setProducts((current) => arrayMove(current, from, to))
  }
  const feature = (productId: string, slot: 0 | 1) => {
    if (isSaving) return
    setProducts((current) => {
      const visible = current.filter((product) => product.isCurrentlyVisible)
      const from = visible.findIndex((product) => product.id === productId)
      if (from < 0 || slot >= visible.length || from === slot) return current
      const reordered = arrayMove(visible, from, slot)
      let nextVisible = 0
      return current.map((product) => product.isCurrentlyVisible ? reordered[nextVisible++] : product)
    })
  }
  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return
    const from = products.findIndex((product) => product.id === active.id)
    const to = products.findIndex((product) => product.id === over.id)
    if (from >= 0 && to >= 0) move(from, to)
  }
  const currentIds = products.map((product) => product.id)
  const isDirty = currentIds.some((id, index) => id !== savedIds[index])
  const visibleProducts = products.filter((product) => product.isCurrentlyVisible)
  const largePreview = visibleProducts.length > 1 ? visibleProducts[0] : null
  const tallPreview = visibleProducts.length > 1 ? visibleProducts[1] : null

  const save = async () => {
    if (!isDirty || isSaving) return
    setIsSaving(true)
    setError(null)
    try {
      await reorderBakeryProducts(token, currentIds)
      await onSaved()
      onClose()
    } catch (caught) {
      setError(caught instanceof ApiRequestError && caught.status === 409
        ? 'Bakery products changed while you were arranging them. Reload the list and try again.'
        : caught instanceof Error ? caught.message : 'Could not save the Bakery order.')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[60] overflow-y-auto bg-cocoa/55 p-3 sm:p-6" role="dialog" aria-modal="true" aria-labelledby="bakery-arrangement-title">
      <div className="mx-auto max-w-6xl overflow-hidden rounded-3xl bg-cream shadow-2xl">
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-cocoa/10 bg-white px-5 py-4 sm:px-7">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-flame">Bakery display</p>
            <h2 id="bakery-arrangement-title" className="font-display text-2xl font-bold text-cocoa">Arrange Everything</h2>
            <p className="mt-1 text-sm text-cocoa/60">The first visible product gets the huge card, and the second gets the tall card on its right. Other products keep their regular cards.</p>
          </div>
          <button ref={closeButtonRef} type="button" disabled={isSaving} onClick={onClose} className="rounded-full px-3 py-2 text-sm font-semibold text-cocoa/60 hover:bg-cocoa/5 disabled:opacity-40" aria-label="Close arrangement">✕</button>
        </div>

        {error ? (
          <div role="alert" className="mx-5 mt-4 flex flex-wrap items-center justify-between gap-2 rounded-xl bg-flame/10 px-4 py-3 text-sm font-semibold text-flame sm:mx-7">
            <span>{error}</span>
            <button type="button" onClick={() => void load()} className="underline underline-offset-2">Reload products</button>
          </div>
        ) : null}

        {isLoading ? <p className="p-8 text-sm text-cocoa/60">Loading Bakery products…</p> : products.length === 0 ? (
          <p className="p-8 text-sm text-cocoa/60">Add a Bakery product before arranging this page.</p>
        ) : (
          <div className="grid gap-6 p-5 lg:grid-cols-[minmax(0,1.2fr)_minmax(18rem,0.8fr)] lg:p-7">
            <section aria-label="Bakery product order">
              <p id="bakery-order-help" className="mb-3 text-xs leading-relaxed text-cocoa/60">Drag a handle, use its keyboard controls, or press the arrow buttons to reorder. Products hidden from customers stay in this list for when they become available.</p>
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                <SortableContext items={currentIds} strategy={verticalListSortingStrategy}>
                  <div className="overflow-hidden rounded-2xl border border-cocoa/10 bg-white" aria-describedby="bakery-order-help">
                    {products.map((product, position) => (
                      <SortableProductRow key={product.id} product={product} position={position} count={products.length} visibleCount={visibleProducts.length} isLargePreview={product.id === largePreview?.id} isTallPreview={product.id === tallPreview?.id} disabled={isSaving} onMove={move} onFeature={feature} />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
            </section>

            <section aria-label="Storefront preview" className="lg:sticky lg:top-6 lg:self-start">
              <div className="rounded-[2rem] bg-butter/30 p-4 sm:p-5">
                <p className="font-display text-xs font-bold uppercase tracking-[0.16em] text-flame">Live arrangement preview</p>
                {visibleProducts.length === 0 ? (
                  <p className="mt-4 text-sm text-cocoa/60">No products are visible to customers right now.</p>
                ) : (
                  <>
                    <div className="mt-4 grid grid-cols-3 gap-2">
                      {visibleProducts.slice(0, 3).map((product, index) => (
                        <div key={product.id} className={cn('min-w-0 overflow-hidden rounded-xl border border-cocoa/10 bg-cream', index === 0 && (largePreview ? 'col-span-2' : 'col-span-3'))}>
                          <div className={cn('bg-butter/45', index === 0 && largePreview ? 'aspect-[16/9]' : index === 1 && tallPreview ? 'aspect-[3/4]' : 'aspect-[4/3]')}>
                            {product.coverImageUrl ? <img src={product.coverImageUrl} alt="" className="h-full w-full object-cover" /> : <div className="grid h-full place-items-center text-xs text-cocoa/50">No photo</div>}
                          </div>
                          <div className="p-2.5">
                            <p className="text-[0.6rem] font-bold uppercase tracking-wider text-flame">{index === 0 && largePreview ? 'Huge' : index === 1 && tallPreview ? 'Tall' : 'Regular'}</p>
                            <p className="mt-0.5 truncate font-display text-sm font-bold text-cocoa">{product.name}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                    {visibleProducts.length > 3 ? <p className="mt-3 text-xs text-cocoa/55">Then {visibleProducts.length - 3} regular {visibleProducts.length === 4 ? 'card' : 'cards'}.</p> : null}
                  </>
                )}
              </div>
            </section>
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-cocoa/10 bg-white px-5 py-4 sm:px-7">
          <p className="text-xs text-cocoa/55">{isDirty ? 'Changes are not published yet.' : 'No unpublished changes.'}</p>
          <div className="flex gap-3">
            <Button variant="outline" disabled={isSaving} onClick={onClose}>Cancel</Button>
            <Button disabled={!isDirty || isSaving || isLoading} onClick={() => void save()}>{isSaving ? 'Saving…' : 'Save changes'}</Button>
          </div>
        </div>
      </div>
    </div>
  )
}
