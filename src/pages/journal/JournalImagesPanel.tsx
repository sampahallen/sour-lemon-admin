import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { FileDropzone } from '@/components/ui/FileDropzone'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import {
  deleteJournalPostImage,
  reorderJournalPostImages,
  uploadJournalPostImage,
  type JournalPostDetail,
  type JournalPostImage,
} from '@/api/journal'

const inputClasses =
  'w-full rounded-lg border border-cocoa/20 px-3 py-2 text-sm font-normal outline-none focus:border-flame'

function ImageUploadForm({
  isUploading,
  onCancel,
  onUpload,
}: {
  isUploading: boolean
  onCancel?: () => void
  onUpload: (file: File, altText: string, caption: string) => Promise<boolean>
}) {
  const [file, setFile] = useState<File | null>(null)
  const [altText, setAltText] = useState('')
  const [caption, setCaption] = useState('')

  const handleUpload = async () => {
    if (!file || !altText.trim()) return
    const succeeded = await onUpload(file, altText.trim(), caption.trim())
    if (succeeded) {
      setFile(null)
      setAltText('')
      setCaption('')
    }
  }

  if (!file) {
    return <FileDropzone onFileSelected={setFile} disabled={isUploading} />
  }

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-cocoa/10 p-3">
      <p className="text-xs font-semibold text-cocoa/60">{file.name}</p>
      <input
        value={altText}
        onChange={(event) => setAltText(event.target.value)}
        placeholder="Alt text (required)"
        className={inputClasses}
      />
      <input
        value={caption}
        onChange={(event) => setCaption(event.target.value)}
        placeholder="Caption (optional)"
        className={inputClasses}
      />
      <div className="flex gap-2">
        <Button
          size="md"
          disabled={!altText.trim() || isUploading}
          onClick={() => void handleUpload()}
        >
          {isUploading ? 'Uploading…' : 'Upload'}
        </Button>
        <button
          type="button"
          className="text-sm font-semibold text-cocoa/60"
          onClick={() => {
            setFile(null)
            setAltText('')
            setCaption('')
            onCancel?.()
          }}
        >
          Cancel
        </button>
      </div>
    </div>
  )
}

export function JournalImagesPanel({
  token,
  post,
  onChanged,
  onInsertBlock,
}: {
  token: string
  post: JournalPostDetail
  onChanged: () => Promise<void> | void
  onInsertBlock: (image: JournalPostImage) => void
}) {
  const [isReplacingCover, setIsReplacingCover] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [pendingDelete, setPendingDelete] = useState<JournalPostImage | null>(null)
  const [error, setError] = useState<string | null>(null)

  const cover = post.images.find((image) => image.role === 'cover') ?? null
  const bodyImages = post.images
    .filter((image) => image.role === 'body')
    .sort((a, b) => a.sortOrder - b.sortOrder)

  const withErrorHandling = async (action: () => Promise<void>) => {
    setError(null)
    try {
      await action()
      return true
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Something went wrong. Please try again.')
      return false
    }
  }

  const handleUploadCover = (file: File, altText: string, caption: string) =>
    withErrorHandling(async () => {
      setIsUploading(true)
      try {
        await uploadJournalPostImage(token, post.id, file, { role: 'cover', altText, caption: caption || null })
        setIsReplacingCover(false)
        await onChanged()
      } finally {
        setIsUploading(false)
      }
    })

  const handleUploadBodyImage = (file: File, altText: string, caption: string) =>
    withErrorHandling(async () => {
      setIsUploading(true)
      try {
        await uploadJournalPostImage(token, post.id, file, {
          role: 'body',
          altText,
          caption: caption || null,
          sortOrder: bodyImages.length,
        })
        await onChanged()
      } finally {
        setIsUploading(false)
      }
    })

  const handleDelete = (image: JournalPostImage) =>
    withErrorHandling(async () => {
      await deleteJournalPostImage(token, post.id, image.id)
      setPendingDelete(null)
      await onChanged()
    })

  const moveBodyImage = (index: number, direction: -1 | 1) =>
    withErrorHandling(async () => {
      const nextIndex = index + direction
      if (nextIndex < 0 || nextIndex >= bodyImages.length) return
      const reordered = [...bodyImages]
      ;[reordered[index], reordered[nextIndex]] = [reordered[nextIndex], reordered[index]]
      await reorderJournalPostImages(token, post.id, reordered.map((image) => image.id))
      await onChanged()
    })

  return (
    <div className="flex flex-col gap-6">
      {error ? (
        <p className="rounded-lg bg-flame/10 px-3 py-2 text-sm font-semibold text-flame">{error}</p>
      ) : null}

      <div>
        <h3 className="mb-2 text-sm font-bold">Cover photo</h3>
        {cover && !isReplacingCover ? (
          <div className="flex items-start gap-3 rounded-lg border border-cocoa/10 p-3">
            <img src={cover.url} alt={cover.altText} className="h-20 w-20 rounded-lg object-cover" />
            <div className="flex-1 text-sm">
              <p className="font-semibold">{cover.altText}</p>
              {cover.caption ? <p className="text-cocoa/60">{cover.caption}</p> : null}
              <div className="mt-2 flex gap-3 text-xs font-semibold">
                <button className="text-flame" onClick={() => setIsReplacingCover(true)}>
                  Replace
                </button>
                <button className="text-cocoa/60" onClick={() => setPendingDelete(cover)}>
                  Remove
                </button>
              </div>
            </div>
          </div>
        ) : (
          <ImageUploadForm
            isUploading={isUploading}
            onCancel={cover ? () => setIsReplacingCover(false) : undefined}
            onUpload={handleUploadCover}
          />
        )}
      </div>

      <div>
        <h3 className="mb-2 text-sm font-bold">Body photos</h3>
        <div className="flex flex-col gap-3">
          {bodyImages.map((image, index) => (
            <div key={image.id} className="flex items-center gap-3 rounded-lg border border-cocoa/10 p-2">
              <img src={image.url} alt={image.altText} className="h-14 w-14 rounded object-cover" />
              <div className="flex-1 text-xs">
                <p className="font-semibold text-cocoa">{image.altText}</p>
                {image.caption ? <p className="text-cocoa/60">{image.caption}</p> : null}
                <div className="mt-1 flex flex-wrap gap-2 font-semibold text-cocoa/60">
                  <button onClick={() => moveBodyImage(index, -1)} disabled={index === 0}>
                    ↑ Up
                  </button>
                  <button onClick={() => moveBodyImage(index, 1)} disabled={index === bodyImages.length - 1}>
                    ↓ Down
                  </button>
                  <button className="text-flame" onClick={() => onInsertBlock(image)}>
                    Insert into content
                  </button>
                  <button onClick={() => setPendingDelete(image)}>Remove</button>
                </div>
              </div>
            </div>
          ))}
          <ImageUploadForm isUploading={isUploading} onUpload={handleUploadBodyImage} />
        </div>
      </div>

      <ConfirmDialog
        isOpen={pendingDelete !== null}
        title="Remove photo"
        message="Remove this photo? Any content blocks referencing it will no longer show an image."
        confirmLabel="Remove"
        onCancel={() => setPendingDelete(null)}
        onConfirm={() => {
          if (pendingDelete) void handleDelete(pendingDelete)
        }}
      />
    </div>
  )
}
