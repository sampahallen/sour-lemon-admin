import { useEffect, useState } from 'react'
import { PageHeader } from '@/components/ui/PageHeader'
import { ToggleSwitch } from '@/components/ui/ToggleSwitch'
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
      <p className="mb-4 max-w-xl text-sm text-cocoa/70">
        Turn a section on when it's ready to launch. "Coming soon" shows a placeholder for a disabled section instead
        of hiding it completely.
      </p>

      {error ? (
        <p className="mb-4 rounded-lg bg-flame/10 px-3 py-2 text-sm font-semibold text-flame">{error}</p>
      ) : null}

      {sections.length === 0 ? (
        <div className="rounded-xl border border-cocoa/10 bg-white p-8 text-center text-cocoa/60">
          {error ? 'Try refreshing the page.' : 'No sections yet.'}
        </div>
      ) : (
        <div className="flex flex-col divide-y divide-cocoa/10 rounded-xl border border-cocoa/10 bg-white">
          {sections.map((section) => (
            <div key={section.id} className="flex flex-wrap items-center justify-between gap-4 p-4">
              <p className="font-semibold">{section.name}</p>
              <div className="flex items-center gap-6">
                <ToggleSwitch
                  label="Enabled"
                  checked={section.isEnabled}
                  onChange={(next) => void toggleSection(section, { isEnabled: next })}
                />
                <ToggleSwitch
                  label="Show coming soon"
                  checked={section.showComingSoon}
                  disabled={section.isEnabled}
                  onChange={(next) => void toggleSection(section, { showComingSoon: next })}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
