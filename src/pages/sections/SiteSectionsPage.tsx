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

  const refresh = async () => {
    const { sections } = await listSiteSections(token)
    setSections(sections)
  }

  useEffect(() => {
    refresh().finally(() => setIsLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (isLoading) return <p className="text-cocoa/60">Loading…</p>

  return (
    <div>
      <PageHeader title="Sections" />
      <p className="mb-4 max-w-xl text-sm text-cocoa/70">
        Turn a section on when it's ready to launch. "Coming soon" shows a placeholder for a disabled section instead
        of hiding it completely.
      </p>

      <div className="flex flex-col divide-y divide-cocoa/10 rounded-xl border border-cocoa/10 bg-white">
        {sections.map((section) => (
          <div key={section.id} className="flex flex-wrap items-center justify-between gap-4 p-4">
            <p className="font-semibold">{section.name}</p>
            <div className="flex items-center gap-6">
              <ToggleSwitch
                label="Enabled"
                checked={section.isEnabled}
                onChange={async (next) => {
                  await updateSiteSection(token, section.id, { isEnabled: next })
                  await refresh()
                }}
              />
              <ToggleSwitch
                label="Show coming soon"
                checked={section.showComingSoon}
                disabled={section.isEnabled}
                onChange={async (next) => {
                  await updateSiteSection(token, section.id, { showComingSoon: next })
                  await refresh()
                }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
