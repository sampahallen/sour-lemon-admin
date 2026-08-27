import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import { PageHeader } from '@/components/ui/PageHeader'
import { Button } from '@/components/ui/Button'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { useAuth } from '@/auth/authContext'
import {
  cancelCustomCakeRequest,
  getCustomCakeRequest,
  quoteCustomCakeRequest,
  rejectCustomCakeRequest,
  sendCustomCakePaymentLink,
  type CustomCakeRequestDetail,
} from '@/api/customCakeRequests'
import { customCakeStatusTone } from './customCakeStatus'
import { buildCustomCakeQuoteMessage, buildWhatsAppLink } from '@/utils/whatsapp'

export function CustomCakeRequestDetailPage() {
  const { requestId } = useParams()
  const { session } = useAuth()
  const token = session!.token
  const navigate = useNavigate()

  const [request, setRequest] = useState<CustomCakeRequestDetail | null>(null)
  const [quotedAmount, setQuotedAmount] = useState('')
  const [isSaving, setIsSaving] = useState(false)

  const load = async () => {
    if (!requestId) return
    const { request } = await getCustomCakeRequest(token, requestId)
    setRequest(request)
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestId])

  if (!request) return <p className="text-cocoa/60">Loading…</p>

  const handleQuote = async () => {
    if (!quotedAmount) return
    setIsSaving(true)
    try {
      await quoteCustomCakeRequest(token, request.id, { quotedAmount })
      setQuotedAmount('')
      await load()
    } finally {
      setIsSaving(false)
    }
  }

  const handleReject = async () => {
    setIsSaving(true)
    try {
      await rejectCustomCakeRequest(token, request.id)
      await load()
    } finally {
      setIsSaving(false)
    }
  }

  const handleCancel = async () => {
    setIsSaving(true)
    try {
      await cancelCustomCakeRequest(token, request.id)
      await load()
    } finally {
      setIsSaving(false)
    }
  }

  // Build the link + open it synchronously within the click handler (not after
  // an awaited request) so the browser doesn't block the popup.
  const handleSendPaymentLink = () => {
    const paymentLink = `https://pay.sourlemon.example/checkout/${request.id}`
    const message = buildCustomCakeQuoteMessage(request, paymentLink)
    const link = buildWhatsAppLink(request.whatsappNumber ?? request.phoneNumber, message)
    window.open(link, '_blank', 'noreferrer')
    void sendCustomCakePaymentLink(token, request.id)
  }

  return (
    <div>
      <PageHeader
        title="Custom cake request"
        action={
          <Button variant="outline" onClick={() => navigate('/custom-cakes')}>
            Back to requests
          </Button>
        }
      />

      <div className="grid gap-6 md:grid-cols-2">
        <section className="rounded-xl border border-cocoa/10 bg-white p-5">
          <h2 className="mb-3 font-display text-lg font-bold">Request</h2>
          <StatusBadge label={request.status} tone={customCakeStatusTone(request.status)} />
          <p className="mt-3 font-semibold">{request.customerName}</p>
          <p className="text-sm text-cocoa/70">{request.phoneNumber}</p>
          <p className="mt-2 text-sm text-cocoa/70">Occasion: {request.occasion}</p>
          <p className="text-sm text-cocoa/70">Size: {request.requestedSize}</p>
          {request.notes ? <p className="mt-3 text-sm italic text-cocoa/60">"{request.notes}"</p> : null}

          {request.images.length > 0 ? (
            <div className="mt-4 flex flex-wrap gap-2">
              {request.images.map((image) => (
                <img key={image.id} src={image.url} alt="Reference" className="h-20 w-20 rounded-lg object-cover" />
              ))}
            </div>
          ) : null}
        </section>

        <section className="rounded-xl border border-cocoa/10 bg-white p-5">
          <h2 className="mb-3 font-display text-lg font-bold">Quote &amp; actions</h2>

          {request.quotedAmount ? (
            <p className="mb-3 text-sm text-cocoa/70">
              Quoted: {request.currency} {request.quotedAmount}
            </p>
          ) : null}

          {['submitted', 'quoted'].includes(request.status) ? (
            <div className="mb-4 flex flex-wrap items-center gap-2">
              <input
                value={quotedAmount}
                onChange={(event) => setQuotedAmount(event.target.value)}
                placeholder="Quote amount (GHS)"
                className="rounded-lg border border-cocoa/20 px-3 py-2 text-sm"
              />
              <Button size="md" disabled={!quotedAmount || isSaving} onClick={handleQuote}>
                {request.quotedAmount ? 'Update quote' : 'Send quote'}
              </Button>
            </div>
          ) : null}

          {request.status === 'quoted' || request.status === 'awaiting_payment' ? (
            <Button className="mb-3 w-full" onClick={handleSendPaymentLink}>
              Send payment link via WhatsApp
            </Button>
          ) : null}

          {['submitted', 'quoted'].includes(request.status) ? (
            <div className="flex gap-3">
              <button className="text-sm font-semibold text-cocoa/60" disabled={isSaving} onClick={handleCancel}>
                Cancel request
              </button>
              <button className="text-sm font-semibold text-flame" disabled={isSaving} onClick={handleReject}>
                Reject request
              </button>
            </div>
          ) : null}
        </section>
      </div>
    </div>
  )
}
