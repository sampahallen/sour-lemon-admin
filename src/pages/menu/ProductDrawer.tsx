import { useEffect, useRef, useState } from 'react'
import { useAuth } from '@/auth/authContext'
import type { Category } from '@/api/categories'
import {
  createProduct,
  deleteProductImage,
  getProduct,
  reorderProductImages,
  updateProduct,
  uploadProductImage,
  type ProductDetail,
} from '@/api/products'
import { Button } from '@/components/ui/Button'
import { Drawer } from '@/components/ui/Drawer'

const inputClasses =
  'w-full rounded-lg border border-cocoa/20 px-3 py-2 font-normal outline-none focus:border-flame'

type ProductField = 'categoryId' | 'name' | 'slug' | 'price' | 'availableFrom' | 'availableUntil'
type ProductFieldErrors = Partial<Record<ProductField, string>>

interface PendingPhoto {
  id: string
  file: File
  previewUrl: string
}

const toLocalDateTime = (value: string | null) => {
  if (!value) return ''
  const date = new Date(value)
  const offset = date.getTimezoneOffset() * 60_000
  return new Date(date.getTime() - offset).toISOString().slice(0, 16)
}

export function ProductDrawer({
  productId,
  categories,
  defaultCategoryId,
  onClose,
  onSaved,
}: {
  productId: string | 'new' | null
  categories: Category[]
  defaultCategoryId: string | null
  onClose: () => void
  onSaved: () => Promise<void> | void
}) {
  const { session } = useAuth()
  const token = session!.token
  const isOpen = productId !== null

  const [product, setProduct] = useState<ProductDetail | null>(null)
  const [categoryId, setCategoryId] = useState(defaultCategoryId ?? categories[0]?.id ?? '')
  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')
  const [description, setDescription] = useState('')
  const [price, setPrice] = useState('')
  const [isActive, setIsActive] = useState(true)
  const [availableFrom, setAvailableFrom] = useState('')
  const [availableUntil, setAvailableUntil] = useState('')
  const [pendingPhotos, setPendingPhotos] = useState<PendingPhoto[]>([])
  const pendingPhotosRef = useRef<PendingPhoto[]>([])
  const photoInputRef = useRef<HTMLInputElement>(null)
  const [isLoading, setIsLoading] = useState(productId !== null && productId !== 'new')
  const [isSaving, setIsSaving] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<ProductFieldErrors>({})

  const fieldInputClasses = (field: ProductField) => fieldErrors[field]
    ? 'w-full rounded-lg border border-flame bg-flame/5 px-3 py-2 font-normal outline-none focus:border-flame'
    : inputClasses

  const clearFieldError = (field: ProductField) => {
    setFieldErrors((current) => {
      if (!current[field]) return current
      const next = { ...current }
      delete next[field]
      return next
    })
  }

  const replacePendingPhotos = (next: PendingPhoto[]) => {
    pendingPhotosRef.current = next
    setPendingPhotos(next)
  }

  const applyProduct = (next: ProductDetail) => {
    setProduct(next)
    setCategoryId(next.categoryId)
    setName(next.name)
    setSlug(next.slug)
    setDescription(next.description ?? '')
    setPrice(next.price)
    setIsActive(next.isActive)
    setAvailableFrom(toLocalDateTime(next.availableFrom))
    setAvailableUntil(toLocalDateTime(next.availableUntil))
    setFieldErrors({})
  }

  useEffect(() => {
    let active = true
    if (productId && productId !== 'new') {
      void getProduct(token, productId)
        .then(({ product }) => {
          if (active) applyProduct(product)
        })
        .catch((caught: unknown) => {
          if (active) setError(caught instanceof Error ? caught.message : 'Could not load this product.')
        })
        .finally(() => {
          if (active) setIsLoading(false)
        })
    }
    return () => {
      active = false
    }
  }, [productId, token])

  useEffect(() => () => {
    pendingPhotosRef.current.forEach((photo) => URL.revokeObjectURL(photo.previewUrl))
  }, [])

  const refreshProduct = async (id = product?.id) => {
    if (!id) return
    const { product: refreshed } = await getProduct(token, id)
    applyProduct(refreshed)
    await onSaved()
  }

  const handleSubmit = async () => {
    const parsedPrice = Number(price)
    const nextFieldErrors: ProductFieldErrors = {}
    if (!categoryId) nextFieldErrors.categoryId = 'Choose a category.'
    if (!name.trim()) nextFieldErrors.name = 'Enter a product name.'
    if (product && slug.trim() && !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug.trim())) {
      nextFieldErrors.slug = 'Use lowercase letters, numbers, and single hyphens only.'
    }
    if (!price.trim()) {
      nextFieldErrors.price = 'Enter a price.'
    } else if (!Number.isFinite(parsedPrice) || parsedPrice < 0 || parsedPrice > 999_999_999.99) {
      nextFieldErrors.price = 'Enter a valid non-negative price.'
    }
    const fromDate = availableFrom ? new Date(availableFrom) : null
    const untilDate = availableUntil ? new Date(availableUntil) : null
    if (fromDate && Number.isNaN(fromDate.getTime())) {
      nextFieldErrors.availableFrom = 'Enter a valid start date and time.'
    }
    if (untilDate && Number.isNaN(untilDate.getTime())) {
      nextFieldErrors.availableUntil = 'Enter a valid end date and time.'
    } else if (fromDate && untilDate && untilDate <= fromDate) {
      nextFieldErrors.availableUntil = 'Must be later than the available-from date.'
    }
    setFieldErrors(nextFieldErrors)
    if (Object.keys(nextFieldErrors).length > 0) {
      setError('Check the highlighted fields and try again.')
      return
    }

    setIsSaving(true)
    setError(null)
    setNotice(null)
    try {
      const input = {
        categoryId,
        name: name.trim(),
        ...(product && slug.trim() ? { slug: slug.trim() } : {}),
        description: description.trim() || null,
        price: parsedPrice.toFixed(2),
        isActive,
        availableFrom: availableFrom ? new Date(availableFrom).toISOString() : null,
        availableUntil: availableUntil ? new Date(availableUntil).toISOString() : null,
      }
      if (product) {
        const { product: updated } = await updateProduct(token, product.id, input)
        applyProduct(updated)
        setNotice('Product saved.')
      } else {
        const { product: created } = await createProduct(token, input)
        applyProduct(created)
        let photoUploadFailed = false
        try {
          for (const [index, photo] of pendingPhotos.entries()) {
            await uploadProductImage(
              token,
              created.id,
              photo.file,
              `${created.name} photo ${index + 1}`,
            )
          }
        } catch {
          photoUploadFailed = true
        } finally {
          pendingPhotosRef.current.forEach((photo) => URL.revokeObjectURL(photo.previewUrl))
          replacePendingPhotos([])
        }
        const { product: withPhotos } = await getProduct(token, created.id)
        applyProduct(withPhotos)
        if (photoUploadFailed) {
          setError('Product created, but one or more photos could not be uploaded.')
        } else {
          setNotice('Product created.')
        }
      }
      await onSaved()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not save this product.')
    } finally {
      setIsSaving(false)
    }
  }

  const handleSelectedPhotos = async (files: File[]) => {
    if (files.length === 0) return
    const existingCount = product?.images.length ?? 0
    const availableSlots = Math.max(0, 20 - existingCount - pendingPhotos.length)
    const selected = files.slice(0, availableSlots)
    if (selected.length === 0) {
      setError('A product can have up to 20 photos.')
      return
    }

    setError(null)
    if (!product) {
      replacePendingPhotos([
        ...pendingPhotos,
        ...selected.map((file) => ({
          id: crypto.randomUUID(),
          file,
          previewUrl: URL.createObjectURL(file),
        })),
      ])
      return
    }

    setIsUploading(true)
    try {
      for (const [index, file] of selected.entries()) {
        await uploadProductImage(
          token,
          product.id,
          file,
          `${product.name} photo ${product.images.length + index + 1}`,
        )
      }
      await refreshProduct()
    } catch (caught) {
      await refreshProduct()
      setError(caught instanceof Error ? caught.message : 'Could not upload this photo.')
    } finally {
      setIsUploading(false)
    }
  }

  const removePendingPhoto = (photoId: string) => {
    const removed = pendingPhotos.find((photo) => photo.id === photoId)
    if (removed) URL.revokeObjectURL(removed.previewUrl)
    replacePendingPhotos(pendingPhotos.filter((photo) => photo.id !== photoId))
  }

  const handleDeleteImage = async (imageId: string) => {
    if (!product) return
    setError(null)
    try {
      await deleteProductImage(token, product.id, imageId)
      await refreshProduct()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not remove this photo.')
    }
  }

  const moveImage = async (index: number, direction: -1 | 1) => {
    if (!product) return
    const nextIndex = index + direction
    if (nextIndex < 0 || nextIndex >= product.images.length) return
    const reordered = [...product.images]
    const current = reordered[index]
    reordered[index] = reordered[nextIndex]
    reordered[nextIndex] = current
    setError(null)
    try {
      await reorderProductImages(token, product.id, reordered.map((image) => image.id))
      await refreshProduct()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not reorder these photos.')
    }
  }

  return (
    <Drawer isOpen={isOpen} onClose={onClose} title={product ? 'Edit product' : 'Add product'}>
      {isLoading ? <p className="text-cocoa/60">Loading product…</p> : (
        <div className="flex flex-col gap-4">
          {error ? <p className="rounded-lg bg-flame/10 px-3 py-2 text-sm font-semibold text-flame">{error}</p> : null}
          {notice ? <p className="rounded-lg bg-olive/10 px-3 py-2 text-sm font-semibold text-olive">{notice}</p> : null}

          <div className="flex flex-col gap-2">
            <div>
              <h3 className="text-sm font-bold">Photos</h3>
              <p className="text-xs text-cocoa/50">The first photo is shown as the product cover.</p>
            </div>
            <input
              ref={photoInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              multiple
              className="hidden"
              onChange={(event) => {
                void handleSelectedPhotos(Array.from(event.target.files ?? []))
                event.target.value = ''
              }}
            />
            <div className="flex flex-wrap items-start gap-3">
              {product?.images.map((image, index) => (
                <div key={image.id} className="group relative h-20 w-20 overflow-hidden rounded-2xl border-2 border-cocoa/10 bg-cream">
                  <img src={image.url} alt={image.altText ?? ''} className="h-full w-full object-cover" />
                  <button
                    type="button"
                    aria-label={`Remove ${image.altText ?? 'photo'}`}
                    className="absolute right-1 top-1 grid h-6 w-6 place-items-center rounded-full bg-cocoa/80 text-sm font-bold text-white"
                    onClick={() => void handleDeleteImage(image.id)}
                  >
                    &times;
                  </button>
                  {product.images.length > 1 ? (
                    <div className="absolute inset-x-1 bottom-1 flex justify-center gap-1">
                      <button
                        type="button"
                        aria-label="Move photo left"
                        disabled={index === 0}
                        className="grid h-6 w-6 place-items-center rounded-full bg-white/90 text-xs font-bold text-cocoa disabled:opacity-35"
                        onClick={() => void moveImage(index, -1)}
                      >
                        &larr;
                      </button>
                      <button
                        type="button"
                        aria-label="Move photo right"
                        disabled={index === product.images.length - 1}
                        className="grid h-6 w-6 place-items-center rounded-full bg-white/90 text-xs font-bold text-cocoa disabled:opacity-35"
                        onClick={() => void moveImage(index, 1)}
                      >
                        &rarr;
                      </button>
                    </div>
                  ) : null}
                </div>
              ))}
              {pendingPhotos.map((photo) => (
                <div key={photo.id} className="relative h-20 w-20 overflow-hidden rounded-2xl border-2 border-flame bg-cream">
                  <img src={photo.previewUrl} alt="Selected product preview" className="h-full w-full object-cover" />
                  <button
                    type="button"
                    aria-label="Remove selected photo"
                    className="absolute right-1 top-1 grid h-6 w-6 place-items-center rounded-full bg-cocoa/80 text-sm font-bold text-white"
                    onClick={() => removePendingPhoto(photo.id)}
                  >
                    &times;
                  </button>
                </div>
              ))}
              <button
                type="button"
                aria-label="Add product photos"
                disabled={isUploading || (product?.images.length ?? 0) + pendingPhotos.length >= 20}
                onClick={() => photoInputRef.current?.click()}
                className="grid h-20 w-20 shrink-0 place-items-center rounded-2xl bg-cocoa/5 text-3xl font-light text-cocoa transition hover:bg-cocoa/10 hover:text-flame disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isUploading ? <span className="text-xs font-semibold">Uploading...</span> : '+'}
              </button>
            </div>
          </div>

          <label className="flex flex-col gap-1 text-sm font-semibold">
            Category
            <select
              value={categoryId}
              aria-invalid={Boolean(fieldErrors.categoryId)}
              aria-describedby={fieldErrors.categoryId ? 'product-category-error' : undefined}
              onChange={(event) => {
                setCategoryId(event.target.value)
                clearFieldError('categoryId')
              }}
              className={fieldInputClasses('categoryId')}
            >
              {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
            </select>
            {fieldErrors.categoryId ? <span id="product-category-error" className="text-xs font-medium text-flame">{fieldErrors.categoryId}</span> : null}
          </label>
          <label className="flex flex-col gap-1 text-sm font-semibold">
            Name
            <input
              value={name}
              maxLength={160}
              aria-invalid={Boolean(fieldErrors.name)}
              aria-describedby={fieldErrors.name ? 'product-name-error' : undefined}
              onChange={(event) => {
                setName(event.target.value)
                clearFieldError('name')
              }}
              className={fieldInputClasses('name')}
            />
            {fieldErrors.name ? <span id="product-name-error" className="text-xs font-medium text-flame">{fieldErrors.name}</span> : null}
          </label>
          {product ? (
            <label className="flex flex-col gap-1 text-sm font-semibold">
              Slug
              <input
                value={slug}
                maxLength={180}
                aria-invalid={Boolean(fieldErrors.slug)}
                aria-describedby={fieldErrors.slug ? 'product-slug-error' : undefined}
                onChange={(event) => {
                  setSlug(event.target.value)
                  clearFieldError('slug')
                }}
                className={fieldInputClasses('slug')}
              />
              {fieldErrors.slug ? <span id="product-slug-error" className="text-xs font-medium text-flame">{fieldErrors.slug}</span> : null}
            </label>
          ) : null}
          <label className="flex flex-col gap-1 text-sm font-semibold">
            Description
            <textarea value={description} maxLength={5000} onChange={(event) => setDescription(event.target.value)} rows={3} className={inputClasses} />
          </label>
          <label className="flex flex-col gap-1 text-sm font-semibold">
            Price (GHS)
            <input
              type="text"
              inputMode="decimal"
              value={price}
              aria-invalid={Boolean(fieldErrors.price)}
              aria-describedby={fieldErrors.price ? 'product-price-error' : undefined}
              onChange={(event) => {
                setPrice(event.target.value)
                clearFieldError('price')
              }}
              className={fieldInputClasses('price')}
              placeholder="45.00"
            />
            {fieldErrors.price ? <span id="product-price-error" className="text-xs font-medium text-flame">{fieldErrors.price}</span> : null}
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="flex flex-col gap-1 text-sm font-semibold">
              Available from
              <input
                type="datetime-local"
                value={availableFrom}
                aria-invalid={Boolean(fieldErrors.availableFrom)}
                aria-describedby={fieldErrors.availableFrom ? 'product-available-from-error' : undefined}
                onChange={(event) => {
                  setAvailableFrom(event.target.value)
                  clearFieldError('availableFrom')
                  clearFieldError('availableUntil')
                }}
                className={fieldInputClasses('availableFrom')}
              />
              {fieldErrors.availableFrom ? <span id="product-available-from-error" className="text-xs font-medium text-flame">{fieldErrors.availableFrom}</span> : null}
            </label>
            <label className="flex flex-col gap-1 text-sm font-semibold">
              Available until
              <input
                type="datetime-local"
                value={availableUntil}
                aria-invalid={Boolean(fieldErrors.availableUntil)}
                aria-describedby={fieldErrors.availableUntil ? 'product-available-until-error' : undefined}
                onChange={(event) => {
                  setAvailableUntil(event.target.value)
                  clearFieldError('availableUntil')
                }}
                className={fieldInputClasses('availableUntil')}
              />
              {fieldErrors.availableUntil ? <span id="product-available-until-error" className="text-xs font-medium text-flame">{fieldErrors.availableUntil}</span> : null}
            </label>
          </div>
          <label className="flex items-center gap-2 text-sm font-semibold">
            <input type="checkbox" checked={isActive} onChange={(event) => setIsActive(event.target.checked)} />
            Show to customers
          </label>

          <Button disabled={isSaving || isUploading} onClick={() => void handleSubmit()}>
            {isSaving ? 'Saving…' : product ? 'Save changes' : 'Create product'}
          </Button>

        </div>
      )}
    </Drawer>
  )
}
