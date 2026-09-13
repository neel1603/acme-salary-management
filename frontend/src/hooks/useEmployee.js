import { useQuery } from '@tanstack/react-query'
import { fetchEmployee } from '@/api/employees'
import { queryKeys } from '@/lib/queryKeys'

// `enabled` should be gated on the consuming dialog's open state (and, for edit, a real id) so
// no request fires until the dialog is actually opened.
export function useEmployee(id, { enabled = true } = {}) {
  return useQuery({
    queryKey: queryKeys.employees.detail(id),
    queryFn: () => fetchEmployee(id),
    enabled: enabled && id != null,
  })
}
