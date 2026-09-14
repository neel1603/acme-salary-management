import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { fetchCountryBreakdown } from '@/api/breakdowns'
import { queryKeys } from '@/lib/queryKeys'

export function useCountryBreakdown(filters = {}) {
  return useQuery({
    queryKey: queryKeys.breakdowns.country(filters),
    queryFn: () => fetchCountryBreakdown(filters),
    placeholderData: keepPreviousData,
  })
}
