import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { fetchDepartmentBreakdown } from '@/api/breakdowns'
import { queryKeys } from '@/lib/queryKeys'

export function useDepartmentBreakdown(filters = {}) {
  return useQuery({
    queryKey: queryKeys.breakdowns.department(filters),
    queryFn: () => fetchDepartmentBreakdown(filters),
    placeholderData: keepPreviousData,
  })
}
