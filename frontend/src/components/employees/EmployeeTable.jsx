import { ArrowDown, ArrowUp, Eye, Pencil, UserX } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useEmployees } from '@/hooks/useEmployees'
import { formatUsd } from '@/lib/money'

// Only columns in the backend's _SORT_COLUMNS allow-list are clickable, and the value sent must
// be the exact key that dict uses -- "department"/"country", not "department_name"/"country_name".
// Anything else silently falls back to sorting by last_name with no error, so this list is the
// single source of truth for what's safe to send.
const SORTABLE_COLUMNS = [
  { key: 'last_name', label: 'Name' },
  { key: 'employee_code', label: 'Employee Code' },
  { key: 'department', label: 'Department' },
  { key: 'country', label: 'Country' },
  { key: 'job_title', label: 'Job Title' },
  { key: 'job_level', label: 'Job Level' },
  { key: 'salary_usd', label: 'Salary (USD)' },
  { key: 'hire_date', label: 'Hire Date' },
]

const STATUS_BADGE_CLASSNAME = {
  Active: 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300',
  'On Leave': 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300',
  Terminated: 'bg-muted text-muted-foreground',
}

function SortableHeader({ column, sortBy, sortDir, onSortChange }) {
  const isActive = sortBy === column.key
  const DirectionIcon = sortDir === 'desc' ? ArrowDown : ArrowUp

  return (
    <TableHead>
      <button
        type="button"
        className="inline-flex items-center gap-1 hover:text-foreground"
        onClick={() => onSortChange(column.key)}
      >
        {column.label}
        {isActive && <DirectionIcon className="size-3.5" />}
      </button>
    </TableHead>
  )
}

export function EmployeeTable({ params, onSortChange, onPageChange, onView, onEdit, onDeactivate }) {
  // Params is a fresh object each render, but TanStack Query hashes query keys structurally, so
  // this dedupes against the same cache entry EmployeePagination reads via its own useEmployees
  // call -- not a second network request.
  const { data, isLoading, isError } = useEmployees(params)

  if (isError) {
    return <p role="alert">Couldn&apos;t load employees.</p>
  }

  if (isLoading) {
    return <p>Loading…</p>
  }

  const isOutOfRangePage = data.items.length === 0 && data.totalItems > 0

  return (
    <Table>
      <TableHeader>
        <TableRow>
          {SORTABLE_COLUMNS.map((column) => (
            <SortableHeader
              key={column.key}
              column={column}
              sortBy={params.sort_by}
              sortDir={params.sort_dir}
              onSortChange={onSortChange}
            />
          ))}
          {/* employment_status isn't in the backend's sortable-column allow-list -- a clickable
              header here would render a sort arrow that silently does nothing. */}
          <TableHead>Status</TableHead>
          <TableHead className="text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {isOutOfRangePage ? (
          <TableRow>
            <TableCell colSpan={SORTABLE_COLUMNS.length + 2} className="py-8 text-center text-muted-foreground">
              No employees on this page.{' '}
              <Button variant="link" className="h-auto p-0" onClick={() => onPageChange(1)}>
                Go to first page
              </Button>
            </TableCell>
          </TableRow>
        ) : data.items.length === 0 ? (
          <TableRow>
            <TableCell colSpan={SORTABLE_COLUMNS.length + 2} className="py-8 text-center text-muted-foreground">
              No employees match these filters.
            </TableCell>
          </TableRow>
        ) : (
          data.items.map((employee) => (
            <TableRow key={employee.id}>
              <TableCell>
                {employee.firstName} {employee.lastName}
              </TableCell>
              <TableCell>{employee.employeeCode}</TableCell>
              <TableCell>{employee.departmentName}</TableCell>
              <TableCell>{employee.countryName}</TableCell>
              <TableCell>{employee.jobTitle}</TableCell>
              <TableCell>{employee.jobLevel}</TableCell>
              <TableCell>{formatUsd(employee.salaryUsd)}</TableCell>
              <TableCell>{employee.hireDate}</TableCell>
              <TableCell>
                <Badge className={STATUS_BADGE_CLASSNAME[employee.employmentStatus] ?? ''}>
                  {employee.employmentStatus}
                </Badge>
              </TableCell>
              <TableCell className="text-right">
                <div className="flex items-center justify-end gap-1">
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`View ${employee.firstName} ${employee.lastName}`}
                    onClick={() => onView(employee.id)}
                  >
                    <Eye />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Edit ${employee.firstName} ${employee.lastName}`}
                    onClick={() => onEdit(employee.id)}
                  >
                    <Pencil />
                  </Button>
                  {employee.employmentStatus !== 'Terminated' && (
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Deactivate ${employee.firstName} ${employee.lastName}`}
                      onClick={() => onDeactivate(employee.id)}
                    >
                      <UserX />
                    </Button>
                  )}
                </div>
              </TableCell>
            </TableRow>
          ))
        )}
      </TableBody>
    </Table>
  )
}
