import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import { PageHeader } from '@/components/ui/PageHeader'
import { Button } from '@/components/ui/Button'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { useAuth } from '@/auth/authContext'
import { getOrder, updateOrderStatus, type OrderDetail } from '@/api/orders'
import { ORDER_STATUSES, type OrderStatus } from '@/api/types'
import { orderStatusTone } from './orderStatus'
import { buildDeliveryTimeMessage, buildWhatsAppLink } from '@/utils/whatsapp'

export function OrderDetailPage() {
  const { orderId } = useParams()
  const { session } = useAuth()
  const token = session!.token
  const navigate = useNavigate()

  const [order, setOrder] = useState<OrderDetail | null>(null)
  const [nextStatus, setNextStatus] = useState<OrderStatus | ''>('')
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false)
  const [isMessageFormOpen, setIsMessageFormOpen] = useState(false)
  const [deliveryTime, setDeliveryTime] = useState('')

  const load = async () => {
    if (!orderId) return
    const { order } = await getOrder(token, orderId)
    setOrder(order)
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId])

  if (!order) return <p className="text-cocoa/60">Loading…</p>

  const canSendDeliveryMessage = order.fulfillmentType !== 'pickup'

  const handleStatusChange = async () => {
    if (!nextStatus) return
    setIsUpdatingStatus(true)
    try {
      await updateOrderStatus(token, order.id, nextStatus)
      setNextStatus('')
      await load()
    } finally {
      setIsUpdatingStatus(false)
    }
  }

  // Opens the WhatsApp tab synchronously (within the click handler) so browsers
  // don't treat it as a blocked popup once we've awaited a network response.
  const handleSendDeliveryMessage = () => {
    if (!deliveryTime) return
    const message = buildDeliveryTimeMessage(order, deliveryTime)
    const link = buildWhatsAppLink(order.whatsappNumber ?? order.phoneNumber, message)
    window.open(link, '_blank', 'noreferrer')
    setIsMessageFormOpen(false)
    setDeliveryTime('')
  }

  return (
    <div>
      <PageHeader
        title={`Order ${order.orderNumber}`}
        action={
          <Button variant="outline" onClick={() => navigate('/orders')}>
            Back to orders
          </Button>
        }
      />

      <div className="grid gap-6 md:grid-cols-2">
        <section className="rounded-xl border border-cocoa/10 bg-white p-5">
          <h2 className="mb-3 font-display text-lg font-bold">Customer</h2>
          <p className="font-semibold">{order.customerName}</p>
          <p className="text-sm text-cocoa/70">{order.phoneNumber}</p>
          {order.whatsappNumber ? <p className="text-sm text-cocoa/70">WhatsApp: {order.whatsappNumber}</p> : null}
          <p className="mt-2 text-sm capitalize text-cocoa/70">Fulfillment: {order.fulfillmentType.replace(/_/g, ' ')}</p>
          {order.deliveryAddress ? (
            <div className="mt-2 text-sm text-cocoa/70">
              <p>{order.deliveryAddress.addressLine1}</p>
              {order.deliveryAddress.addressLine2 ? <p>{order.deliveryAddress.addressLine2}</p> : null}
              <p>
                {order.deliveryAddress.city}
                {order.deliveryAddress.landmark ? ` — ${order.deliveryAddress.landmark}` : ''}
              </p>
            </div>
          ) : null}
          {order.customerNotes ? <p className="mt-3 text-sm italic text-cocoa/60">"{order.customerNotes}"</p> : null}
        </section>

        <section className="rounded-xl border border-cocoa/10 bg-white p-5">
          <h2 className="mb-3 font-display text-lg font-bold">Status</h2>
          <StatusBadge label={order.status} tone={orderStatusTone(order.status)} />
          <p className="mt-2 text-sm text-cocoa/70">Payment: {order.paymentStatus.replace(/_/g, ' ')}</p>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <select
              value={nextStatus}
              onChange={(event) => setNextStatus(event.target.value as OrderStatus)}
              className="rounded-lg border border-cocoa/20 px-3 py-2 text-sm"
            >
              <option value="">Change status…</option>
              {ORDER_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {status.replace(/_/g, ' ')}
                </option>
              ))}
            </select>
            <Button size="md" disabled={!nextStatus || isUpdatingStatus} onClick={handleStatusChange}>
              {isUpdatingStatus ? 'Updating…' : 'Update'}
            </Button>
          </div>

          {canSendDeliveryMessage ? (
            <div className="mt-4 border-t border-cocoa/10 pt-4">
              {isMessageFormOpen ? (
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    value={deliveryTime}
                    onChange={(event) => setDeliveryTime(event.target.value)}
                    placeholder="e.g. 4:30pm today"
                    className="rounded-lg border border-cocoa/20 px-3 py-2 text-sm"
                  />
                  <Button size="md" disabled={!deliveryTime} onClick={handleSendDeliveryMessage}>
                    Open WhatsApp
                  </Button>
                  <button className="text-sm text-cocoa/60" onClick={() => setIsMessageFormOpen(false)}>
                    Cancel
                  </button>
                </div>
              ) : (
                <Button variant="outline" onClick={() => setIsMessageFormOpen(true)}>
                  Send delivery-time WhatsApp message
                </Button>
              )}
            </div>
          ) : null}
        </section>

        <section className="rounded-xl border border-cocoa/10 bg-white p-5 md:col-span-2">
          <h2 className="mb-3 font-display text-lg font-bold">Items</h2>
          <table className="w-full text-left text-sm">
            <thead className="text-cocoa/60">
              <tr>
                <th className="py-2">Item</th>
                <th className="py-2">Qty</th>
                <th className="py-2">Unit price</th>
                <th className="py-2">Line total</th>
              </tr>
            </thead>
            <tbody>
              {order.items.map((item) => (
                <tr key={item.id} className="border-t border-cocoa/5">
                  <td className="py-2">{item.productName}</td>
                  <td className="py-2">{item.quantity}</td>
                  <td className="py-2">{item.unitPrice}</td>
                  <td className="py-2">{item.lineTotal}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="mt-3 flex flex-col items-end gap-1 text-sm">
            <p>Subtotal: {order.subtotal}</p>
            <p>Delivery fee: {order.deliveryFee}</p>
            <p className="font-bold">
              Total: {order.currency} {order.total}
            </p>
          </div>
        </section>

        <section className="rounded-xl border border-cocoa/10 bg-white p-5 md:col-span-2">
          <h2 className="mb-3 font-display text-lg font-bold">Status history</h2>
          <ul className="flex flex-col gap-2 text-sm">
            {order.statusHistory.map((entry, index) => (
              <li key={index} className="flex items-center gap-2 text-cocoa/70">
                <span className="capitalize">{entry.toStatus.replace(/_/g, ' ')}</span>
                {entry.note ? <span className="text-cocoa/50">— {entry.note}</span> : null}
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  )
}
