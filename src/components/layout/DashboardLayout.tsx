import { useState } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router'
import { cn } from '@/utils/cn'
import { useAuth } from '@/auth/authContext'

const NAV_GROUPS = [
  {
    label: 'Operations',
    items: [
      { to: '/orders', label: 'Orders' },
      { to: '/custom-cakes', label: 'Custom Cakes' },
      { to: '/delivery-areas', label: 'Delivery Areas' },
    ],
  },
  {
    label: 'Storefront',
    items: [
      { to: '/bakery', label: 'Bakery' },
      { to: '/shop', label: 'Shop' },
      { to: '/journal', label: 'Journal' },
      { to: '/sections', label: 'Sections' },
    ],
  },
  {
    label: 'System',
    items: [{ to: '/settings', label: 'Settings' }],
  },
]

export function DashboardLayout() {
  const { session, signOut } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const [signOutError, setSignOutError] = useState<string | null>(null)

  const handleSignOut = async () => {
    setSignOutError(null)
    try {
      await signOut()
      navigate('/signin', { replace: true })
    } catch {
      setSignOutError('Could not sign out while disconnected. Please try again.')
    }
  }

  return (
    <div className="flex min-h-screen bg-[#f7f6f2]">
      {isSidebarOpen ? (
        <button
          aria-label="Close menu"
          className="fixed inset-0 z-30 bg-cocoa/40 md:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      ) : null}

      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-40 flex w-64 flex-col overflow-y-auto border-r border-cocoa/10 bg-[#fffefa] p-4 transition-transform md:translate-x-0',
          isSidebarOpen ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        <div className="mb-8 flex items-center gap-3 px-2 py-2">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-flame font-display text-xl font-extrabold text-white">S</span>
          <span className="leading-tight"><strong className="block font-display text-lg text-cocoa">Sour Lemon</strong><span className="text-[11px] font-bold uppercase tracking-[0.16em] text-cocoa/45">Owner workspace</span></span>
        </div>
        <nav aria-label="Admin navigation" className="flex flex-1 flex-col gap-8">
          {NAV_GROUPS.map((group) => (
            <section key={group.label} aria-labelledby={`nav-${group.label.toLowerCase()}`}>
              <h2
                id={`nav-${group.label.toLowerCase()}`}
                className="mb-2 px-3 text-[10px] font-bold uppercase tracking-[0.18em] text-cocoa/40"
              >
                {group.label}
              </h2>
              <div className="flex flex-col gap-1">
                {group.items.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    onClick={() => setIsSidebarOpen(false)}
                    className={({ isActive }) =>
                      cn(
                        'rounded-lg px-3 py-2.5 text-sm font-semibold transition-colors',
                        isActive ? 'bg-flame/10 text-[#b8441f]' : 'text-cocoa/65 hover:bg-cocoa/5 hover:text-cocoa',
                      )
                    }
                  >
                    {item.label}
                  </NavLink>
                ))}
              </div>
            </section>
          ))}
        </nav>
        {signOutError ? <p role="alert" className="px-3 text-xs text-flame">{signOutError}</p> : null}
        <button
          onClick={() => void handleSignOut()}
          className="mt-4 rounded-lg border-t border-cocoa/10 px-3 py-3 text-left text-sm font-semibold text-cocoa/60 hover:bg-cocoa/5"
        >
          Sign out
        </button>
      </aside>

      <div className="flex min-h-screen min-w-0 flex-1 flex-col md:pl-64">
        <header className="sticky top-0 z-20 flex min-h-16 items-center justify-between border-b border-cocoa/10 bg-white/95 px-4 py-3 backdrop-blur md:px-8">
          <button
            aria-label="Open menu"
            className="rounded-lg p-2 hover:bg-cocoa/5 md:hidden"
            onClick={() => setIsSidebarOpen(true)}
          >
            ☰
          </button>
          <div className="hidden truncate text-xs font-semibold uppercase tracking-[0.12em] text-cocoa/45 md:block">
            {location.pathname.split('/')[1]?.replace(/-/g, ' ') || 'Orders'}
          </div>
          <div className="flex items-center gap-3 text-sm text-cocoa/70">
            <span className="hidden sm:inline">{session?.user.name}</span>
            <span className="grid h-9 w-9 place-items-center rounded-full bg-cream font-bold text-cocoa" aria-label={`Signed in as ${session?.user.name ?? 'admin'}`}>
              {session?.user.name?.charAt(0).toUpperCase() ?? 'A'}
            </span>
          </div>
        </header>

        <main className="mx-auto w-full max-w-[1600px] flex-1 p-4 md:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
