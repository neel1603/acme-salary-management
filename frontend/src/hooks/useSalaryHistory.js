import { useQuery } from '@tanstack/react-query'
import { fetchSalaryHistory } from '@/api/employees'
import { queryKeys } from '@/lib/queryKeys'

export function useSalaryHistory(id, { enabled = true } = {}) {
  return useQuery({
    queryKey: queryKeys.employees.salaryHistory(id),
    queryFn: () => fetchSalaryHistory(id),
    enabled: enabled && id != null,
  })
}
