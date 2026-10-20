import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router'
import { useAuth } from '@/auth/authContext'
import { listPaymentProofs, type QueuedProof } from '@/api/manualPayments'
import { PageHeader } from '@/components/ui/PageHeader'
import { PaymentProofReview } from '@/components/PaymentProofReview'
import { useOperationsLive } from '@/components/layout/operationsLiveContext'
import type { Pagination } from '@/api/types'

export function PaymentProofQueuePage() {
  const { session } = useAuth()
  const token = session!.token
  const { revisions, status } = useOperationsLive()
  const [page, setPage] = useState(1)
  const [pagination, setPagination] = useState<Pagination | null>(null)
  const [proofs, setProofs] = useState<QueuedProof[]>([])
  const [error, setError] = useState<string | null>(null)
  const requestVersion = useRef(0)
  const load = useCallback(async () => {
    const version = ++requestVersion.current
    try {
      const result = await listPaymentProofs(token, page)
      if (version !== requestVersion.current) return
      setProofs(result.proofs)
      setPagination(result.pagination)
      setError(null)
      if (page > 1 && page > result.pagination.totalPages) setPage(Math.max(1, result.pagination.totalPages))
    } catch (caught) {
      if (version === requestVersion.current) setError(caught instanceof Error ? caught.message : 'Could not load proof queue')
    }
  }, [token, page])
  useEffect(() => {
    // The server revision invalidates the currently displayed proof page.
    // oxlint-disable-next-line react/set-state-in-effect
    void load()
    return () => { requestVersion.current += 1 }
  }, [load, revisions.proofs])
  return <div>
    <PageHeader title="Payment proof review" action={<span className={`text-xs font-semibold ${status === 'connected' ? 'text-olive' : 'text-flame'}`}>{status === 'connected' ? '● Live' : '● Reconnecting'}</span>} />
    {error && <p role="alert" className="mb-4 text-flame">{error}</p>}
    {pagination?.total === 0 && <p className="text-cocoa/60">No payment proof is awaiting review.</p>}
    <div className="grid gap-4">{proofs.map((proof) => <div key={proof.id}>
      <Link className="mb-2 inline-block font-bold text-flame underline" to={proof.orderId ? `/orders/${proof.orderId}` : `/custom-cakes/${proof.customCakeRequestId}`}>
        {proof.orderId ? 'View order' : 'View custom cake'}
      </Link>
      <PaymentProofReview proofs={[proof]} onReviewed={load} />
    </div>)}</div>
    {pagination && pagination.totalPages > 1 ? <div className="mt-5 flex items-center justify-between gap-3 text-sm font-semibold text-cocoa/70">
      <button type="button" disabled={page <= 1} onClick={() => setPage(page - 1)} className="rounded-lg border border-cocoa/20 px-3 py-2 disabled:opacity-40">Previous</button>
      <span>Page {page} of {pagination.totalPages} · {pagination.total} proofs awaiting review</span>
      <button type="button" disabled={page >= pagination.totalPages} onClick={() => setPage(page + 1)} className="rounded-lg border border-cocoa/20 px-3 py-2 disabled:opacity-40">Next</button>
    </div> : null}
  </div>
}
