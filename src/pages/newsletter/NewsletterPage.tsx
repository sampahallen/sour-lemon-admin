import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { useAuth } from '@/auth/authContext'
import { listAppSettings, APP_SETTING_KEYS } from '@/api/appSettings'
import { listSubscribers, suppressSubscriber, type Subscriber } from '@/api/newsletter'
import { Button } from '@/components/ui/Button'
import { PageHeader } from '@/components/ui/PageHeader'

const inputClass = 'w-full rounded-xl border border-cocoa/25 bg-white px-3 py-2.5 text-sm outline-none focus:border-flame'
const readableError = (error: unknown) => error instanceof Error ? error.message : 'Something went wrong.'

export function NewsletterPage() {
  const { session } = useAuth()
  const token = session!.token
  const [subscribers, setSubscribers] = useState<Subscriber[]>([])
  const [counts, setCounts] = useState<Record<string, number>>({})
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [notifyEnabled, setNotifyEnabled] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    void listAppSettings(token).then(({ settings }) => {
      setNotifyEnabled(settings.find((setting) => setting.key === APP_SETTING_KEYS.dropNotificationsEnabled)?.value === true)
    }).catch((caught) => setError(readableError(caught)))
  }, [token])
  useEffect(() => {
    let active = true
    void listSubscribers(token, search, page).then((result) => {
      if (!active) return
      setSubscribers(result.subscribers)
      setCounts(result.counts)
    }).catch((caught) => { if (active) setError(readableError(caught)) })
    return () => { active = false }
  }, [token, search, page])

  const suppress = async (subscriber: Subscriber) => {
    if (!window.confirm(`Stop drop alerts to ${subscriber.email}?`)) return
    setError('')
    try {
      await suppressSubscriber(token, subscriber.id)
      const result = await listSubscribers(token, search, page)
      setSubscribers(result.subscribers)
      setCounts(result.counts)
    } catch (caught) { setError(readableError(caught)) }
  }

  return <div>
    <PageHeader title="Subscribers" />
    <section className="mb-6 rounded-2xl border border-cocoa/10 bg-butter/35 p-5 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="font-display text-lg font-bold">Automatic drop alerts</h2>
          <p className="mt-1 text-sm text-cocoa/75">New bakery treats are grouped into one email. Each new Journal story gets its own email.</p>
        </div>
        <Link to="/settings" className="rounded-full bg-cocoa px-4 py-2 text-sm font-bold text-white hover:bg-cocoa/85">
          {notifyEnabled ? 'Notifications on · Settings' : 'Notifications off · Settings'}
        </Link>
      </div>
    </section>
    {error ? <p role="alert" className="mb-4 rounded-xl bg-flame/10 p-3 text-sm text-flame">{error}</p> : null}
    <section className="rounded-2xl border border-cocoa/10 bg-white p-5 sm:p-7">
      <h2 className="font-bold">Subscriber list</h2>
      <p className="mt-1 text-sm text-cocoa/60">Confirmed {counts.confirmed ?? 0} · Pending {counts.pending ?? 0} · Unsubscribed {counts.unsubscribed ?? 0} · Suppressed {counts.suppressed ?? 0}</p>
      <label className="mt-5 block max-w-md text-sm font-semibold">Search email
        <input type="search" value={search} onChange={(event) => { setSearch(event.target.value); setPage(1) }} className={`mt-1 ${inputClass}`} />
      </label>
      <div className="mt-5 overflow-x-auto"><table className="w-full min-w-[520px] text-left text-sm">
        <thead><tr className="border-b border-cocoa/15"><th className="py-3">Email</th><th>Status</th><th>Confirmed</th><th>Action</th></tr></thead>
        <tbody>{subscribers.map((subscriber) => <tr key={subscriber.id} className="border-b border-cocoa/10">
          <td className="py-3">{subscriber.email}</td><td className="capitalize">{subscriber.status}</td>
          <td>{subscriber.confirmed_at ? new Date(subscriber.confirmed_at).toLocaleDateString() : '—'}</td>
          <td>{subscriber.status !== 'suppressed' ? <button type="button" onClick={() => void suppress(subscriber)} className="font-semibold text-flame hover:underline">Suppress</button> : '—'}</td>
        </tr>)}</tbody>
      </table></div>
      <div className="mt-5 flex items-center gap-4"><Button variant="outline" onClick={() => setPage((value) => Math.max(1, value - 1))} disabled={page === 1}>Previous</Button>
        <span className="text-sm">Page {page}</span><Button variant="outline" onClick={() => setPage((value) => value + 1)} disabled={subscribers.length < 25}>Next</Button></div>
    </section>
  </div>
}
