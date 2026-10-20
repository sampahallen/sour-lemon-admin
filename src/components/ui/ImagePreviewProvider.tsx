import { useEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { ImagePreviewContext, type PreviewImage } from './imagePreviewContext'

export function ImagePreviewProvider({ children }: { children: ReactNode }) {
  const [image, setImage] = useState<PreviewImage | null>(null)
  const closeButtonRef = useRef<HTMLButtonElement>(null)
  const triggerRef = useRef<HTMLElement | null>(null)

  const openImagePreview = (nextImage: PreviewImage) => {
    triggerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
    setImage(nextImage)
  }
  const closeImagePreview = () => setImage(null)

  useEffect(() => {
    if (!image) return
    const previousOverflow = document.body.style.overflow
    const appRoot = document.getElementById('root')
    const wasInert = appRoot?.inert ?? false
    document.body.style.overflow = 'hidden'
    if (appRoot) appRoot.inert = true
    closeButtonRef.current?.focus()
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeImagePreview()
      if (event.key === 'Tab') {
        event.preventDefault()
        closeButtonRef.current?.focus()
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.body.style.overflow = previousOverflow
      if (appRoot) appRoot.inert = wasInert
      document.removeEventListener('keydown', onKeyDown)
      if (triggerRef.current?.isConnected) triggerRef.current.focus()
    }
  }, [image])

  return (
    <ImagePreviewContext.Provider value={{ openImagePreview, closeImagePreview }}>
      {children}
      {image ? createPortal(
        <div
          role="dialog"
          aria-modal="true"
          aria-label={image.alt || 'Image preview'}
          className="fixed inset-0 z-[200] flex items-center justify-center bg-cocoa/65 p-3 backdrop-blur-md sm:p-6"
          onClick={(event) => {
            if (event.target === event.currentTarget) closeImagePreview()
          }}
        >
          <div className="relative max-h-full max-w-full">
            <button
              ref={closeButtonRef}
              type="button"
              onClick={closeImagePreview}
              aria-label="Close image preview"
              className="absolute right-2 top-2 z-10 flex h-11 w-11 items-center justify-center rounded-full bg-cocoa/85 text-2xl text-white transition hover:bg-cocoa focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-flame"
            >
              &times;
            </button>
            <img
              src={image.src}
              alt={image.alt}
              className="block max-h-[calc(100dvh-1.5rem)] max-w-[calc(100vw-1.5rem)] rounded-xl object-contain shadow-2xl sm:max-h-[calc(100dvh-3rem)] sm:max-w-[calc(100vw-3rem)]"
            />
          </div>
        </div>,
        document.body,
      ) : null}
    </ImagePreviewContext.Provider>
  )
}
