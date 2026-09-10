import { useRef, useState } from 'react'
import { deleteJournalPostImage, uploadJournalPostImage, type JournalPostImage } from '@/api/journal'
import { Button } from '@/components/ui/Button'

function altTextFromFileName(file: File) {
  return file.name.replace(/\.[^./\\]+$/, '').replace(/[-_]+/g, ' ').trim() || 'Cover photo'
}

export function JournalCoverPhoto({
  token,
  postId,
  cover,
  onChanged,
}: {
  token: string
  postId: string
  cover: JournalPostImage | null
  onChanged: () => Promise<void> | void
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [pendingFile, setPendingFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [caption, setCaption] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const pickFile = () => inputRef.current?.click()

  const cancelPending = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl)
    setPendingFile(null)
    setPreviewUrl(null)
    setCaption('')
  }

  const confirmUpload = async () => {
    if (!pendingFile) return
    setIsSaving(true)
    setError(null)
    try {
      await uploadJournalPostImage(token, postId, pendingFile, {
        role: 'cover',
        altText: altTextFromFileName(pendingFile),
        caption: caption.trim() || null,
      })
      cancelPending()
      await onChanged()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not upload this photo.')
    } finally {
      setIsSaving(false)
    }
  }

  const handleRemove = async () => {
    if (!cover) return
    setError(null)
    try {
      await deleteJournalPostImage(token, postId, cover.id)
      await onChanged()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not remove this photo.')
    }
  }

  return (
    <div className="mb-6">
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0]
          if (file) {
            setPendingFile(file)
            setPreviewUrl(URL.createObjectURL(file))
            setCaption('')
            setError(null)
          }
          event.target.value = ''
        }}
      />

      {error ? <p className="mb-2 text-sm font-semibold text-flame">{error}</p> : null}

      {pendingFile ? (
        <div className="rounded-2xl border border-cocoa/10 bg-cream/60 p-4">
          <img src={previewUrl ?? undefined} alt="" className="h-48 w-full rounded-xl object-cover" />
          <input
            value={caption}
            onChange={(event) => setCaption(event.target.value)}
            placeholder="Add a caption (optional)"
            className="mt-3 w-full rounded-lg border border-cocoa/20 bg-white px-3 py-2 text-sm outline-none focus:border-flame"
          />
          <div className="mt-3 flex gap-3">
            <Button size="md" disabled={isSaving} onClick={() => void confirmUpload()}>
              {isSaving ? 'Adding…' : 'Add cover photo'}
            </Button>
            <button type="button" className="text-sm font-semibold text-cocoa/60" onClick={cancelPending}>
              Cancel
            </button>
          </div>
        </div>
      ) : cover ? (
        <div className="group relative overflow-hidden rounded-2xl">
          <img src={cover.url} alt={cover.altText} className="h-56 w-full object-cover" />
          <div className="absolute inset-0 flex items-end justify-end gap-2 bg-gradient-to-t from-cocoa/55 via-transparent to-transparent p-3 opacity-0 transition-opacity group-hover:opacity-100">
            <button
              type="button"
              onClick={pickFile}
              className="rounded-full bg-white/90 px-4 py-1.5 text-xs font-semibold text-cocoa hover:bg-white"
            >
              Replace
            </button>
            <button
              type="button"
              onClick={() => void handleRemove()}
              className="rounded-full bg-white/90 px-4 py-1.5 text-xs font-semibold text-flame hover:bg-white"
            >
              Remove
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={pickFile}
          className="w-full rounded-2xl border-2 border-dashed border-cocoa/20 py-6 text-sm font-semibold text-cocoa/50 hover:border-flame hover:text-flame"
        >
          + Add cover photo
        </button>
      )}
    </div>
  )
}
