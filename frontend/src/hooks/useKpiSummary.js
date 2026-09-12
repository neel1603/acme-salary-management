import { useQuery } from '@tanstack/react-query'
import { fetchKpiSummary } from '@/api/kpis'
import { queryKeys } from '@/lib/queryKeys'

export function useKpiSummary(filters = {}) {
  return useQuery({
    queryKey: queryKeys.kpis.summary(filters),
    queryFn: () => fetchKpiSummary(filters),
  })
}
