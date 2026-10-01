import { useCallback, useEffect, useRef, useState } from 'react'
import { useAuth } from '@/auth/authContext'
import { listCategories, type Category } from '@/api/categories'
import { deleteProduct, listProducts, updateProduct, type ProductSummary } from '@/api/products'
import { Button } from '@/components/ui/Button'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { PageHeader } from '@/components/ui/PageHeader'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { ToggleSwitch } from '@/components/ui/ToggleSwitch'
import { cn } from '@/utils/cn'
import { BakeryArrangement } from './BakeryArrangement'
import { MenuCategoriesDrawer } from './MenuCategoriesDrawer'
import { ProductDrawer } from './ProductDrawer'

type MenuPageProps = {
  sectionKey: 'cakes' | 'shop'
  sectionLabel: 'Bakery' | 'Shop'
}

const availabilityLabel = (product: ProductSummary) => {
  const now = new Date()
  if (product.availableFrom && new Date(product.availableFrom) > now) {
    return `From ${new Date(product.availableFrom).toLocaleString()}`
  }
  if (product.availableUntil && new Date(product.availableUntil) <= now) return 'Availability ended'
  if (product.availableUntil) return `Until ${new Date(product.availableUntil).toLocaleString()}`
  return 'Always available'
}

export function MenuPage({ sectionKey, sectionLabel }: MenuPageProps) {
  const { session } = useAuth()
  const token = session!.token
  const [siteSectionId, setSiteSectionId] = useState<string | null>(null)
  const [categories, setCategories] = useState<Category[]>([])
  const [activeCategoryId, setActiveCategoryId] = useState<string | null>(null)
  const [products, setProducts] = useState<ProductSummary[]>([])
  const [isLoadingCategories, setIsLoadingCategories] = useState(true)
  const [isLoadingProducts, setIsLoadingProducts] = useState(false)
  const [editingProductId, setEditingProductId] = useState<string | 'new' | null>(null)
  const [isArrangementOpen, setIsArrangementOpen] = useState(false)
  const [isCategoriesOpen, setIsCategoriesOpen] = useState(false)
  const [pendingDelete, setPendingDelete] = useState<ProductSummary | null>(null)
  const [error, setError] = useState<string | null>(null)
  const categoryRequestId = useRef(0)
  const productRequestId = useRef(0)

  const loadCategories = useCallback(async () => {
    const requestId = ++categoryRequestId.current
    setIsLoadingCategories(true)
    setError(null)
    try {
      const { categories, siteSection } = await listCategories(token, { sectionKey })
      if (requestId !== categoryRequestId.current) return
      setCategories(categories)
      setSiteSectionId(siteSection?.id ?? categories[0]?.siteSectionId ?? null)
      setActiveCategoryId((current) =>
        current && categories.some((category) => category.id === current)
          ? current
          : categories[0]?.id ?? null,
      )
    } catch (caught) {
      if (requestId !== categoryRequestId.current) return
      setCategories([])
      setSiteSectionId(null)
      setActiveCategoryId(null)
      setError(caught instanceof Error ? caught.message : `Could not load ${sectionLabel} categories.`)
    } finally {
      if (requestId === categoryRequestId.current) setIsLoadingCategories(false)
    }
  }, [sectionKey, sectionLabel, token])

  const refreshProducts = useCallback(async (categoryId = activeCategoryId) => {
    const requestId = ++productRequestId.current
    if (!categoryId) {
      setProducts([])
      setIsLoadingProducts(false)
      return
    }
    setIsLoadingProducts(true)
    setError(null)
    try {
      const { products } = await listProducts(token, { categoryId, includeInactive: true })
      if (requestId !== productRequestId.current) return
      setProducts(products)
    } catch (caught) {
      if (requestId !== productRequestId.current) return
      setProducts([])
      setError(caught instanceof Error ? caught.message : `Could not load ${sectionLabel} products.`)
    } finally {
      if (requestId === productRequestId.current) setIsLoadingProducts(false)
    }
  }, [activeCategoryId, sectionLabel, token])

  useEffect(() => {
    // oxlint-disable-next-line react/set-state-in-effect
    void loadCategories()
  }, [loadCategories])

  useEffect(() => {
    // oxlint-disable-next-line react/set-state-in-effect
    void refreshProducts(activeCategoryId)
  }, [activeCategoryId, refreshProducts])

  const toggleProduct = async (product: ProductSummary, isActive: boolean) => {
    setError(null)
    try {
      await updateProduct(token, product.id, { isActive })
      await refreshProducts()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not update this product.')
    }
  }

  const removeProduct = async () => {
    if (!pendingDelete) return
    setError(null)
    try {
      await deleteProduct(token, pendingDelete.id)
      setPendingDelete(null)
      await refreshProducts()
    } catch (caught) {
      setPendingDelete(null)
      setError(caught instanceof Error ? caught.message : 'Could not delete this product.')
    }
  }

  const categoriesChanged = async () => {
    await loadCategories()
    await refreshProducts()
  }

  return (
    <div>
      <PageHeader
        title={`${sectionLabel} menu`}
        action={
          <div className="flex flex-wrap gap-2">
            {sectionKey === 'cakes' ? <Button variant="outline" onClick={() => setIsArrangementOpen(true)}>Arrange Everything</Button> : null}
            <Button variant="outline" onClick={() => setIsCategoriesOpen(true)}>Manage categories</Button>
            <Button disabled={!activeCategoryId} onClick={() => setEditingProductId('new')}>Add product</Button>
          </div>
        }
      />
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-cocoa/10 bg-white p-5 shadow-sm">
        <div><h2 className="font-display text-lg font-bold">{sectionLabel} catalog</h2><p className="mt-1 text-sm text-cocoa/60">Manage product details, customer visibility, and availability.</p></div>
        <div className="flex gap-3 text-xs font-bold text-cocoa/55"><span>{categories.length} categories</span><span>{products.length} in selected category</span></div>
      </div>

      {error ? <p className="mb-4 rounded-lg bg-flame/10 px-3 py-2 text-sm font-semibold text-flame">{sectionLabel}: {error}</p> : null}

      {isLoadingCategories ? (
        <p className="text-cocoa/60">Loading {sectionLabel} menu…</p>
      ) : categories.length === 0 ? (
        <div className="rounded-xl border border-cocoa/10 bg-white p-8 text-center text-cocoa/60">
          Add a {sectionLabel} category before creating products.
        </div>
      ) : (
        <>
          <div className="mb-5 flex flex-wrap gap-2 border-b border-cocoa/10 pb-3 text-sm font-semibold" aria-label={`${sectionLabel} categories`}>
            {categories.map((category) => (
              <button
                key={category.id}
                className={cn(
                  'rounded-lg px-4 py-2',
                  activeCategoryId === category.id ? 'bg-cocoa text-white shadow-sm' : 'bg-white text-cocoa/60 hover:text-cocoa',
                )}
                onClick={() => setActiveCategoryId(category.id)}
              >
                {category.name}{category.isActive ? '' : ' (inactive)'}
              </button>
            ))}
          </div>

          {isLoadingProducts ? (
            <p className="text-cocoa/60">Loading {sectionLabel} products…</p>
          ) : products.length === 0 ? (
            <div className="rounded-xl border border-cocoa/10 bg-white p-8 text-center text-cocoa/60">
              No {sectionLabel} products in this category yet.
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
              {products.map((product) => (
                <div key={product.id} className="overflow-hidden rounded-2xl border border-cocoa/10 bg-white shadow-sm transition-shadow hover:shadow-md">
                  <div className="flex h-48 items-center justify-center bg-cocoa/5">
                    {product.coverImageUrl ? (
                      <img src={product.coverImageUrl} alt={product.name} className="h-full w-full object-cover" />
                    ) : <span className="text-xs text-cocoa/40">No photo</span>}
                  </div>
                  <div className="p-4">
                    <div className="flex items-start justify-between gap-2"><p className="min-w-0 font-display text-lg font-bold leading-tight">{product.name}</p><StatusBadge label={product.isActive ? 'Visible' : 'Hidden'} tone={product.isActive ? 'positive' : 'neutral'} /></div>
                    <p className="mt-2 text-sm font-bold text-cocoa">{product.currency} {product.price}</p>
                    <p className="mt-1 text-xs text-cocoa/50">{availabilityLabel(product)}</p>
                    <div className="mt-4 flex items-center justify-between border-t border-cocoa/10 pt-3">
                      <ToggleSwitch label="Show" checked={product.isActive} onChange={(next) => void toggleProduct(product, next)} />
                      <div className="flex gap-2 text-xs">
                        <button className="font-semibold text-flame" onClick={() => setEditingProductId(product.id)}>Edit</button>
                        <button className="font-semibold text-cocoa/60" onClick={() => setPendingDelete(product)}>Delete</button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      <ProductDrawer
        key={editingProductId ?? 'closed'}
        productId={editingProductId}
        categories={categories}
        defaultCategoryId={activeCategoryId}
        onClose={() => setEditingProductId(null)}
        onSaved={() => refreshProducts()}
      />
      {isArrangementOpen ? (
        <BakeryArrangement
          token={token}
          onClose={() => setIsArrangementOpen(false)}
          onSaved={() => refreshProducts()}
        />
      ) : null}
      <MenuCategoriesDrawer
        key={sectionKey}
        isOpen={isCategoriesOpen}
        sectionLabel={sectionLabel}
        siteSectionId={siteSectionId}
        categories={categories}
        onClose={() => setIsCategoriesOpen(false)}
        onChanged={categoriesChanged}
      />
      <ConfirmDialog
        isOpen={pendingDelete !== null}
        title="Delete product"
        message={`Delete "${pendingDelete?.name}" and its photos? This cannot be undone.`}
        confirmLabel="Delete"
        onCancel={() => setPendingDelete(null)}
        onConfirm={() => void removeProduct()}
      />
    </div>
  )
}
