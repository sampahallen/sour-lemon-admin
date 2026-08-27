import { useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router'
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
      { to: '/menu', label: 'Menu' },
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
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)

  const handleSignOut = () => {
    void signOut()
    navigate('/signin', { replace: true })
  }

  return (
    <div className="flex min-h-screen bg-cream">
      {isSidebarOpen ? (
        <button
          aria-label="Close menu"
          className="fixed inset-0 z-30 bg-cocoa/40 md:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      ) : null}

      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-cocoa/10 bg-white p-4 transition-transform md:static md:translate-x-0',
          isSidebarOpen ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        <div className="mb-6 px-2 text-xl font-bold text-flame">Sour Lemon</div>
        <nav aria-label="Admin navigation" className="flex flex-1 flex-col gap-10">
          {NAV_GROUPS.map((group) => (
            <section key={group.label} aria-labelledby={`nav-${group.label.toLowerCase()}`}>
              <h2
                id={`nav-${group.label.toLowerCase()}`}
                className="mb-2 px-3 text-xs font-bold uppercase tracking-widest text-cocoa/40"
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
                        'rounded-lg px-3 py-2 font-semibold transition-colors',
                        isActive ? 'bg-flame/10 text-flame' : 'text-cocoa/70 hover:bg-cocoa/5',
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
        <button
          onClick={handleSignOut}
          className="mt-4 rounded-lg px-3 py-2 text-left font-semibold text-cocoa/70 hover:bg-cocoa/5"
        >
          Sign out
        </button>
      </aside>

      <div className="flex min-h-screen flex-1 flex-col md:pl-0">
        <header className="flex items-center justify-between border-b border-cocoa/10 bg-white px-4 py-3 md:px-8">
          <button
            aria-label="Open menu"
            className="rounded-lg p-2 hover:bg-cocoa/5 md:hidden"
            onClick={() => setIsSidebarOpen(true)}
          >
            ☰
          </button>
          <div className="hidden md:block" />
          <div className="text-sm text-cocoa/70">
            Signed in as <span className="font-semibold text-cocoa">{session?.user.name}</span>
          </div>
        </header>

        <main className="flex-1 p-4 md:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
