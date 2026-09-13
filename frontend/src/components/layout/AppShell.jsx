import { NavLink, Outlet } from 'react-router'

const NAV_LINKS = [
  { to: '/', label: 'Dashboard', end: true },
  { to: '/employees', label: 'Employees', end: false },
]

// Underline-tab styling on real NavLinks (not the shadcn Tabs primitive) -- these navigate to
// separate routes, so they stay <a> elements with normal back/forward and open-in-new-tab
// behavior instead of the panel-switching ARIA semantics a Tabs.Trigger would imply.
function navLinkClassName({ isActive }) {
  return [
    'flex items-center border-b-2 px-1 py-4 text-sm font-medium transition-colors',
    isActive
      ? 'border-primary text-foreground'
      : 'border-transparent text-muted-foreground hover:border-border hover:text-foreground',
  ].join(' ')
}

export function AppShell() {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-background">
        <div className="flex items-center justify-between px-6">
          <span className="text-lg font-semibold">Salary Management</span>
          <nav className="-mb-px flex gap-6">
            {NAV_LINKS.map(({ to, label, end }) => (
              <NavLink key={to} to={to} end={end} className={navLinkClassName}>
                {label}
              </NavLink>
            ))}
          </nav>
        </div>
      </header>
      <main>
        <Outlet />
      </main>
    </div>
  )
}
