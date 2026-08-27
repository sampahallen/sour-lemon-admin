import { Button } from './Button'

export function ConfirmDialog({
  isOpen,
  title,
  message,
  confirmLabel = 'Confirm',
  onConfirm,
  onCancel,
}: {
  isOpen: boolean
  title: string
  message: string
  confirmLabel?: string
  onConfirm: () => void
  onCancel: () => void
}) {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-cocoa/40 px-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-[var(--shadow-chunky)]">
        <h2 className="mb-2 text-lg font-bold">{title}</h2>
        <p className="mb-6 text-sm text-cocoa/70">{message}</p>
        <div className="flex justify-end gap-3">
          <button onClick={onCancel} className="rounded-full px-5 py-2 font-semibold text-cocoa/70 hover:bg-cocoa/5">
            Cancel
          </button>
          <Button onClick={onConfirm}>{confirmLabel}</Button>
        </div>
      </div>
    </div>
  )
}
