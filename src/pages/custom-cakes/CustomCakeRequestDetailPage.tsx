import { useCallback, useEffect, useState } from 'react'
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
  type CustomCakeRequestDetail,
} from '@/api/customCakeRequests'
import { customCakeStatusTone } from './customCakeStatus'
import { getCustomCakeWhatsAppOptions } from '@/api/whatsapp'
import { WhatsAppComposer } from '@/components/whatsapp/WhatsAppComposer'
import { useFormValidation, type FieldErrors } from '@/hooks/useFormValidation'

export function CustomCakeRequestDetailPage() {
  const { requestId } = useParams()
  const { session } = useAuth()
  const token = session!.token
  const navigate = useNavigate()

  const [request, setRequest] = useState<CustomCakeRequestDetail | null>(null)
  const [quotedAmount, setQuotedAmount] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [whatsappTemplateId, setWhatsappTemplateId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const validateQuote = (): FieldErrors<'quotedAmount'> => {
    if (!quotedAmount.trim()) return { quotedAmount: 'Enter a quote amount.' }
    if (!/^\d+(?:\.\d{1,2})?$/.test(quotedAmount.trim()) || Number(quotedAmount) < 0.01 || Number(quotedAmount) > 999_999_999.99) {
      return { quotedAmount: 'Enter an amount above zero with up to two decimal places.' }
    }
    return {}
  }
  const validation = useFormValidation<'quotedAmount'>('cake-quote', validateQuote)

  const load = async () => {
    if (!requestId) return
    const { request } = await getCustomCakeRequest(token, requestId)
    setRequest(request)
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestId])

  const loadWhatsAppOptions = useCallback(() => {
    if (!requestId) return Promise.reject(new Error('Custom cake request not found.'))
    return getCustomCakeWhatsAppOptions(token, requestId)
  }, [requestId, token])

  if (!request) return <p className="text-cocoa/60">Loading…</p>

  const handleQuote = async () => {
    if (!validation.submit()) return
    setIsSaving(true)
    setError(null)
    try {
      const { request: updatedRequest } = await quoteCustomCakeRequest(token, request.id, { quotedAmount })
      setRequest(updatedRequest)
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
          {error ? <p role="alert" className="mb-3 text-sm text-flame">{error}</p> : null}

          {request.quotedAmount ? (
            <p className="mb-3 text-sm text-cocoa/70">
              Quoted: {request.currency} {request.quotedAmount}
            </p>
          ) : null}

          {['submitted', 'quoted'].includes(request.status) ? (
            <div className="mb-4 flex flex-wrap items-center gap-2">
              <input
                {...validation.props('quotedAmount')}
                aria-label="Quote amount in Ghana cedis"
                value={quotedAmount}
                onChange={(event) => { setQuotedAmount(event.target.value); validation.changed('quotedAmount') }}
                placeholder="Quote amount (GHS)"
                className={`rounded-lg border border-cocoa/20 px-3 py-2 text-sm ${validation.error('quotedAmount') ? 'border-flame bg-flame/5' : ''}`}
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
