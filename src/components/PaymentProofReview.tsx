import { useEffect, useState } from 'react'
import { useAuth } from '@/auth/authContext'
import type { PaymentProofSummary } from '@/api/orders'
import { loadPaymentProofImage, reviewPaymentProof } from '@/api/manualPayments'
import { useImagePreview } from '@/components/ui/imagePreviewContext'

function PaymentProofImage({ id }: { id: string }) {
  const { openImagePreview } = useImagePreview()
  const [url, setUrl] = useState<string | null>(null)
  const [error, setError] = useState(false)

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

  if (error) return <p className="mt-2 text-xs text-flame">Could not load screenshot.</p>
  if (!url) return <p className="mt-2 text-xs text-cocoa/55">Loading screenshot...</p>

  return <button
    type="button"
    onClick={() => openImagePreview({ src: url, alt: 'Receipt screenshot' })}
    aria-label="Open receipt screenshot"
    className="mt-3 block overflow-hidden rounded-lg border border-cocoa/15 bg-butter/30 p-1 transition hover:border-olive focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-olive"
  >
    <img src={url} alt="Receipt screenshot preview" className="h-28 w-28 object-contain sm:h-32 sm:w-32 lg:h-20 lg:w-20" />
  </button>
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
