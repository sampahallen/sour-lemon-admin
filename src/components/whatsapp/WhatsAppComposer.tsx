import { useEffect, useRef, useState } from 'react'
import type { WhatsAppOptions } from '@/api/whatsapp'
import { Button } from '@/components/ui/Button'
import { buildWhatsAppLink } from '@/utils/whatsapp'

const MESSAGE_MAX_LENGTH = 2_000

interface WhatsAppComposerProps {
  title: string
  preferredTemplateId?: string
  loadOptions: () => Promise<WhatsAppOptions>
  onClose: () => void
}

export function WhatsAppComposer({
  title,
  preferredTemplateId,
  loadOptions,
  onClose,
}: WhatsAppComposerProps) {
  const dialogRef = useRef<HTMLDivElement>(null)
  const [options, setOptions] = useState<WhatsAppOptions | null>(null)
  const [selectedTemplateId, setSelectedTemplateId] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    loadOptions()
      .then((loaded) => {
        if (!active) return
        const preferred = loaded.templates.find((item) => item.id === preferredTemplateId)
          ?? loaded.templates.find((item) => item.id === loaded.recommendedTemplateId)
          ?? loaded.templates[0]
        setOptions(loaded)
        setSelectedTemplateId(preferred?.id ?? '')
        setMessage(preferred?.message ?? '')
      })
      .catch((caught: unknown) => {
        if (active) setError(caught instanceof Error ? caught.message : 'Could not prepare WhatsApp options.')
      })
    return () => {
      active = false
    }
  }, [loadOptions, preferredTemplateId])

  useEffect(() => {
    const previouslyFocused = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose()
        return
      }
      if (event.key !== 'Tab') return
      const focusable = dialogRef.current?.querySelectorAll<HTMLElement>(
        'button:not([disabled]), select:not([disabled]), textarea:not([disabled]), input:not([disabled]), [href]',
      )
      if (!focusable?.length) return
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }
    dialogRef.current?.querySelector<HTMLElement>('button')?.focus()
    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      previouslyFocused?.focus()
    }
  }, [onClose])

  const selectedTemplate = options?.templates.find((item) => item.id === selectedTemplateId)
  const trimmedMessage = message.trim()
  const messageError = !trimmedMessage
    ? 'Write a message before opening WhatsApp.'
    : message.length > MESSAGE_MAX_LENGTH ? `Keep the message under ${MESSAGE_MAX_LENGTH.toLocaleString()} characters.` : null

  const chooseTemplate = (templateId: string) => {
    const next = options?.templates.find((item) => item.id === templateId)
    if (!next) return
    setSelectedTemplateId(templateId)
    setMessage(next.message)
    setError(null)
  }

  const openWhatsApp = () => {
    if (!options || messageError) return
    const popup = window.open(buildWhatsAppLink(options.recipient.number, trimmedMessage), '_blank')
    if (!popup) {
      setError('Allow pop-ups for this site, then try opening WhatsApp again.')
      return
    }
    popup.opener = null
    onClose()
  }

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-cocoa/45 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="whatsapp-composer-title"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div ref={dialogRef} className="w-full max-w-xl overflow-hidden rounded-2xl bg-cream shadow-[var(--shadow-chunky)]">
        <div className="flex items-start justify-between gap-4 border-b border-cocoa/10 bg-white px-5 py-4">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-olive">WhatsApp</p>
            <h2 id="whatsapp-composer-title" className="mt-0.5 font-display text-xl font-bold text-cocoa">{title}</h2>
          </div>
          <button type="button" onClick={onClose} className="rounded-full px-2 py-1 text-xl text-cocoa/40 hover:bg-cocoa/5 hover:text-cocoa" aria-label="Close WhatsApp composer">×</button>
        </div>

        <div className="p-5">
          {error && !options ? (
            <div role="alert" className="rounded-xl border border-flame/20 bg-flame/5 p-4 text-sm text-flame">
              <p className="font-semibold">Could not prepare this message.</p>
              <p className="mt-1">{error}</p>
            </div>
          ) : !options ? (
            <p className="py-8 text-center text-sm text-cocoa/50">Preparing message options…</p>
          ) : (
            <>
              <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-xl bg-olive/8 px-3 py-2.5 text-sm">
                <span className="text-cocoa/55">Sending to</span>
                <span className="font-semibold text-cocoa">{options.recipient.number}</span>
                <span className="w-full text-xs text-cocoa/40">
                  {options.recipient.source === 'whatsapp' ? 'Customer’s WhatsApp number' : 'Using the customer’s phone number'}
                </span>
              </div>

              <label htmlFor="whatsapp-template" className="text-sm font-semibold text-cocoa">Message type</label>
              <select
                id="whatsapp-template"
                autoFocus
                value={selectedTemplateId}
                onChange={(event) => chooseTemplate(event.target.value)}
                className="mt-1 w-full rounded-lg border border-cocoa/20 bg-white px-3 py-2.5 text-sm outline-none focus:border-flame focus:ring-2 focus:ring-flame/15"
              >
                {options.templates.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
              </select>

              <div className="mt-4 flex items-center justify-between gap-3">
                <label htmlFor="whatsapp-message" className="text-sm font-semibold text-cocoa">Message</label>
                <button
                  type="button"
                  disabled={!selectedTemplate}
                  onClick={() => selectedTemplate && setMessage(selectedTemplate.message)}
                  className="text-xs font-semibold text-cocoa/45 hover:text-flame disabled:opacity-40"
                >
                  Reset preset
                </button>
              </div>
              <textarea
                id="whatsapp-message"
                rows={8}
                value={message}
                onChange={(event) => {
                  setMessage(event.target.value)
                  setError(null)
                }}
                aria-invalid={Boolean(messageError)}
                className="mt-1 w-full resize-y rounded-xl border border-cocoa/20 bg-white px-3 py-3 text-sm leading-relaxed outline-none focus:border-flame focus:ring-2 focus:ring-flame/15"
              />
              <div className="mt-1 flex justify-between gap-3 text-xs">
                <span className={messageError ? 'text-flame' : 'text-cocoa/40'}>{messageError ?? 'You can edit this before opening WhatsApp.'}</span>
                <span className={message.length > MESSAGE_MAX_LENGTH ? 'font-semibold text-flame' : 'text-cocoa/40'}>{message.length.toLocaleString()}/{MESSAGE_MAX_LENGTH.toLocaleString()}</span>
              </div>
              {error ? <p role="alert" className="mt-3 rounded-lg bg-flame/5 px-3 py-2 text-sm font-semibold text-flame">{error}</p> : null}

              <div className="mt-5 flex flex-wrap justify-end gap-3 border-t border-cocoa/10 pt-4">
                <Button variant="outline" accent="cocoa" onClick={onClose}>Cancel</Button>
                <Button disabled={Boolean(messageError)} onClick={openWhatsApp}>Open WhatsApp</Button>
              </div>
              <p className="mt-3 text-center text-[11px] text-cocoa/35">You’ll review and press Send inside WhatsApp.</p>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
