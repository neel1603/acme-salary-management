import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useLookups } from '@/hooks/useLookups'

const EMPLOYMENT_STATUSES = ['Active', 'Terminated', 'On Leave', 'All']

export function FilterBar({ filters, onFiltersChange }) {
  const { countries, departments } = useLookups()

  function updateFilter(key, value) {
    onFiltersChange({ ...filters, [key]: value })
  }

  return (
    <div className="flex flex-wrap items-end gap-3">
      <div>
        <label htmlFor="filter-department" className="mb-1 block text-sm text-muted-foreground">
          Department
        </label>
        <Select
          value={filters.department_id ? String(filters.department_id) : 'all'}
          onValueChange={(value) =>
            updateFilter('department_id', value === 'all' ? undefined : Number(value))
          }
        >
          <SelectTrigger id="filter-department">
            <SelectValue placeholder="All Departments" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Departments</SelectItem>
            {departments.data?.map((department) => (
              <SelectItem key={department.id} value={String(department.id)}>
                {department.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div>
        <label htmlFor="filter-country" className="mb-1 block text-sm text-muted-foreground">
          Country
        </label>
        <Select
          value={filters.country_id ? String(filters.country_id) : 'all'}
          onValueChange={(value) =>
            updateFilter('country_id', value === 'all' ? undefined : Number(value))
          }
        >
          <SelectTrigger id="filter-country">
            <SelectValue placeholder="All Countries" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Countries</SelectItem>
            {countries.data?.map((country) => (
              <SelectItem key={country.id} value={String(country.id)}>
                {country.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div>
        <label htmlFor="filter-status" className="mb-1 block text-sm text-muted-foreground">
          Status
        </label>
        <Select
          value={filters.employment_status}
          onValueChange={(value) => updateFilter('employment_status', value)}
        >
          <SelectTrigger id="filter-status">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {EMPLOYMENT_STATUSES.map((status) => (
              <SelectItem key={status} value={status}>
                {status}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div>
        <label htmlFor="filter-hire-date-from" className="mb-1 block text-sm text-muted-foreground">
          Hired from
        </label>
        <input
          id="filter-hire-date-from"
          type="date"
          className="h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm"
          value={filters.hire_date_from ?? ''}
          onChange={(event) => updateFilter('hire_date_from', event.target.value || undefined)}
        />
      </div>

      <div>
        <label htmlFor="filter-hire-date-to" className="mb-1 block text-sm text-muted-foreground">
          Hired to
        </label>
        <input
          id="filter-hire-date-to"
          type="date"
          className="h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm"
          value={filters.hire_date_to ?? ''}
          onChange={(event) => updateFilter('hire_date_to', event.target.value || undefined)}
        />
      </div>
    </div>
  )
}
