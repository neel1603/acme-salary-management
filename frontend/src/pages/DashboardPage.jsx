import { useState } from 'react'
import { CountryBreakdownChart } from '@/components/dashboard/CountryBreakdownChart'
import { DepartmentBreakdownChart } from '@/components/dashboard/DepartmentBreakdownChart'
import { FilterBar } from '@/components/dashboard/FilterBar'
import { KpiCardGrid } from '@/components/dashboard/KpiCardGrid'

const DEFAULT_FILTERS = { employment_status: 'Active' }

export function DashboardPage() {
  const [filters, setFilters] = useState(DEFAULT_FILTERS)

  return (
    <div className="space-y-6 p-6">
      <h1 className="text-2xl font-semibold">Dashboard</h1>
      <FilterBar filters={filters} onFiltersChange={setFilters} />
      <KpiCardGrid filters={filters} />
      <div className="grid gap-6 md:grid-cols-2">
        <section>
          <h2 className="mb-2 text-lg font-medium">By Department</h2>
          <DepartmentBreakdownChart filters={filters} />
        </section>
        <section>
          <h2 className="mb-2 text-lg font-medium">By Country</h2>
          <CountryBreakdownChart filters={filters} />
        </section>
      </div>
    </div>
  )
}
