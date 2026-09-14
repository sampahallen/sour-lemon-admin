import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import { PageHeader } from '@/components/ui/PageHeader'
import { Button } from '@/components/ui/Button'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { useAuth } from '@/auth/authContext'
import {
  collectOrderCash,
  confirmOrderPayment,
  getOrder,
  updateOrderStatus,
  type OrderAction,
  type OrderDetail,
} from '@/api/orders'
import type { OrderStatus } from '@/api/types'
import { useOrderUpdates } from '@/hooks/useOrderUpdates'
import { getOrderWhatsAppOptions } from '@/api/whatsapp'
import { WhatsAppComposer } from '@/components/whatsapp/WhatsAppComposer'
import { useFormValidation, type FieldErrors } from '@/hooks/useFormValidation'
import {
  orderStatusLabel,
  orderStatusTone,
  paymentGroupLabel,
  paymentGroupTone,
} from './orderStatus'

const actionLabels: Record<Exclude<OrderAction, 'cancel'>, string> = {
  confirm_payment: 'Confirm payment',
  collect_cash: 'Collect cash',
  start_preparing: 'Start preparing',
  mark_ready: 'Mark ready for pickup',
  dispatch: 'Send out for delivery',
  complete: 'Complete order',
}

const actionStatuses: Partial<Record<OrderAction, OrderStatus>> = {
  start_preparing: 'preparing',
  mark_ready: 'ready_for_pickup',
  dispatch: 'out_for_delivery',
  complete: 'completed',
}

const formatMoney = (amount: string, currency: string) =>
  new Intl.NumberFormat('en-GH', { style: 'currency', currency }).format(Number(amount))

export function OrderDetailPage() {
  const { orderId } = useParams()
  const { session } = useAuth()
  const token = session!.token
  const navigate = useNavigate()
  const [order, setOrder] = useState<OrderDetail | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [busyAction, setBusyAction] = useState<OrderAction | null>(null)
  const [whatsappTemplateId, setWhatsappTemplateId] = useState<string | null>(null)
  const [cancelOpen, setCancelOpen] = useState(false)
  const [cancelReason, setCancelReason] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const validation = useFormValidation<'reason'>('order-detail-cancel', (): FieldErrors<'reason'> => (
    !cancelReason.trim() ? { reason: 'Enter a cancellation reason.' } : {}
  ))

  const load = useCallback(async (quiet = false) => {
    if (!orderId) return
    if (!quiet) setIsLoading(true)
    setError(null)
    try {
      const result = await getOrder(token, orderId)
      setOrder(result.order)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not load this order.')
    } finally {
      if (!quiet) setIsLoading(false)
    }
  }, [orderId, token])

  useEffect(() => {
    // Fetching is the external synchronization performed by this effect.
    // oxlint-disable-next-line react/set-state-in-effect
    void load()
  }, [load])

  const liveStatus = useOrderUpdates(token, (event) => {
    if (event.orderId === orderId) void load(true)
  })

  const loadWhatsAppOptions = useCallback(() => {
    if (!orderId) return Promise.reject(new Error('Order not found.'))
    return getOrderWhatsAppOptions(token, orderId)
  }, [orderId, token])

  useEffect(() => {
    if (!notice) return
    const timeout = window.setTimeout(() => setNotice(null), 3500)
    return () => window.clearTimeout(timeout)
  }, [notice])

  if (isLoading) return <p className="text-cocoa/60">Loading order…</p>

  if (!order) {
    return (
      <div className="rounded-xl border border-flame/20 bg-white p-8 text-center">
        <p className="font-semibold text-flame">{error ?? 'Order not found.'}</p>
        <Button className="mt-4" variant="outline" onClick={() => navigate('/orders')}>Back to orders</Button>
      </div>
    )
  }

  const runAction = async (action: Exclude<OrderAction, 'cancel'>) => {
    setBusyAction(action)
    setError(null)
    try {
      let updated: { order: OrderDetail }
      if (action === 'confirm_payment') updated = await confirmOrderPayment(token, order.id)
      else if (action === 'collect_cash') updated = await collectOrderCash(token, order.id)
      else updated = await updateOrderStatus(token, order.id, actionStatuses[action]!)
      setOrder(updated.order)
      setNotice(`${actionLabels[action]} completed.`)
      if (action === 'mark_ready') setWhatsappTemplateId('ready')
      if (action === 'dispatch') setWhatsappTemplateId('delivery')
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not update this order.')
    } finally {
      setBusyAction(null)
    }
  }

  const confirmCancellation = async () => {
    if (!validation.submit()) return
    setBusyAction('cancel')
    setError(null)
    try {
      const updated = await updateOrderStatus(token, order.id, 'cancelled', cancelReason.trim())
      setOrder(updated.order)
      setCancelOpen(false)
      setCancelReason('')
      validation.reset()
      setNotice('Order cancelled.')
    } catch (caught) {
      if (!validation.server(caught, (path) => path === 'note' ? 'reason' : undefined)) {
        setError(caught instanceof Error ? caught.message : 'Could not cancel this order.')
      }
    } finally {
      setBusyAction(null)
    }
  }

  const paymentAction = order.availableActions.find((action) => ['confirm_payment', 'collect_cash'].includes(action)) as Exclude<OrderAction, 'cancel'> | undefined
  const fulfillmentAction = order.availableActions.find((action) => ['start_preparing', 'mark_ready', 'dispatch', 'complete'].includes(action)) as Exclude<OrderAction, 'cancel'> | undefined
  const finalHandoff = order.fulfillmentType === 'sour_lemon_delivery' ? 'out_for_delivery' : 'ready_for_pickup'
  const steps: { status: OrderStatus; label: string }[] = [
    { status: 'received', label: 'Received' },
    { status: 'preparing', label: 'Preparing' },
    { status: finalHandoff, label: finalHandoff === 'out_for_delivery' ? 'Delivery' : 'Ready' },
    { status: 'completed', label: 'Completed' },
  ]
  const normalizedStatus = ['pending_payment', 'confirmed'].includes(order.status) ? 'received' : order.status
  const currentStep = steps.findIndex((step) => step.status === normalizedStatus)
  const isCancelled = order.status === 'cancelled'
  const visibleStep = currentStep >= 0 ? currentStep : 0
  const primaryAction = fulfillmentAction ?? paymentAction
  const secondaryAction = fulfillmentAction && paymentAction ? paymentAction : undefined
  const fulfillmentLabel = order.fulfillmentType === 'sour_lemon_delivery'
    ? 'Sour Lemon delivery'
    : order.fulfillmentType === 'customer_rider' ? 'Own rider' : 'Pickup'

  return (
    <div>
      <PageHeader
        title={`Order #${order.orderNumber}`}
        action={(
          <div className="flex items-center gap-3">
            <span className={`text-xs font-semibold ${liveStatus === 'connected' ? 'text-olive' : 'text-flame'}`}>{liveStatus === 'connected' ? '● Live' : '● Reconnecting'}</span>
            <Button variant="outline" onClick={() => navigate('/orders')}>Back to orders</Button>
          </div>
        )}
      />

      {error ? <p className="mb-4 rounded-lg bg-flame/10 px-3 py-2 text-sm font-semibold text-flame">{error}</p> : null}

      <section className="mb-5 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-cocoa/10 bg-white px-5 py-4 shadow-sm">
        <div className="min-w-0">
          <p className="truncate font-display text-lg font-bold text-cocoa">{order.customerName}</p>
          <a href={`tel:${order.phoneNumber}`} className="text-sm text-cocoa/55 hover:text-flame">{order.phoneNumber}</a>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge label={orderStatusLabel(order.status)} tone={orderStatusTone(order.status)} />
          <StatusBadge label={paymentGroupLabel(order.paymentGroup)} tone={paymentGroupTone(order.paymentGroup)} />
          <span className="rounded-full bg-cocoa/5 px-3 py-1 text-xs font-semibold text-cocoa/65">{fulfillmentLabel}</span>
          <span className="ml-1 font-display text-lg font-bold text-cocoa">{formatMoney(order.total, order.currency)}</span>
        </div>
      </section>

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="space-y-5">
          <section className="rounded-2xl border border-cocoa/10 bg-white p-5 sm:p-6">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-cocoa/40">Production brief</p>
                <h2 className="mt-1 font-display text-xl font-bold">What to make</h2>
              </div>
              <span className="text-sm font-semibold text-cocoa/45">{order.items.length} {order.items.length === 1 ? 'item' : 'items'}</span>
            </div>

            {order.customerNotes ? (
              <div className="mt-4 rounded-xl border-l-4 border-butter bg-butter/20 px-4 py-3">
                <p className="text-[11px] font-bold uppercase tracking-wider text-cocoa/45">Customer note</p>
                <p className="mt-1 text-sm font-semibold leading-relaxed text-cocoa">{order.customerNotes}</p>
              </div>
            ) : null}

            <div className="mt-4 divide-y divide-cocoa/10">
              {order.items.map((item) => (
                <div key={item.id} className="flex items-center gap-4 py-4 first:pt-2 last:pb-1">
                  <div className="relative shrink-0">
                    {item.productImageUrl ? (
                      <img
                        src={item.productImageUrl}
                        alt=""
                        loading="lazy"
                        className="h-14 w-14 rounded-xl bg-cream object-cover"
                      />
                    ) : (
                      <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-cocoa/5 font-display text-sm font-bold text-cocoa/25" aria-hidden="true">SL</div>
                    )}
                    <span className="absolute -right-2 -top-2 flex h-7 min-w-7 items-center justify-center rounded-full border-2 border-white bg-flame px-1.5 text-xs font-bold text-cream shadow-sm">{item.quantity}</span>
                  </div>
                  <span className="min-w-0 flex-1 font-semibold text-cocoa">{item.productName}</span>
                  <span className="shrink-0 text-sm text-cocoa/45">{formatMoney(item.lineTotal, order.currency)}</span>
                </div>
              ))}
            </div>

            <div className="mt-5 flex flex-wrap justify-end gap-x-5 gap-y-1 border-t border-cocoa/10 pt-4 text-sm text-cocoa/55">
              <span>Subtotal {formatMoney(order.subtotal, order.currency)}</span>
              <span>Delivery {formatMoney(order.deliveryFee, order.currency)}</span>
              <strong className="text-cocoa">Total {formatMoney(order.total, order.currency)}</strong>
            </div>
          </section>

          <section className="rounded-2xl border border-cocoa/10 bg-white p-5 sm:p-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-cocoa/40">Handoff</p>
                <h2 className="mt-1 font-display text-lg font-bold">{fulfillmentLabel}</h2>
              </div>
              {order.whatsappNumber ? <span className="text-sm text-cocoa/45">WhatsApp {order.whatsappNumber}</span> : null}
            </div>
            {order.deliveryAddress ? (
              <div className="mt-3 text-sm leading-relaxed text-cocoa/65">
                <p>{order.deliveryAddress.addressLine1}{order.deliveryAddress.addressLine2 ? `, ${order.deliveryAddress.addressLine2}` : ''}</p>
                <p>{order.deliveryAddress.city}{order.deliveryAddress.landmark ? ` · Near ${order.deliveryAddress.landmark}` : ''}</p>
              </div>
            ) : (
              <p className="mt-3 text-sm text-cocoa/55">The customer or their rider will collect this order.</p>
            )}
            <div className="mt-4">
              <Button variant="outline" accent="olive" onClick={() => setWhatsappTemplateId('')}>
                Message customer on WhatsApp
              </Button>
            </div>
          </section>

          <details className="rounded-2xl border border-cocoa/10 bg-white px-5 py-4">
            <summary className="cursor-pointer font-display font-bold text-cocoa">Order history <span className="ml-1 text-sm font-normal text-cocoa/40">({order.statusHistory.length})</span></summary>
            <ul className="mt-4 flex flex-col gap-3 border-t border-cocoa/10 pt-4 text-sm">
              {order.statusHistory.map((entry, index) => (
                <li key={`${entry.createdAt}-${index}`} className="flex flex-wrap items-center gap-2 text-cocoa/65">
                  <span className="font-semibold">{orderStatusLabel(entry.toStatus)}</span>
                  <time className="text-cocoa/40">{new Date(entry.createdAt).toLocaleString()}</time>
                  {entry.note ? <span className="text-cocoa/50">· {entry.note}</span> : null}
                </li>
              ))}
            </ul>
          </details>
        </div>

        <aside className="overflow-hidden rounded-2xl border border-cocoa/10 bg-white shadow-sm lg:sticky lg:top-6">
          <div className="bg-gradient-to-br from-butter/20 via-cream/40 to-white p-5 pb-6">
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs font-bold uppercase tracking-wider text-cocoa/40">Next step</p>
              {!isCancelled ? (
                <span className="rounded-full border border-cocoa/10 bg-white/80 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-cocoa/45">
                  Step {Math.min(visibleStep + 1, steps.length)} of {steps.length}
                </span>
              ) : null}
            </div>
            <h2 className="mt-1 font-display text-xl font-bold text-cocoa">
              {primaryAction ? actionLabels[primaryAction] : order.status === 'completed' ? 'Order complete' : isCancelled ? 'Order cancelled' : 'No action needed'}
            </h2>

            <ol className="mt-6 flex" aria-label="Order progress">
            {steps.map((step, index) => {
              const complete = !isCancelled && (order.status === 'completed' || visibleStep > index)
              const current = !isCancelled && order.status !== 'completed' && visibleStep === index
              return (
                <li
                  key={step.status}
                  className="relative min-w-0 flex-1 text-center"
                  aria-current={current ? 'step' : undefined}
                >
                  {index < steps.length - 1 ? (
                    <span
                      aria-hidden="true"
                      className={`absolute left-[calc(50%+1rem)] right-[calc(-50%+1rem)] top-4 h-0.5 ${complete ? 'bg-olive' : 'bg-cocoa/10'}`}
                    />
                  ) : null}
                  <span
                    className={`relative z-10 mx-auto grid h-8 w-8 place-items-center rounded-full border-2 text-xs font-bold transition-colors ${
                      complete
                        ? 'border-olive bg-olive text-white shadow-[0_3px_0_rgba(84,98,54,0.2)]'
                        : current
                          ? 'border-flame bg-white text-flame shadow-[0_0_0_4px_rgba(243,92,49,0.12)]'
                          : 'border-cocoa/10 bg-white text-cocoa/25'
                    }`}
                  >
                    {complete ? (
                      <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" aria-hidden="true">
                        <path d="m5 10 3 3 7-7" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    ) : current ? <span className="h-2.5 w-2.5 rounded-full bg-flame" /> : index + 1}
                  </span>
                  <span className={`mt-2 block truncate px-0.5 text-[10px] font-bold ${complete || current ? 'text-cocoa' : 'text-cocoa/35'}`}>
                    {step.label}
                  </span>
                </li>
              )
            })}
            </ol>
          </div>

          <div className="p-5 pt-0">
          {isCancelled ? (
            <p className="mb-5 rounded-xl border border-flame/15 bg-flame/5 px-3 py-2 text-xs font-semibold text-flame">
              This order has stopped and no further production steps are needed.
            </p>
          ) : null}

          <div className="mt-5 rounded-xl bg-cocoa/[0.035] p-3 text-sm">
            <div className="flex items-center justify-between gap-3">
              <span className="text-cocoa/50">Payment</span>
              <StatusBadge label={paymentGroupLabel(order.paymentGroup)} tone={paymentGroupTone(order.paymentGroup)} />
            </div>
            <p className="mt-2 text-xs leading-relaxed text-cocoa/50">
              {order.payment ? `${order.payment.method.toUpperCase()} · ${formatMoney(order.payment.amount, order.currency)}` : 'No payment record'}
            </p>
            {order.payment?.paymentName ? (
              <div className="mt-3 rounded-lg border border-violet-200 bg-violet-50 px-3 py-2">
                <p className="text-[10px] font-bold uppercase tracking-wider text-violet-600">Name on payment</p>
                <p className="mt-0.5 font-display text-base font-bold text-cocoa">{order.payment.paymentName}</p>
              </div>
            ) : null}
            {order.paymentDisplayStatus === 'needs_review' ? <p className="mt-1 text-xs font-semibold text-violet-700">Paystack verified this payment. It needs your confirmation.</p> : null}
            {order.paymentDisplayStatus === 'cash_due' ? <p className="mt-1 text-xs font-semibold text-amber-700">Record the cash when the customer collects.</p> : null}
            {order.paymentDisplayStatus === 'failed' ? <p className="mt-1 text-xs font-semibold text-flame">The online payment failed.</p> : null}
          </div>

          {primaryAction ? (
            <button disabled={busyAction === primaryAction} onClick={() => void runAction(primaryAction)} className="mt-5 w-full rounded-full bg-flame px-5 py-3 text-sm font-bold text-cream disabled:opacity-50">
              {busyAction === primaryAction ? 'Working…' : actionLabels[primaryAction]}
            </button>
          ) : null}
          {secondaryAction ? (
            <button disabled={busyAction === secondaryAction} onClick={() => void runAction(secondaryAction)} className="mt-2 w-full rounded-full border-2 border-violet-200 px-5 py-2.5 text-sm font-bold text-violet-700 disabled:opacity-50">
              {busyAction === secondaryAction ? 'Working…' : actionLabels[secondaryAction]}
            </button>
          ) : null}

          {order.availableActions.includes('cancel') ? (
            <div className="mt-5 border-t border-cocoa/10 pt-4 text-center">
              <button onClick={() => setCancelOpen(true)} className="text-xs font-semibold text-cocoa/35 hover:text-flame">Cancel order</button>
            </div>
          ) : null}
          </div>
        </aside>
      </div>

      {notice ? <div className="fixed bottom-5 right-5 z-50 rounded-xl bg-cocoa px-4 py-3 text-sm font-semibold text-cream shadow-lg">{notice}</div> : null}

      {cancelOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-cocoa/40 px-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-[var(--shadow-chunky)]">
            <h2 className="font-display text-xl font-bold">Cancel this order?</h2>
            {['confirmed', 'cash_collected'].includes(order.paymentDisplayStatus) ? <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-800">Payment is confirmed. This will not issue a refund.</p> : null}
            <label className="mt-4 block text-sm font-semibold">Cancellation reason<textarea {...validation.props('reason')} value={cancelReason} onChange={(event) => { setCancelReason(event.target.value); validation.changed('reason') }} rows={3} maxLength={1000} className={`mt-1 w-full rounded-lg border border-cocoa/20 px-3 py-2 font-normal ${validation.error('reason') ? 'border-flame bg-flame/5' : ''}`} />{validation.error('reason') ? <span id="order-detail-cancel-reason-error" className="text-xs text-flame">{validation.error('reason')}</span> : null}</label>
            {error ? <p role="alert" className="mt-2 text-sm text-flame">{error}</p> : null}
            <div className="mt-5 flex justify-end gap-3">
              <button onClick={() => { setCancelOpen(false); setCancelReason(''); validation.reset() }} className="rounded-full px-5 py-2 font-semibold text-cocoa/60">Keep order</button>
              <button disabled={busyAction === 'cancel'} onClick={() => void confirmCancellation()} className="rounded-full bg-flame px-5 py-2 font-bold text-cream disabled:opacity-50">Cancel order</button>
            </div>
          </div>
        </div>
      ) : null}

      {whatsappTemplateId !== null ? (
        <WhatsAppComposer
          title={`Message ${order.customerName}`}
          preferredTemplateId={whatsappTemplateId || undefined}
          loadOptions={loadWhatsAppOptions}
          onClose={() => setWhatsappTemplateId(null)}
        />
      ) : null}
    </div>
  )
}
