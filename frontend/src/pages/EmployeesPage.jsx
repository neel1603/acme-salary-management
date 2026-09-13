import { useState } from 'react'
import { EmployeeFilterBar } from '@/components/employees/EmployeeFilterBar'
import { EmployeePagination } from '@/components/employees/EmployeePagination'
import { EmployeeTable } from '@/components/employees/EmployeeTable'

const DEFAULT_PARAMS = {
  page: 1,
  page_size: 25,
  sort_by: 'last_name',
  sort_dir: 'asc',
  employment_status: 'Active',
}

export function EmployeesPage() {
  const [params, setParams] = useState(DEFAULT_PARAMS)

  // Filter/search/page-size changes reset to page 1 -- staying on, say, page 12 after narrowing a
  // filter (or switching to 100-row pages) can land past the end of the new, smaller result.
  // Sort changes deliberately don't: re-sorting the same result set has no such out-of-range risk.
  function handleFiltersChange(nextFilters) {
    setParams({ ...nextFilters, page: 1 })
  }

  function handleSortChange(columnKey) {
    setParams((prev) => ({
      ...prev,
      sort_by: columnKey,
      sort_dir: prev.sort_by === columnKey && prev.sort_dir === 'asc' ? 'desc' : 'asc',
    }))
  }

  function handlePageChange(page) {
    setParams((prev) => ({ ...prev, page }))
  }

  function handlePageSizeChange(pageSize) {
    setParams((prev) => ({ ...prev, page_size: pageSize, page: 1 }))
  }

  return (
    <div className="space-y-6 p-6">
      <h1 className="text-2xl font-semibold">Employees</h1>
      <EmployeeFilterBar filters={params} onFiltersChange={handleFiltersChange} />
      <EmployeeTable
        params={params}
        onSortChange={handleSortChange}
        onPageChange={handlePageChange}
        onView={() => {}}
        onEdit={() => {}}
        onDeactivate={() => {}}
      />
      <EmployeePagination params={params} onPageChange={handlePageChange} onPageSizeChange={handlePageSizeChange} />
    </div>
  )
}
