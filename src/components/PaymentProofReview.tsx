import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useAuth } from '@/auth/authContext'
import type { PaymentProofSummary } from '@/api/orders'
import { loadPaymentProofImage, reviewPaymentProof } from '@/api/manualPayments'

function PaymentProofImage({ id }: { id: string }) {
  const [url, setUrl] = useState<string | null>(null)
  const [error, setError] = useState(false)
  const [isOpen, setIsOpen] = useState(false)
  const closeButtonRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    let active = true
    let objectUrl: string | null = null

    void loadPaymentProofImage(id)
      .then((loadedUrl) => {
        if (!active) {
          URL.revokeObjectURL(loadedUrl)
          return
        }
        objectUrl = loadedUrl
        setUrl(loadedUrl)
      })
      .catch(() => {
        if (active) setError(true)
      })

    return () => {
      active = false
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [id])

  useEffect(() => {
    if (!isOpen) return

    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null
    closeButtonRef.current?.focus()
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsOpen(false)
      if (event.key === 'Tab') {
        event.preventDefault()
        closeButtonRef.current?.focus()
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      previousFocus?.focus()
    }
  }, [isOpen])

  if (error) return <p className="mt-2 text-xs text-flame">Could not load screenshot.</p>
  if (!url) return <p className="mt-2 text-xs text-cocoa/55">Loading screenshot…</p>

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        aria-label="Open receipt screenshot"
        className="mt-3 block overflow-hidden rounded-lg border border-cocoa/15 bg-butter/30 p-1 transition hover:border-olive focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-olive"
      >
        <img src={url} alt="Receipt screenshot preview" className="h-28 w-28 object-contain sm:h-32 sm:w-32 lg:h-20 lg:w-20" />
      </button>
      {isOpen ? createPortal(
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Receipt screenshot"
          className="fixed inset-0 z-[100] flex items-center justify-center bg-cocoa/55 p-3 backdrop-blur-sm sm:p-6"
          onClick={(event) => {
            if (event.target === event.currentTarget) setIsOpen(false)
          }}
        >
          <div className="relative inline-block max-w-full">
            <button
              ref={closeButtonRef}
              type="button"
              onClick={() => setIsOpen(false)}
              aria-label="Close screenshot"
              className="absolute right-2 top-2 z-10 flex h-11 w-11 items-center justify-center rounded-full bg-cocoa/85 text-2xl text-white transition hover:bg-cocoa focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-olive"
            >
              ×
            </button>
            <img src={url} alt="Full receipt screenshot" className="block max-h-[calc(100dvh-2rem)] max-w-[calc(100vw-1.5rem)] rounded-xl object-contain shadow-2xl sm:max-h-[calc(100dvh-3rem)] sm:max-w-[calc(100vw-3rem)]" />
          </div>
        </div>,
        document.body,
      ) : null}
    </>
  )
}

export function PaymentProofReview({ proofs, onReviewed }: { proofs: PaymentProofSummary[]; onReviewed: () => Promise<void> | void }) {
  const { session } = useAuth()
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const review = async (id: string, decision: 'confirm' | 'reject') => {
    if (decision === 'reject' && reason.trim().length < 3) { setError('Add a rejection reason.'); return }
    setBusy(id)
    setError(null)
    try {
      await reviewPaymentProof(session!.token, id, decision, reason.trim())
      setReason('')
      await onReviewed()
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'Could not review proof') }
    finally { setBusy(null) }
  }

  return <section className="rounded-2xl border border-cocoa/10 bg-white p-5 shadow-sm">
    <h2 className="font-display text-lg font-bold">Mobile Money proof</h2>
    <p className="mt-1 text-sm text-cocoa/60">Check the actual payment in your Mobile Money account before confirming.</p>
    {error && <p role="alert" className="mt-3 text-sm text-flame">{error}</p>}
    {proofs.length === 0 && <p className="mt-4 text-sm text-cocoa/60">No proof submitted yet.</p>}
    <div className="mt-4 space-y-4">{proofs.map((proof) => <div key={proof.id} className="rounded-xl border border-cocoa/10 p-4 text-sm">
      <p className="font-bold">{proof.status} · {new Date(proof.createdAt).toLocaleString()}</p>
      {proof.reference && <p className="mt-1">Reference: <strong>{proof.reference}</strong></p>}
      {proof.hasImage && <PaymentProofImage id={proof.id} />}
      {proof.rejectionReason && <p className="mt-2 text-flame">Reason: {proof.rejectionReason}</p>}
      {proof.status === 'submitted' && <div className="mt-3 grid gap-2">
        <input className="rounded-lg border border-cocoa/20 px-3 py-2" placeholder="Reason if rejecting" maxLength={1000} value={reason} onChange={(event) => setReason(event.target.value)} />
        <div className="flex gap-2">
          <button disabled={!!busy} className="rounded-full bg-olive px-4 py-2 font-bold text-white disabled:opacity-50" onClick={() => void review(proof.id, 'confirm')}>Confirm payment</button>
          <button disabled={!!busy} className="rounded-full border border-flame px-4 py-2 font-bold text-flame disabled:opacity-50" onClick={() => void review(proof.id, 'reject')}>Reject proof</button>
        </div>
      </div>}
    </div>)}</div>
  </section>
}
