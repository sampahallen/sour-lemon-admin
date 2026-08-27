import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router'
import { PageHeader } from '@/components/ui/PageHeader'
import { DataTable } from '@/components/ui/DataTable'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { cn } from '@/utils/cn'
import { useAuth } from '@/auth/authContext'
import { listOrders, listOrdersGroupedByDeliveryArea, type OrderGroup, type OrderSummary } from '@/api/orders'
import { ORDER_STATUSES, type OrderStatus } from '@/api/types'
import { orderStatusTone } from './orderStatus'

const orderColumns = [
  { header: 'Order #', render: (order: OrderSummary) => order.orderNumber },
  { header: 'Customer', render: (order: OrderSummary) => order.customerName },
  { header: 'Fulfillment', render: (order: OrderSummary) => order.fulfillmentType.replace(/_/g, ' ') },
  {
    header: 'Status',
    render: (order: OrderSummary) => <StatusBadge label={order.status} tone={orderStatusTone(order.status)} />,
  },
  { header: 'Total', render: (order: OrderSummary) => `${order.currency} ${order.total}` },
]

export function OrdersPage() {
  const { session } = useAuth()
  const token = session!.token
  const navigate = useNavigate()

  const [view, setView] = useState<'all' | 'byArea'>('all')
  const [statusFilter, setStatusFilter] = useState<OrderStatus | null>(null)
  const [orders, setOrders] = useState<OrderSummary[]>([])
  const [groups, setGroups] = useState<OrderGroup[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const changeView = (next: 'all' | 'byArea') => {
    setIsLoading(true)
    setView(next)
  }

  const changeStatusFilter = (next: OrderStatus | null) => {
    setIsLoading(true)
    setStatusFilter(next)
  }

  useEffect(() => {
    const load = async () => {
      if (view === 'all') {
        const { orders } = await listOrders(token, { status: statusFilter ?? undefined })
        setOrders(orders)
      } else {
        const { groups } = await listOrdersGroupedByDeliveryArea(token, statusFilter ?? undefined)
        setGroups(groups)
      }
    }
    load().finally(() => setIsLoading(false))
  }, [view, statusFilter, token])

  const goToOrder = (order: OrderSummary) => navigate(`/orders/${order.id}`)

  return (
    <div>
      <PageHeader title="Orders" />

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-2 rounded-full bg-cocoa/10 p-1 text-sm font-semibold">
          <button
            className={cn('rounded-full px-4 py-1.5', view === 'all' ? 'bg-white shadow' : 'text-cocoa/60')}
            onClick={() => changeView('all')}
          >
            All
          </button>
          <button
            className={cn('rounded-full px-4 py-1.5', view === 'byArea' ? 'bg-white shadow' : 'text-cocoa/60')}
            onClick={() => changeView('byArea')}
          >
            By delivery area
          </button>
        </div>

        <div className="flex flex-wrap gap-2 text-sm">
          <button
            className={cn(
              'rounded-full px-3 py-1 font-semibold',
              statusFilter === null ? 'bg-flame text-cream' : 'bg-cocoa/10 text-cocoa/70',
            )}
            onClick={() => changeStatusFilter(null)}
          >
            All statuses
          </button>
          {ORDER_STATUSES.map((status) => (
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
      </div>

      {isLoading ? (
        <p className="text-cocoa/60">Loading…</p>
      ) : view === 'all' ? (
        <DataTable
          columns={orderColumns}
          rows={orders}
          rowKey={(order) => order.id}
          onRowClick={goToOrder}
          emptyState="No orders match this filter."
        />
      ) : (
        <div className="flex flex-col gap-6">
          {groups
            .filter((group) => group.orders.length > 0)
            .map((group) => (
              <div key={group.deliveryArea?.id ?? 'unassigned'}>
                <h2 className="mb-2 font-display text-lg font-bold">
                  {group.deliveryArea?.name ?? 'Pickup / no delivery area'}
                  <span className="ml-2 text-sm font-normal text-cocoa/50">({group.orders.length})</span>
                </h2>
                <DataTable
                  columns={orderColumns}
                  rows={group.orders}
                  rowKey={(order) => order.id}
                  onRowClick={goToOrder}
                />
              </div>
            ))}
          {groups.every((group) => group.orders.length === 0) ? (
            <p className="text-cocoa/60">No orders match this filter.</p>
          ) : null}
        </div>
      )}
    </div>
  )
}
