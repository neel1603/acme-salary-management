import { useQuery } from '@tanstack/react-query'
import { fetchAiQueryStatus } from '@/api/aiQuery'
import { queryKeys } from '@/lib/queryKeys'

export function useAiQueryStatus() {
  return useQuery({
    queryKey: queryKeys.aiQuery.status(),
    queryFn: fetchAiQueryStatus,
  })
}
