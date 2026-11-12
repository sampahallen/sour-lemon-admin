import { useEffect, useState } from 'react'
import { PageHeader } from '@/components/ui/PageHeader'
import { ToggleSwitch } from '@/components/ui/ToggleSwitch'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { useAuth } from '@/auth/authContext'
import { listSiteSections, updateSiteSection, type SiteSection } from '@/api/siteSections'

export function SiteSectionsPage() {
  const { session } = useAuth()
  const token = session!.token

  const [sections, setSections] = useState<SiteSection[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = async () => {
    try {
      const { sections } = await listSiteSections(token)
      setSections(sections)
      setError(null)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not load sections.')
    }
  }

  useEffect(() => {
    refresh().finally(() => setIsLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const toggleSection = async (section: SiteSection, input: { isEnabled?: boolean; showComingSoon?: boolean }) => {
    try {
      await updateSiteSection(token, section.id, input)
      await refresh()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not update this section.')
    }
  }

  if (isLoading) return <p className="text-cocoa/60">Loading…</p>

  return (
    <div>
      <PageHeader title="Sections" />
      <p className="mb-6 max-w-2xl text-sm leading-relaxed text-cocoa/65">
        Choose how each part of the storefront appears to customers. Changes take effect when you switch a section.
      </p>

      {error ? (
        <p className="mb-4 rounded-lg bg-flame/10 px-3 py-2 text-sm font-semibold text-flame">{error}</p>
      ) : null}

      {sections.length === 0 ? (
        <div className="rounded-xl border border-cocoa/10 bg-white p-8 text-center text-cocoa/60">
          {error ? 'Try refreshing the page.' : 'No sections yet.'}
        </div>
      ) : (
        <div className="flex flex-col divide-y divide-cocoa/10 overflow-hidden rounded-2xl border border-cocoa/10 bg-white shadow-sm">
          {sections.map((section) => (
            <div key={section.id} className="grid gap-5 p-5 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
              <div>
                <div className="flex flex-wrap items-center gap-3"><p className="font-display text-lg font-bold">{section.name}</p><StatusBadge label={!section.isEnabled ? 'Hidden' : section.showComingSoon ? 'Coming soon' : 'Live'} tone={!section.isEnabled ? 'neutral' : section.showComingSoon ? 'warning' : 'positive'} /></div>
                <p className="mt-1 text-xs text-cocoa/55">{!section.isEnabled ? 'This section is not shown to customers.' : section.showComingSoon ? 'Customers see a coming soon placeholder.' : 'Customers can open this section.'}</p>
              </div>
              <div className="flex flex-col items-start gap-3 rounded-xl bg-[#faf9f6] px-4 py-3">
                <ToggleSwitch
                  label="Enabled"
                  checked={section.isEnabled}
                  onChange={(next) => void toggleSection(section, { isEnabled: next })}
                />
                <label className="flex items-center gap-2 text-sm font-medium">
                  <input type="checkbox" className="enabled:cursor-pointer accent-flame" checked={section.showComingSoon} disabled={!section.isEnabled} onChange={(event) => void toggleSection(section, { showComingSoon: event.target.checked })} />
                  Show coming soon
                </label>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
