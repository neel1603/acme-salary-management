import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useEmployees } from '@/hooks/useEmployees'

const PAGE_SIZE_OPTIONS = [25, 50, 100]

export function EmployeePagination({ params, onPageChange, onPageSizeChange }) {
  // Same query key as EmployeeTable's useEmployees(params) call -- this reads the shared cache
  // entry rather than firing a second request, and keeps page/count math out of EmployeesPage.
  const { data } = useEmployees(params)

  if (!data) {
    return null
  }

  const { page, pageSize, totalItems, totalPages } = data
  const isFirstPage = page <= 1
  // An out-of-range page (page > totalPages, e.g. after narrowing a filter) has no "last page" to
  // disable Next against -- totalPages still reflects the *new* filtered count, so this stays
  // correct rather than leaving Next enabled forever once the page is already past the end.
  const isLastPage = page >= totalPages

  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <p className="text-sm text-muted-foreground">
        Page {page} of {Math.max(totalPages, 1)} ({totalItems} total)
      </p>

      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1">
          <Button variant="outline" size="sm" disabled={isFirstPage} onClick={() => onPageChange(page - 1)}>
            Prev
          </Button>
          <Button variant="outline" size="sm" disabled={isLastPage} onClick={() => onPageChange(page + 1)}>
            Next
          </Button>
        </div>

        <Select value={String(pageSize)} onValueChange={(value) => onPageSizeChange(Number(value))}>
          <SelectTrigger className="w-28">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PAGE_SIZE_OPTIONS.map((size) => (
              <SelectItem key={size} value={String(size)}>
                {size} / page
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  )
}
