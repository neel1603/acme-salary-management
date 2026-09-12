import { NavLink, Outlet } from 'react-router'

const navLinkClassName = ({ isActive }) =>
  isActive ? 'font-semibold text-foreground' : 'text-muted-foreground'

export function AppShell() {
  return (
    <div>
      <header>
        <nav>
          <span>Salary Management</span>
          <NavLink to="/" className={navLinkClassName} end>
            Dashboard
          </NavLink>
          <NavLink to="/employees" className={navLinkClassName}>
            Employees
          </NavLink>
        </nav>
      </header>
      <main>
        <Outlet />
      </main>
    </div>
  )
}
