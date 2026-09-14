import { lazy, Suspense } from 'react'
import { Route, Routes } from 'react-router'
import { AppShell } from '@/components/layout/AppShell'
import { NotFoundPage } from '@/pages/NotFoundPage'

// Lazy per-route: DashboardPage pulls in recharts (by far the heaviest dependency in the app,
// per a bundle-visualizer pass), which a visitor who only ever uses /employees shouldn't have to
// download, and vice versa for EmployeesPage's own chunk.
const DashboardPage = lazy(() =>
  import('@/pages/DashboardPage').then((module) => ({ default: module.DashboardPage })),
)
const EmployeesPage = lazy(() =>
  import('@/pages/EmployeesPage').then((module) => ({ default: module.EmployeesPage })),
)

export function App() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route
          index
          element={
            <Suspense fallback={null}>
              <DashboardPage />
            </Suspense>
          }
        />
        <Route
          path="employees"
          element={
            <Suspense fallback={null}>
              <EmployeesPage />
            </Suspense>
          }
        />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  )
}
