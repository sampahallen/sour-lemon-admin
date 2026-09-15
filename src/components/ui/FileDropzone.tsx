import { useRef } from 'react'

export function FileDropzone({
  onFileSelected,
  disabled = false,
}: {
  onFileSelected: (file: File) => void
  disabled?: boolean
}) {
  const inputRef = useRef<HTMLInputElement>(null)

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        disabled={disabled}
        onChange={(event) => {
          const file = event.target.files?.[0]
          if (file) onFileSelected(file)
          event.target.value = ''
        }}
      />
      <button
        type="button"
        disabled={disabled}
        onClick={() => inputRef.current?.click()}
        className="w-full rounded-xl border-2 border-dashed border-cocoa/30 py-8 text-center text-sm font-semibold text-cocoa/60 hover:border-flame hover:text-flame disabled:opacity-50"
      >
        {disabled ? 'Uploading…' : 'Click to choose a photo'}
      </button>
    </div>
  )
}
