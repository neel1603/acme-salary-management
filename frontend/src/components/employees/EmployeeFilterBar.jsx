import { X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useLookups } from '@/hooks/useLookups'
import { useDebouncedValue } from '@/lib/useDebouncedValue'

const EMPLOYMENT_STATUSES = ['Active', 'Terminated', 'On Leave', 'All']
const LABEL_CLASSNAME = 'mb-1 block text-sm font-normal text-muted-foreground'
const SELECT_TRIGGER_CLASSNAME = 'w-44'

// What "no filters applied" means, for the Clear button's visibility and its own reset target.
// Mirrors EmployeesPage's DEFAULT_PARAMS, but only the fields this component renders.
const DEFAULT_FILTERS = { department_id: undefined, country_id: undefined, employment_status: 'Active', search: undefined }

function isFiltering(filters) {
  return (
    filters.department_id !== undefined ||
    filters.country_id !== undefined ||
    filters.employment_status !== DEFAULT_FILTERS.employment_status ||
    Boolean(filters.search)
  )
}

// A new component rather than reusing the dashboard's FilterBar: EmployeeListParams has no
// hire_date_from/hire_date_to and adds `search`, which the dashboard filters don't have --
// reusing FilterBar verbatim would either send params this endpoint ignores or drop search.
export function EmployeeFilterBar({ filters, onFiltersChange }) {
  const { countries, departments } = useLookups()
  const [searchInput, setSearchInput] = useState(filters.search ?? '')
  const debouncedSearch = useDebouncedValue(searchInput, 300)

  useEffect(() => {
    const confirmedSearch = filters.search ?? ''
    if (debouncedSearch !== confirmedSearch) {
      onFiltersChange({ ...filters, search: debouncedSearch || undefined })
    }
    // Only the debounced value should trigger this -- re-running on every `filters` change would
    // refire the moment the parent's state catches up, which is exactly the round trip we're
    // trying to debounce away.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch])

  function updateFilter(key, value) {
    onFiltersChange({ ...filters, [key]: value })
  }

  function handleClear() {
    // Reset the local search text directly rather than waiting on the debounce round trip --
    // otherwise the box would keep showing stale text after filters.search has already cleared.
    setSearchInput('')
    onFiltersChange({ ...filters, ...DEFAULT_FILTERS })
  }

  return (
    <div className="flex flex-wrap items-end gap-3">
      <div>
        <Label htmlFor="employee-filter-department" className={LABEL_CLASSNAME}>
          Department
        </Label>
        <Select
          value={filters.department_id ? String(filters.department_id) : 'all'}
          onValueChange={(value) => updateFilter('department_id', value === 'all' ? undefined : Number(value))}
        >
          <SelectTrigger id="employee-filter-department" className={SELECT_TRIGGER_CLASSNAME}>
            {/* SelectValue shows the raw value ("5"), not the matching item's label -- Base UI only
                resolves a label automatically when an `items` map is passed to the Select root. */}
            <SelectValue>
              {(value) =>
                value === 'all' ? 'All Departments' : departments.data?.find((department) => String(department.id) === value)?.name
              }
            </SelectValue>
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
        <Label htmlFor="employee-filter-country" className={LABEL_CLASSNAME}>
          Country
        </Label>
        <Select
          value={filters.country_id ? String(filters.country_id) : 'all'}
          onValueChange={(value) => updateFilter('country_id', value === 'all' ? undefined : Number(value))}
        >
          <SelectTrigger id="employee-filter-country" className={SELECT_TRIGGER_CLASSNAME}>
            <SelectValue>
              {(value) => (value === 'all' ? 'All Countries' : countries.data?.find((country) => String(country.id) === value)?.name)}
            </SelectValue>
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
        <Label htmlFor="employee-filter-status" className={LABEL_CLASSNAME}>
          Status
        </Label>
        <Select value={filters.employment_status} onValueChange={(value) => updateFilter('employment_status', value)}>
          <SelectTrigger id="employee-filter-status" className={SELECT_TRIGGER_CLASSNAME}>
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

      <div className="min-w-56">
        <Label htmlFor="employee-filter-search" className={LABEL_CLASSNAME}>
          Search
        </Label>
        <div className="relative">
          <Input
            id="employee-filter-search"
            type="text"
            placeholder="Name, email, or employee code"
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            className={searchInput ? 'pr-7' : undefined}
          />
          {searchInput && (
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              aria-label="Clear search"
              className="absolute top-1/2 right-0.5 -translate-y-1/2"
              onClick={() => setSearchInput('')}
            >
              <X />
            </Button>
          )}
        </div>
      </div>

      {isFiltering(filters) && (
        <Button type="button" variant="ghost" size="sm" onClick={handleClear}>
          Clear filters
        </Button>
      )}
    </div>
  )
}
