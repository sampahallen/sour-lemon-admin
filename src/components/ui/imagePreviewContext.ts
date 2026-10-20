import { createContext, useContext } from 'react'

export type PreviewImage = { src: string; alt: string }

export const ImagePreviewContext = createContext<{
  openImagePreview: (image: PreviewImage) => void
  closeImagePreview: () => void
} | null>(null)

export function useImagePreview() {
  const context = useContext(ImagePreviewContext)
  if (!context) throw new Error('Image preview provider is missing')
  return context
}
