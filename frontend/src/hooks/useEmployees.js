import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { fetchEmployees } from '@/api/employees'
import { queryKeys } from '@/lib/queryKeys'

export function useEmployees(params = {}) {
  return useQuery({
    queryKey: queryKeys.employees.list(params),
    queryFn: () => fetchEmployees(params),
    placeholderData: keepPreviousData,
  })
}
