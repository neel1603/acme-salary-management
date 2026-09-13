import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { DeactivateEmployeeDialog } from '@/components/employees/DeactivateEmployeeDialog'
import { EmployeeDetailDialog } from '@/components/employees/EmployeeDetailDialog'
import { EmployeeFilterBar } from '@/components/employees/EmployeeFilterBar'
import { EmployeeFormDialog } from '@/components/employees/EmployeeFormDialog'
import { EmployeePagination } from '@/components/employees/EmployeePagination'
import { EmployeeTable } from '@/components/employees/EmployeeTable'

const DEFAULT_PARAMS = {
  page: 1,
  page_size: 25,
  sort_by: 'last_name',
  sort_dir: 'asc',
  employment_status: 'Active',
}

const CLOSED_DIALOG = { mode: 'closed' }

export function EmployeesPage() {
  const [params, setParams] = useState(DEFAULT_PARAMS)
  const [dialog, setDialog] = useState(CLOSED_DIALOG)

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

  function closeDialog() {
    setDialog(CLOSED_DIALOG)
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Employees</h1>
        <Button onClick={() => setDialog({ mode: 'create' })}>Add Employee</Button>
      </div>

      <EmployeeFilterBar filters={params} onFiltersChange={handleFiltersChange} />
      <EmployeeTable
        params={params}
        onSortChange={handleSortChange}
        onPageChange={handlePageChange}
        onView={(employeeId) => setDialog({ mode: 'view', employeeId })}
        onEdit={(employeeId) => setDialog({ mode: 'edit', employeeId })}
        onDeactivate={(employeeId, employeeName) => setDialog({ mode: 'deactivate', employeeId, employeeName })}
      />
      <EmployeePagination params={params} onPageChange={handlePageChange} onPageSizeChange={handlePageSizeChange} />

      {/* At most one dialog is ever mounted, keyed by employee id -- this discards stale form
          values and error banners on every open, rather than resetting them by hand. */}
      {dialog.mode === 'view' && (
        <EmployeeDetailDialog key={dialog.employeeId} employeeId={dialog.employeeId} open onOpenChange={closeDialog} />
      )}
      {(dialog.mode === 'edit' || dialog.mode === 'create') && (
        <EmployeeFormDialog
          key={dialog.employeeId ?? 'new'}
          mode={dialog.mode}
          employeeId={dialog.employeeId}
          open
          onOpenChange={closeDialog}
        />
      )}
      {dialog.mode === 'deactivate' && (
        <DeactivateEmployeeDialog
          key={dialog.employeeId}
          employeeId={dialog.employeeId}
          employeeName={dialog.employeeName}
          open
          onOpenChange={closeDialog}
        />
      )}
    </div>
  )
}
