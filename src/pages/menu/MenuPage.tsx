import { useEffect, useState } from 'react'
import { useAuth } from '@/auth/authContext'
import { listCategories, type Category } from '@/api/categories'
import { deleteProduct, listProducts, updateProduct, type ProductSummary } from '@/api/products'
import { Button } from '@/components/ui/Button'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { PageHeader } from '@/components/ui/PageHeader'
import { ToggleSwitch } from '@/components/ui/ToggleSwitch'
import { cn } from '@/utils/cn'
import { MenuCategoriesDrawer } from './MenuCategoriesDrawer'
import { ProductDrawer } from './ProductDrawer'

const availabilityLabel = (product: ProductSummary) => {
  const now = new Date()
  if (product.availableFrom && new Date(product.availableFrom) > now) {
    return `From ${new Date(product.availableFrom).toLocaleString()}`
  }
  if (product.availableUntil && new Date(product.availableUntil) <= now) return 'Availability ended'
  if (product.availableUntil) return `Until ${new Date(product.availableUntil).toLocaleString()}`
  return 'Always available'
}

export function MenuPage() {
  const { session } = useAuth()
  const token = session!.token
  const [siteSectionId, setSiteSectionId] = useState<string | null>(null)
  const [categories, setCategories] = useState<Category[]>([])
  const [activeCategoryId, setActiveCategoryId] = useState<string | null>(null)
  const [products, setProducts] = useState<ProductSummary[]>([])
  const [isLoadingCategories, setIsLoadingCategories] = useState(true)
  const [isLoadingProducts, setIsLoadingProducts] = useState(false)
  const [editingProductId, setEditingProductId] = useState<string | 'new' | null>(null)
  const [isCategoriesOpen, setIsCategoriesOpen] = useState(false)
  const [pendingDelete, setPendingDelete] = useState<ProductSummary | null>(null)
  const [error, setError] = useState<string | null>(null)

  const loadCategories = async () => {
    setIsLoadingCategories(true)
    setError(null)
    try {
      const { categories, siteSection } = await listCategories(token, { sectionKey: 'cakes' })
      setCategories(categories)
      setSiteSectionId(siteSection?.id ?? categories[0]?.siteSectionId ?? null)
      setActiveCategoryId((current) =>
        current && categories.some((category) => category.id === current)
          ? current
          : categories[0]?.id ?? null,
      )
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not load Bakery categories.')
    } finally {
      setIsLoadingCategories(false)
    }
  }

  const refreshProducts = async (categoryId = activeCategoryId) => {
    if (!categoryId) {
      setProducts([])
      return
    }
    setIsLoadingProducts(true)
    setError(null)
    try {
      const { products } = await listProducts(token, { categoryId, includeInactive: true })
      setProducts(products)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not load products.')
    } finally {
      setIsLoadingProducts(false)
    }
  }

  useEffect(() => {
    void loadCategories()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token])

  useEffect(() => {
    void refreshProducts(activeCategoryId)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeCategoryId, token])

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
        title="Menu"
        action={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => setIsCategoriesOpen(true)}>Manage categories</Button>
            <Button disabled={!activeCategoryId} onClick={() => setEditingProductId('new')}>Add product</Button>
          </div>
        }
      />

      {error ? <p className="mb-4 rounded-lg bg-flame/10 px-3 py-2 text-sm font-semibold text-flame">{error}</p> : null}

      {isLoadingCategories ? (
        <p className="text-cocoa/60">Loading Bakery menu…</p>
      ) : categories.length === 0 ? (
        <div className="rounded-xl border border-cocoa/10 bg-white p-8 text-center text-cocoa/60">
          Add a Bakery category before creating products.
        </div>
      ) : (
        <>
          <div className="mb-4 flex flex-wrap gap-2 rounded-2xl bg-cocoa/10 p-1 text-sm font-semibold">
            {categories.map((category) => (
              <button
                key={category.id}
                className={cn(
                  'rounded-full px-4 py-1.5',
                  activeCategoryId === category.id ? 'bg-white shadow' : 'text-cocoa/60',
                )}
                onClick={() => setActiveCategoryId(category.id)}
              >
                {category.name}{category.isActive ? '' : ' (inactive)'}
              </button>
            ))}
          </div>

          {isLoadingProducts ? (
            <p className="text-cocoa/60">Loading products…</p>
          ) : products.length === 0 ? (
            <div className="rounded-xl border border-cocoa/10 bg-white p-8 text-center text-cocoa/60">
              No products in this category yet.
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {products.map((product) => (
                <div key={product.id} className="overflow-hidden rounded-xl border border-cocoa/10 bg-white">
                  <div className="flex h-40 items-center justify-center bg-cocoa/5">
                    {product.coverImageUrl ? (
                      <img src={product.coverImageUrl} alt={product.name} className="h-full w-full object-cover" />
                    ) : <span className="text-xs text-cocoa/40">No photo</span>}
                  </div>
                  <div className="p-4">
                    <p className="font-semibold">{product.name}</p>
                    <p className="text-sm font-semibold text-flame">{product.currency} {product.price}</p>
                    <p className="mt-1 text-xs text-cocoa/50">{availabilityLabel(product)}</p>
                    <div className="mt-3 flex items-center justify-between">
                      <ToggleSwitch checked={product.isActive} onChange={(next) => void toggleProduct(product, next)} />
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
      <MenuCategoriesDrawer
        isOpen={isCategoriesOpen}
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
