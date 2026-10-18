import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { useAuth } from '@/auth/authContext'
import { listPaymentProofs, type QueuedProof } from '@/api/manualPayments'
import { PageHeader } from '@/components/ui/PageHeader'
import { PaymentProofReview } from '@/components/PaymentProofReview'

export function PaymentProofQueuePage() {
  const { session } = useAuth()
  const [proofs, setProofs] = useState<QueuedProof[]>([])
  const [error, setError] = useState<string | null>(null)
  const load = async () => {
    try { setProofs((await listPaymentProofs(session!.token)).proofs); setError(null) }
    catch (caught) { setError(caught instanceof Error ? caught.message : 'Could not load proof queue') }
  }
  useEffect(() => {
    let active = true
    const refresh = () => void listPaymentProofs(session!.token)
      .then(({ proofs: results }) => { if (active) { setProofs(results); setError(null) } })
      .catch((caught: unknown) => { if (active) setError(caught instanceof Error ? caught.message : 'Could not load proof queue') })
    refresh()
    const interval = window.setInterval(refresh, 20_000)
    return () => { active = false; window.clearInterval(interval) }
  }, [session])
  return <div>
    <PageHeader title="Payment proof review" />
    {error && <p role="alert" className="mb-4 text-flame">{error}</p>}
    {proofs.length === 0 && <p className="text-cocoa/60">No payment proof is awaiting review.</p>}
    <div className="grid gap-4">{proofs.map((proof) => <div key={proof.id}>
      <Link className="mb-2 inline-block font-bold text-flame underline" to={proof.orderId ? `/orders/${proof.orderId}` : `/custom-cakes/${proof.customCakeRequestId}`}>
        {proof.orderId ? 'View order' : 'View custom cake'}
      </Link>
      <PaymentProofReview proofs={[proof]} onReviewed={load} />
    </div>)}</div>
  </div>
}
