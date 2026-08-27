import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router'
import { PageHeader } from '@/components/ui/PageHeader'
import { DataTable } from '@/components/ui/DataTable'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { cn } from '@/utils/cn'
import { useAuth } from '@/auth/authContext'
import { listCustomCakeRequests, type CustomCakeRequestSummary } from '@/api/customCakeRequests'
import { CUSTOM_CAKE_STATUSES, type CustomCakeStatus } from '@/api/types'
import { customCakeStatusTone } from './customCakeStatus'

export function CustomCakeRequestsPage() {
  const { session } = useAuth()
  const token = session!.token
  const navigate = useNavigate()

  const [statusFilter, setStatusFilter] = useState<CustomCakeStatus | null>(null)
  const [requests, setRequests] = useState<CustomCakeRequestSummary[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const changeStatusFilter = (next: CustomCakeStatus | null) => {
    setIsLoading(true)
    setStatusFilter(next)
  }

  useEffect(() => {
    listCustomCakeRequests(token, { status: statusFilter ?? undefined })
      .then(({ requests }) => setRequests(requests))
      .finally(() => setIsLoading(false))
  }, [statusFilter, token])

  return (
    <div>
      <PageHeader title="Custom Cake Requests" />

      <div className="mb-4 flex flex-wrap gap-2 text-sm">
        <button
          className={cn(
            'rounded-full px-3 py-1 font-semibold',
            statusFilter === null ? 'bg-flame text-cream' : 'bg-cocoa/10 text-cocoa/70',
          )}
          onClick={() => changeStatusFilter(null)}
        >
          All
        </button>
        {CUSTOM_CAKE_STATUSES.map((status) => (
          <button
            key={status}
            className={cn(
              'rounded-full px-3 py-1 font-semibold capitalize',
              statusFilter === status ? 'bg-flame text-cream' : 'bg-cocoa/10 text-cocoa/70',
            )}
            onClick={() => changeStatusFilter(status)}
          >
            {status.replace(/_/g, ' ')}
          </button>
        ))}
      </div>

      {isLoading ? (
        <p className="text-cocoa/60">Loading…</p>
      ) : (
        <DataTable
          columns={[
            { header: 'Customer', render: (request: CustomCakeRequestSummary) => request.customerName },
            { header: 'Occasion', render: (request: CustomCakeRequestSummary) => request.occasion },
            { header: 'Size', render: (request: CustomCakeRequestSummary) => request.requestedSize },
            {
              header: 'Status',
              render: (request: CustomCakeRequestSummary) => (
                <StatusBadge label={request.status} tone={customCakeStatusTone(request.status)} />
              ),
            },
            {
              header: 'Quote',
              render: (request: CustomCakeRequestSummary) =>
                request.quotedAmount ? `${request.currency} ${request.quotedAmount}` : '—',
            },
          ]}
          rows={requests}
          rowKey={(request) => request.id}
          onRowClick={(request) => navigate(`/custom-cakes/${request.id}`)}
          emptyState="No custom cake requests match this filter."
        />
      )}
    </div>
  )
}
