import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import { PageHeader } from '@/components/ui/PageHeader'
import { DataTable } from '@/components/ui/DataTable'
import { StatusBadge, type StatusTone } from '@/components/ui/StatusBadge'
import { useAuth } from '@/auth/authContext'
import {
  getOrderWorkspace,
  listOrders,
  updateOrderStatus,
  type OrderAction,
  type OrderSummary,
  type OrderWorkspace,
  type PaymentGroup,
  type WorkspaceOrder,
} from '@/api/orders'
import {
  FULFILLMENT_TYPES,
  type FulfillmentType,
  type OrderStatus,
  type Pagination,
} from '@/api/types'
import { useOrderUpdates } from '@/hooks/useOrderUpdates'
import { useFormValidation, type FieldErrors } from '@/hooks/useFormValidation'
import {
  orderStatusLabel,
  orderStatusTone,
  paymentGroupLabel,
  paymentGroupTone,
} from './orderStatus'

const PAGE_SIZE = 25
const HISTORY_STATUSES: OrderStatus[] = ['completed', 'cancelled']
const PAYMENT_GROUPS: PaymentGroup[] = ['pending', 'needs_attention', 'paid', 'refunded']

const formatMoney = (amount: string, currency: string) =>
  new Intl.NumberFormat('en-GH', { style: 'currency', currency }).format(Number(amount))

const fulfillmentActions = ['start_preparing', 'mark_ready', 'dispatch', 'complete'] as const satisfies readonly OrderAction[]
type FulfillmentAction = (typeof fulfillmentActions)[number]
type FulfillmentQueueKey = Exclude<keyof OrderWorkspace['queues'], 'payment'>

const fulfillmentQueueKeys: FulfillmentQueueKey[] = ['received', 'preparing', 'ready', 'delivery']

const actionLabels: Record<FulfillmentAction, string> = {
  start_preparing: 'Start preparing',
  mark_ready: 'Mark ready',
  dispatch: 'Send to delivery',
  complete: 'Complete order',
}

const actionStatuses: Record<FulfillmentAction, OrderStatus> = {
  start_preparing: 'preparing',
  mark_ready: 'ready_for_pickup',
  dispatch: 'out_for_delivery',
  complete: 'completed',
}

const queueMeta: Record<FulfillmentQueueKey, { title: string; subtitle: string; classes: string; urgentAfterMinutes: number }> = {
  received: { title: 'Received', subtitle: 'Ready to begin', classes: 'border-sky-200 bg-sky-50/70', urgentAfterMinutes: 15 },
  preparing: { title: 'Preparing', subtitle: 'Currently being made', classes: 'border-orange-200 bg-orange-50/70', urgentAfterMinutes: 30 },
  ready: { title: 'Ready', subtitle: 'Pickup or rider handoff', classes: 'border-emerald-200 bg-emerald-50/70', urgentAfterMinutes: 15 },
  delivery: { title: 'Delivery', subtitle: 'On the way', classes: 'border-violet-200 bg-violet-50/70', urgentAfterMinutes: 45 },
}

const primaryAction = (order: WorkspaceOrder) =>
  order.availableActions.find((action): action is FulfillmentAction => (
    fulfillmentActions.includes(action as FulfillmentAction)
  ))

const paymentAttentionMessage = (order: WorkspaceOrder) => ({
  waiting_for_payment: 'Waiting for payment · Open order for details',
  needs_review: 'Payment review required · Open order to confirm',
  cash_due: 'Cash collection due · Open order to record payment',
  failed: 'Payment failed · Open order for details',
  confirmed: null,
  cash_collected: null,
  refunded: null,
})[order.paymentDisplayStatus]

const statusDotClasses: Record<StatusTone, string> = {
  neutral: 'bg-cocoa/40',
  positive: 'bg-olive',
  warning: 'bg-amber-400',
  negative: 'bg-flame',
  info: 'bg-sky-500',
  orange: 'bg-orange-500',
  violet: 'bg-violet-600',
}

function StatusDot({ label, tone }: { label: string; tone: StatusTone }) {
  return (
    <span
      aria-label={label}
      title={label}
      className={`inline-block h-2.5 w-2.5 shrink-0 rounded-full ${statusDotClasses[tone]}`}
    />
  )
}

const orderLocation = (order: WorkspaceOrder) => {
  if (order.deliveryAreaName) return order.deliveryAreaName
  if (order.fulfillmentType === 'pickup') return 'Pickup'
  if (order.fulfillmentType === 'customer_rider') return 'Own rider'
  return 'Location pending'
}

const minutesSince = (iso: string) => Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 60_000))

const formatAge = (minutes: number) => {
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes}m ago`
  if (minutes >= 24 * 60) return `${Math.floor(minutes / (24 * 60))}d ago`
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m ago`
}

const matchesQuery = (order: WorkspaceOrder, query: string) => {
  const needle = query.trim().toLowerCase()
  if (!needle) return true
  return (
    order.orderNumber.toLowerCase().includes(needle) ||
    order.customerName.toLowerCase().includes(needle) ||
    order.phoneNumber.toLowerCase().includes(needle)
  )
}

// Synthesized so a new-order alert never depends on shipping/loading an audio asset.
// AudioContext is reused across calls; browsers only need one prior user gesture
// anywhere on the page (e.g. clicking the tab switcher) before it can play.
let chimeContext: AudioContext | null = null
function playNewOrderChime() {
  try {
    chimeContext ??= new AudioContext()
    if (chimeContext.state === 'suspended') void chimeContext.resume()
    const now = chimeContext.currentTime
    const oscillator = chimeContext.createOscillator()
    const gain = chimeContext.createGain()
    oscillator.type = 'sine'
    oscillator.frequency.setValueAtTime(880, now)
    oscillator.frequency.setValueAtTime(1108, now + 0.14)
    gain.gain.setValueAtTime(0.0001, now)
    gain.gain.exponentialRampToValueAtTime(0.22, now + 0.02)
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.45)
    oscillator.connect(gain).connect(chimeContext.destination)
    oscillator.start(now)
    oscillator.stop(now + 0.45)
  } catch {
    // Some browsers block audio without a prior gesture — the toast still shows.
  }
}

const historyColumns = [
  { header: 'Order #', render: (order: OrderSummary) => <span className="font-bold">{order.orderNumber}</span> },
  { header: 'Customer', render: (order: OrderSummary) => order.customerName },
  {
    header: 'Order',
    render: (order: OrderSummary) => (
      <StatusBadge label={orderStatusLabel(order.status)} tone={orderStatusTone(order.status)} />
    ),
  },
  {
    header: 'Payment',
    render: (order: OrderSummary) => (
      <StatusBadge label={paymentGroupLabel(order.paymentGroup)} tone={paymentGroupTone(order.paymentGroup)} />
    ),
  },
  { header: 'Total', render: (order: OrderSummary) => formatMoney(order.total, order.currency) },
  { header: 'Placed', render: (order: OrderSummary) => new Date(order.placedAt ?? order.createdAt).toLocaleString() },
]

export function OrdersPage() {
  const { session } = useAuth()
  const token = session!.token
  const navigate = useNavigate()
  const [view, setView] = useState<'active' | 'history'>('active')
  const [workspace, setWorkspace] = useState<OrderWorkspace | null>(null)
  const [history, setHistory] = useState<OrderSummary[]>([])
  const [pagination, setPagination] = useState<Pagination | null>(null)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<OrderStatus | ''>('')
  const [paymentGroup, setPaymentGroup] = useState<PaymentGroup | ''>('')
  const [fulfillmentType, setFulfillmentType] = useState<FulfillmentType | ''>('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [busyAction, setBusyAction] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [cancelOrder, setCancelOrder] = useState<WorkspaceOrder | null>(null)
  const [cancelReason, setCancelReason] = useState('')
  const validation = useFormValidation<'reason'>('orders-cancel', (): FieldErrors<'reason'> => (
    !cancelReason.trim() ? { reason: 'Enter a cancellation reason.' } : {}
  ))
  const [activeSearch, setActiveSearch] = useState('')
  const [, forceTick] = useState(0)
  const originalTitleRef = useRef(document.title)

  const loadWorkspace = useCallback(async (quiet = false) => {
    if (!quiet) setIsLoading(true)
    setError(null)
    try {
      setWorkspace(await getOrderWorkspace(token))
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not load active orders.')
    } finally {
      if (!quiet) setIsLoading(false)
    }
  }, [token])

  const loadHistory = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const result = await listOrders(token, {
        scope: 'history',
        search: search.trim() || undefined,
        status: status || undefined,
        paymentGroup: paymentGroup || undefined,
        fulfillmentType: fulfillmentType || undefined,
        dateFrom: dateFrom ? new Date(`${dateFrom}T00:00:00`).toISOString() : undefined,
        dateTo: dateTo ? new Date(`${dateTo}T23:59:59.999`).toISOString() : undefined,
        page,
        limit: PAGE_SIZE,
      })
      setHistory(result.orders)
      setPagination(result.pagination)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not load order history.')
    } finally {
      setIsLoading(false)
    }
  }, [dateFrom, dateTo, fulfillmentType, page, paymentGroup, search, status, token])

  useEffect(() => {
    // Fetching is the external synchronization performed by this effect.
    // oxlint-disable-next-line react/set-state-in-effect
    if (view === 'active') void loadWorkspace()
    else void loadHistory()
  }, [loadHistory, loadWorkspace, view])

  const liveStatus = useOrderUpdates(token, (event) => {
    if (event.reason === 'created') {
      setNotice('A new order was received.')
      playNewOrderChime()
      if (document.hidden) document.title = `🔔 New order — ${originalTitleRef.current}`
    }
    if (view === 'active') void loadWorkspace(true)
    else void loadHistory()
  })

  useEffect(() => {
    if (liveStatus !== 'disconnected' || view !== 'active') return
    const fallback = window.setInterval(() => void loadWorkspace(true), 60_000)
    return () => window.clearInterval(fallback)
  }, [liveStatus, loadWorkspace, view])

  useEffect(() => {
    if (!notice) return
    const timeout = window.setTimeout(() => setNotice(null), 3500)
    return () => window.clearTimeout(timeout)
  }, [notice])

  // Restores the real tab title once the admin actually looks back at the tab,
  // and re-renders order cards periodically so their "Xm ago" ages stay fresh.
  useEffect(() => {
    const restoreTitle = () => {
      if (!document.hidden) document.title = originalTitleRef.current
    }
    document.addEventListener('visibilitychange', restoreTitle)
    window.addEventListener('focus', restoreTitle)
    const ticker = window.setInterval(() => forceTick((tick) => tick + 1), 30_000)
    return () => {
      document.removeEventListener('visibilitychange', restoreTitle)
      window.removeEventListener('focus', restoreTitle)
      window.clearInterval(ticker)
      document.title = originalTitleRef.current
    }
  }, [])

  const runAction = async (order: WorkspaceOrder, action: FulfillmentAction) => {
    const key = `${order.id}:${action}`
    setBusyAction(key)
    setError(null)
    try {
      await updateOrderStatus(token, order.id, actionStatuses[action])
      setNotice(`${actionLabels[action]} completed.`)
      await loadWorkspace(true)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not update this order.')
    } finally {
      setBusyAction(null)
    }
  }

  const confirmCancellation = async () => {
    if (!cancelOrder || !validation.submit()) return
    const key = `${cancelOrder.id}:cancel`
    setBusyAction(key)
    setError(null)
    try {
      await updateOrderStatus(token, cancelOrder.id, 'cancelled', cancelReason.trim())
      setNotice(`Order ${cancelOrder.orderNumber} cancelled.`)
      setCancelOrder(null)
      setCancelReason('')
      validation.reset()
      await loadWorkspace(true)
    } catch (caught) {
      if (!validation.server(caught, (path) => path === 'note' ? 'reason' : undefined)) {
        setError(caught instanceof Error ? caught.message : 'Could not cancel this order.')
      }
    } finally {
      setBusyAction(null)
    }
  }

  return (
    <div>
      <PageHeader
        title="Orders"
        action={(
          <div className="flex items-center gap-3">
            <span className={`inline-flex items-center gap-2 text-xs font-semibold ${liveStatus === 'connected' ? 'text-olive' : 'text-flame'}`}>
              <span className="h-2 w-2 rounded-full bg-current" />
              {liveStatus === 'connected' ? 'Live' : liveStatus === 'connecting' ? 'Connecting' : 'Reconnecting'}
            </span>
            <button
              type="button"
              onClick={() => view === 'active' ? void loadWorkspace() : void loadHistory()}
              className="rounded-full border-2 border-cocoa/15 px-4 py-2 text-sm font-semibold text-cocoa/70 hover:border-flame hover:text-flame"
            >
              Refresh
            </button>
          </div>
        )}
      />

      <div className="mb-5 inline-flex rounded-full bg-cocoa/10 p-1 text-sm font-semibold">
        {(['active', 'history'] as const).map((tab) => (
          <button
            key={tab}
            type="button"
            className={`rounded-full px-5 py-2 capitalize ${view === tab ? 'bg-white text-cocoa shadow-sm' : 'text-cocoa/55'}`}
            onClick={() => {
              setView(tab)
              setPage(1)
            }}
          >
            {tab}
          </button>
        ))}
      </div>

      {error ? <p className="mb-4 rounded-xl bg-flame/10 px-4 py-3 text-sm font-semibold text-flame">{error}</p> : null}

      {view === 'active' ? (
        isLoading && !workspace ? <p className="text-cocoa/60">Loading active orders…</p> : workspace ? (
          <>
            <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
              <div className="flex w-full max-w-sm items-center gap-3">
                <input
                  value={activeSearch}
                  onChange={(event) => setActiveSearch(event.target.value)}
                  placeholder="Find by order #, customer, or phone…"
                  className="min-w-0 flex-1 rounded-lg border border-cocoa/20 px-3 py-2 text-sm outline-none focus:border-flame"
                />
                {activeSearch.trim() ? (
                  <button type="button" onClick={() => setActiveSearch('')} className="text-sm font-semibold text-cocoa/50 hover:text-flame">
                    Clear
                  </button>
                ) : null}
              </div>
              <div aria-label="Status color guide" className="flex flex-wrap items-center justify-end gap-x-4 gap-y-2 text-[11px] text-cocoa/55">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-bold text-cocoa/70">Payment</span>
                  {PAYMENT_GROUPS.map((group) => (
                    <span key={group} className="inline-flex items-center gap-1">
                      <StatusDot label={`Payment: ${paymentGroupLabel(group)}`} tone={paymentGroupTone(group)} />
                      {paymentGroupLabel(group)}
                    </span>
                  ))}
                </div>
              </div>
            </div>
            <div className="grid items-start gap-4 md:grid-cols-2 xl:grid-cols-4">
            {fulfillmentQueueKeys.map((queueKey) => {
              const meta = queueMeta[queueKey]
              const orders = workspace.queues[queueKey].filter((order) => matchesQuery(order, activeSearch))
              return (
                <section key={queueKey} className={`rounded-2xl border p-3 ${meta.classes}`}>
                  <div className="mb-3 flex items-start justify-between gap-2 px-1">
                    <div>
                      <h2 className="font-display font-bold text-cocoa">{meta.title}</h2>
                      <p className="text-xs text-cocoa/50">{meta.subtitle}</p>
                    </div>
                    <span className="rounded-full bg-white px-2.5 py-1 text-xs font-bold text-cocoa shadow-sm">{orders.length}</span>
                  </div>
                  <div className="flex flex-col gap-3">
                    {orders.length === 0 ? (
                      <div className="rounded-xl border border-dashed border-cocoa/15 px-3 py-7 text-center text-xs text-cocoa/40">
                        {activeSearch.trim() ? 'No matches' : 'Nothing here'}
                      </div>
                    ) : orders.map((order) => {
                      const action = primaryAction(order)
                      const paymentMessage = paymentAttentionMessage(order)
                      const ageMinutes = minutesSince(order.placedAt ?? order.createdAt)
                      const isUrgent = ageMinutes >= meta.urgentAfterMinutes
                      return (
                        <article
                          key={order.id}
                          tabIndex={0}
                          role="button"
                          onClick={() => navigate(`/orders/${order.id}`)}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter') navigate(`/orders/${order.id}`)
                          }}
                          className={`cursor-pointer rounded-xl border bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md focus:outline-2 focus:outline-flame ${isUrgent ? 'border-flame/40 ring-1 ring-flame/20' : 'border-white/80'}`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <StatusDot
                              label={`Payment status: ${paymentGroupLabel(order.paymentGroup)}`}
                              tone={paymentGroupTone(order.paymentGroup)}
                            />
                            <span
                              title={new Date(order.placedAt ?? order.createdAt).toLocaleString()}
                              className={`inline-flex items-center gap-1 text-xs font-semibold ${isUrgent ? 'text-flame' : 'text-cocoa/40'}`}
                            >
                              {isUrgent ? <span className="h-1.5 w-1.5 rounded-full bg-flame" aria-hidden="true" /> : null}
                              {formatAge(ageMinutes)}
                            </span>
                          </div>
                          <p className="mt-2 font-display text-lg font-bold text-cocoa">#{order.orderNumber}</p>
                          <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-cocoa/55">
                            {order.items.map((item) => `${item.quantity}× ${item.productName}`).join(', ')}
                          </p>
                          <div className="mt-3 flex items-center justify-between gap-3 text-xs">
                            <span className="min-w-0 truncate font-semibold text-cocoa/75">{order.customerName}</span>
                            <span className="min-w-0 truncate text-right text-cocoa/50">{orderLocation(order)}</span>
                          </div>
                          <div className="mt-3 flex items-center justify-between text-xs text-cocoa/55">
                            <span className="capitalize">{order.fulfillmentType.replace(/_/g, ' ')}</span>
                            <span className="font-bold text-cocoa">{formatMoney(order.total, order.currency)}</span>
                          </div>
                          {paymentMessage ? (
                            <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-center text-xs font-semibold text-amber-800">
                              {paymentMessage}
                            </p>
                          ) : null}
                          {action ? (
                            <button
                              type="button"
                              disabled={busyAction === `${order.id}:${action}`}
                              onClick={(event) => {
                                event.stopPropagation()
                                void runAction(order, action)
                              }}
                              className="mt-3 w-full rounded-full bg-flame px-3 py-2 text-sm font-bold text-cream disabled:opacity-50"
                            >
                              {busyAction === `${order.id}:${action}` ? 'Working…' : actionLabels[action]}
                            </button>
                          ) : null}
                          {order.availableActions.includes('cancel') ? (
                            <button
                              type="button"
                              onClick={(event) => {
                                event.stopPropagation()
                                setCancelOrder(order)
                              }}
                              className="mt-2 w-full text-xs font-semibold text-cocoa/40 hover:text-flame"
                            >
                              Cancel order
                            </button>
                          ) : null}
                        </article>
                      )
                    })}
                  </div>
                </section>
              )
            })}
            </div>
          </>
        ) : null
      ) : (
        <div>
          <div className="mb-4 grid gap-3 rounded-2xl border border-cocoa/10 bg-white p-4 sm:grid-cols-2 lg:grid-cols-6">
            <input value={search} onChange={(event) => { setSearch(event.target.value); setPage(1) }} placeholder="Order, customer, phone" className="rounded-lg border border-cocoa/20 px-3 py-2 text-sm lg:col-span-2" />
            <select value={status} onChange={(event) => { setStatus(event.target.value as OrderStatus | ''); setPage(1) }} className="rounded-lg border border-cocoa/20 px-3 py-2 text-sm">
              <option value="">All outcomes</option>
              {HISTORY_STATUSES.map((item) => <option key={item} value={item}>{orderStatusLabel(item)}</option>)}
            </select>
            <select value={paymentGroup} onChange={(event) => { setPaymentGroup(event.target.value as PaymentGroup | ''); setPage(1) }} className="rounded-lg border border-cocoa/20 px-3 py-2 text-sm">
              <option value="">All payments</option>
              {PAYMENT_GROUPS.map((group) => <option key={group} value={group}>{paymentGroupLabel(group)}</option>)}
            </select>
            <select value={fulfillmentType} onChange={(event) => { setFulfillmentType(event.target.value as FulfillmentType | ''); setPage(1) }} className="rounded-lg border border-cocoa/20 px-3 py-2 text-sm">
              <option value="">All fulfillment</option>
              {FULFILLMENT_TYPES.map((item) => <option key={item} value={item}>{item.replace(/_/g, ' ')}</option>)}
            </select>
            <div className="flex gap-2 lg:col-span-1">
              <input type="date" title="From date" value={dateFrom} onChange={(event) => { setDateFrom(event.target.value); setPage(1) }} className="min-w-0 rounded-lg border border-cocoa/20 px-2 py-2 text-xs" />
              <input type="date" title="To date" value={dateTo} onChange={(event) => { setDateTo(event.target.value); setPage(1) }} className="min-w-0 rounded-lg border border-cocoa/20 px-2 py-2 text-xs" />
            </div>
          </div>
          {isLoading ? <p className="text-cocoa/60">Loading history…</p> : (
            <>
              <DataTable columns={historyColumns} rows={history} rowKey={(order) => order.id} onRowClick={(order) => navigate(`/orders/${order.id}`)} emptyState="No completed or cancelled orders match these filters." />
              {pagination && pagination.totalPages > 1 ? (
                <div className="mt-4 flex items-center justify-between text-sm font-semibold text-cocoa/70">
                  <button disabled={pagination.page <= 1} onClick={() => setPage((current) => Math.max(1, current - 1))} className="disabled:opacity-40">← Previous</button>
                  <span>Page {pagination.page} of {pagination.totalPages}</span>
                  <button disabled={pagination.page >= pagination.totalPages} onClick={() => setPage((current) => current + 1)} className="disabled:opacity-40">Next →</button>
                </div>
              ) : null}
            </>
          )}
        </div>
      )}

      {notice ? <div className="fixed bottom-5 right-5 z-50 rounded-xl bg-cocoa px-4 py-3 text-sm font-semibold text-cream shadow-lg">{notice}</div> : null}

      {cancelOrder ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-cocoa/40 px-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-[var(--shadow-chunky)]">
            <h2 className="font-display text-xl font-bold">Cancel order #{cancelOrder.orderNumber}?</h2>
            {['confirmed', 'cash_collected'].includes(cancelOrder.paymentDisplayStatus) ? (
              <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-800">Payment is confirmed. Cancelling will not issue a refund; handle that separately.</p>
            ) : null}
            <label className="mt-4 block text-sm font-semibold">
              Cancellation reason
              <textarea {...validation.props('reason')} value={cancelReason} onChange={(event) => { setCancelReason(event.target.value); validation.changed('reason') }} rows={3} maxLength={1000} className={`mt-1 w-full rounded-lg border border-cocoa/20 px-3 py-2 font-normal ${validation.error('reason') ? 'border-flame bg-flame/5' : ''}`} />
              {validation.error('reason') ? <span id="orders-cancel-reason-error" className="text-xs text-flame">{validation.error('reason')}</span> : null}
            </label>
            {error ? <p role="alert" className="mt-2 text-sm text-flame">{error}</p> : null}
            <div className="mt-5 flex justify-end gap-3">
              <button type="button" onClick={() => { setCancelOrder(null); setCancelReason(''); validation.reset() }} className="rounded-full px-5 py-2 font-semibold text-cocoa/60">Keep order</button>
              <button type="button" disabled={busyAction === `${cancelOrder.id}:cancel`} onClick={() => void confirmCancellation()} className="rounded-full bg-flame px-5 py-2 font-bold text-cream disabled:opacity-50">Cancel order</button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
