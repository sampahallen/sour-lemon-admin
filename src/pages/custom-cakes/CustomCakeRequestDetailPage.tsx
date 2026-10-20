import { useCallback, useEffect, useRef, useState } from 'react'
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
  getCakePaymentLink,
  rotateCakePaymentLink,
  type CustomCakeRequestDetail,
} from '@/api/customCakeRequests'
import { customCakeStatusTone } from './customCakeStatus'
import { getCustomCakeWhatsAppOptions } from '@/api/whatsapp'
import { WhatsAppComposer } from '@/components/whatsapp/WhatsAppComposer'
import { useFormValidation, type FieldErrors } from '@/hooks/useFormValidation'
import { PaymentProofReview } from '@/components/PaymentProofReview'
import { useImagePreview } from '@/components/ui/imagePreviewContext'
import { APP_SETTING_KEYS, listAppSettings } from '@/api/appSettings'
import { useOperationsLive } from '@/components/layout/operationsLiveContext'

export function CustomCakeRequestDetailPage() {
  const { openImagePreview } = useImagePreview()
  const { requestId } = useParams()
  const { session } = useAuth()
  const token = session!.token
  const { revisions, status: liveStatus } = useOperationsLive()
  const navigate = useNavigate()

  const [request, setRequest] = useState<CustomCakeRequestDetail | null>(null)
  const [quotedAmount, setQuotedAmount] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [whatsappTemplateId, setWhatsappTemplateId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [paymentLink, setPaymentLink] = useState<string | null>(null)
  const [momoConfigured, setMomoConfigured] = useState<boolean | null>(null)
  const [momoSettingsError, setMomoSettingsError] = useState(false)
  const requestVersion = useRef(0)
  const validateQuote = (): FieldErrors<'quotedAmount'> => {
    if (!quotedAmount.trim()) return { quotedAmount: 'Enter a quote amount.' }
    if (!/^\d+(?:\.\d{1,2})?$/.test(quotedAmount.trim()) || Number(quotedAmount) < 0.01 || Number(quotedAmount) > 999_999_999.99) {
      return { quotedAmount: 'Enter an amount above zero with up to two decimal places.' }
    }
    return {}
  }
  const validation = useFormValidation<'quotedAmount'>('cake-quote', validateQuote)

  const load = useCallback(async () => {
    if (!requestId) return
    const version = ++requestVersion.current
    const { request } = await getCustomCakeRequest(token, requestId)
    if (version === requestVersion.current) {
      setRequest(request)
      setError(null)
    }
  }, [requestId, token])

  useEffect(() => {
    // Load the server-owned request when the selected ID changes.
    // oxlint-disable-next-line react/set-state-in-effect
    void load().catch((caught: unknown) => setError(caught instanceof Error ? caught.message : 'Could not load this cake request.'))
    return () => { requestVersion.current += 1 }
  }, [load])

  useEffect(() => {
    // Live revisions invalidate the current server-owned request.
    // oxlint-disable-next-line react/set-state-in-effect
    if (revisions.cakes) void load().catch((caught: unknown) => setError(caught instanceof Error ? caught.message : 'Could not refresh this cake request.'))
  }, [revisions.cakes, load])

  useEffect(() => {
    void listAppSettings(token).then(({ settings }) => {
      const values = new Map(settings.map((setting) => [setting.key, setting.value]))
      setMomoConfigured([
        APP_SETTING_KEYS.momoPaymentNumber,
        APP_SETTING_KEYS.momoRecipientName,
        APP_SETTING_KEYS.momoNetwork,
      ].every((key) => typeof values.get(key) === 'string' && String(values.get(key)).trim().length > 0))
    }).catch(() => { setMomoConfigured(false); setMomoSettingsError(true) })
  }, [token])

  const loadWhatsAppOptions = useCallback(() => {
    if (!requestId) return Promise.reject(new Error('Custom cake request not found.'))
    return getCustomCakeWhatsAppOptions(token, requestId)
  }, [requestId, token])

  if (!request) return <p className="text-cocoa/60">{error ?? 'Loading…'}</p>

  const handleQuote = async () => {
    if (!validation.submit()) return
    setIsSaving(true)
    setError(null)
    try {
      const { request: updatedRequest } = await quoteCustomCakeRequest(token, request.id, { quotedAmount })
      setRequest(updatedRequest)
      setPaymentLink(null)
      setQuotedAmount('')
      validation.reset()
      setWhatsappTemplateId('quote_ready')
    } catch (caught) {
      if (!validation.server(caught, (path) => path === 'quotedAmount' ? 'quotedAmount' : undefined)) {
        setError(caught instanceof Error ? caught.message : 'Could not save this quote.')
      }
    } finally {
      setIsSaving(false)
    }
  }

  const handleReject = async () => {
    setIsSaving(true)
    setError(null)
    try {
      await rejectCustomCakeRequest(token, request.id)
      await load()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not reject this request.')
    } finally {
      setIsSaving(false)
    }
  }

  const handleCancel = async () => {
    setIsSaving(true)
    setError(null)
    try {
      await cancelCustomCakeRequest(token, request.id)
      await load()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not cancel this request.')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div>
      <PageHeader
        title="Custom cake request"
        action={<div className="flex items-center gap-3">
          <span className={`text-xs font-semibold ${liveStatus === 'connected' ? 'text-olive' : 'text-flame'}`}>{liveStatus === 'connected' ? '● Live' : '● Reconnecting'}</span>
          <Button variant="outline" onClick={() => navigate('/custom-cakes')}>
            Back to requests
          </Button>
        </div>}
      />

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <section className="rounded-2xl border border-cocoa/10 bg-white p-5 shadow-sm sm:p-7">
          {request.quotedAmount ? <div className="mb-5"><PaymentProofReview proofs={request.paymentProofs} onReviewed={load} /></div> : null}
          <p className="mb-1 text-xs font-bold uppercase tracking-wider text-cocoa/45">Customer brief</p>
          <h2 className="mb-4 font-display text-2xl font-bold">{request.occasion || 'Custom cake'}</h2>
          <StatusBadge label={request.status} tone={customCakeStatusTone(request.status)} />
          <div className="mt-5 grid gap-4 rounded-xl bg-[#faf9f6] p-4 sm:grid-cols-2">
            <div><p className="text-xs font-bold uppercase tracking-wide text-cocoa/45">Customer</p><p className="mt-1 font-semibold">{request.customerName}</p><a className="text-sm text-flame" href={`tel:${request.phoneNumber}`}>{request.phoneNumber}</a></div>
            <div><p className="text-xs font-bold uppercase tracking-wide text-cocoa/45">Requested size</p><p className="mt-1 font-semibold">{request.requestedSize}</p></div>
          </div>
          {request.notes ? <div className="mt-5"><h3 className="text-sm font-bold">Notes</h3><p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-cocoa/70">{request.notes}</p></div> : null}

          {request.images.length > 0 ? (
            <div className="mt-6"><h3 className="mb-3 text-sm font-bold">Reference photos</h3><div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {request.images.map((image) => (
                <button key={image.id} type="button" onClick={() => openImagePreview({ src: image.url, alt: 'Cake reference supplied by customer' })} aria-label="Preview full reference photo" className="rounded-xl focus-visible:outline-2 focus-visible:outline-flame"><img src={image.url} alt="Cake reference supplied by customer" className="aspect-square w-full rounded-xl object-cover" /></button>
              ))}
            </div></div>
          ) : null}
        </section>

        <section className="rounded-2xl border border-cocoa/10 bg-white p-5 shadow-sm lg:sticky lg:top-24">
          <p className="mb-1 text-xs font-bold uppercase tracking-wider text-cocoa/45">Next step</p>
          <h2 className="mb-4 font-display text-xl font-bold">Quote &amp; actions</h2>
          {error ? <p role="alert" className="mb-3 text-sm text-flame">{error}</p> : null}

          {request.quotedAmount ? (
            <div className="mb-4 rounded-xl bg-butter/20 p-4">
              <p className="text-xs font-bold uppercase tracking-wide text-cocoa/50">Current quote</p>
              <p className="mt-1 font-display text-2xl font-bold">{request.currency} {request.quotedAmount}</p>
              {request.quoteExpiresAt ? <p className="mt-1 text-xs text-cocoa/60">Expires {new Date(request.quoteExpiresAt).toLocaleString()}</p> : null}
            </div>
          ) : null}
          {request.quotedAmount && ['quoted', 'awaiting_payment'].includes(request.status) ? <div className="mb-4 grid gap-2">
            {momoConfigured === false ? <div className="rounded-lg border border-flame/20 bg-flame/5 p-3 text-sm text-cocoa/70">
              {momoSettingsError ? 'Could not check the Mobile Money settings. Please reload this page.' : 'Set the Mobile Money number, recipient name, and network in Settings before sharing a payment link.'}{' '}
              <Button to="/settings" variant="outline" size="md" className="mt-2">Open Settings</Button>
            </div> : null}
            <Button variant="outline" disabled={momoConfigured !== true} onClick={() => void getCakePaymentLink(token, request.id).then(({ url }) => { setPaymentLink(url); setError(null) }).catch((caught: unknown) => { setPaymentLink(null); setError(caught instanceof Error ? caught.message : 'Could not get link') })}>Show payment link</Button>
            {paymentLink && <><input aria-label="Cake payment link" readOnly value={paymentLink} className="w-full rounded-lg border border-cocoa/20 p-2 text-xs" /><Button variant="outline" onClick={() => void navigator.clipboard.writeText(paymentLink)}>Copy link</Button></>}
            <button disabled={momoConfigured !== true} className="text-xs text-cocoa/50 underline disabled:cursor-not-allowed disabled:opacity-50" onClick={() => void rotateCakePaymentLink(token, request.id).then(({ url }) => { setPaymentLink(url); setError(null) }).catch((caught: unknown) => { setPaymentLink(null); setError(caught instanceof Error ? caught.message : 'Could not rotate link') })}>Revoke old link and create a new one</button>
          </div> : null}

          {['submitted', 'quoted'].includes(request.status) ? (
            <div className="mb-4 flex flex-col gap-2">
              <input
                {...validation.props('quotedAmount')}
                aria-label="Quote amount in Ghana cedis"
                value={quotedAmount}
                onChange={(event) => { setQuotedAmount(event.target.value); validation.changed('quotedAmount') }}
                placeholder="Quote amount (GHS)"
                className={`w-full rounded-lg border border-cocoa/20 px-3 py-2 text-sm ${validation.error('quotedAmount') ? 'border-flame bg-flame/5' : ''}`}
              />
              {validation.error('quotedAmount') ? <span id="cake-quote-quotedAmount-error" className="text-xs text-flame">{validation.error('quotedAmount')}</span> : null}
              <Button size="md" disabled={isSaving} onClick={handleQuote}>
                {request.quotedAmount ? 'Update quote' : 'Save quote'}
              </Button>
            </div>
          ) : null}

          <Button className="mb-4 w-full" variant="outline" accent="olive" onClick={() => setWhatsappTemplateId('')}>
            Message customer on WhatsApp
          </Button>
          {request.orderId ? <Button className="mb-4 w-full" variant="outline" accent="cocoa" to={`/orders/${request.orderId}`}>View linked order</Button> : null}

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

      {whatsappTemplateId !== null ? (
        <WhatsAppComposer
          title={`Message ${request.customerName}`}
          preferredTemplateId={whatsappTemplateId || undefined}
          loadOptions={loadWhatsAppOptions}
          onClose={() => setWhatsappTemplateId(null)}
        />
      ) : null}
    </div>
  )
}
