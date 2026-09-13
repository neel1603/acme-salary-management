import { queryKeys } from '@/lib/queryKeys'

// Every employee mutation (create/update/deactivate) changes both the directory itself and the
// dashboard's aggregates (headcount, average/median salary). One shared helper so "what does a
// write invalidate" has a single answer in a single place, rather than each mutation hook
// re-deriving its own list of keys.
//
// `['employees']` (not `['employees', 'list']`) is deliberate: TanStack Query's default prefix
// matching would find list-query cache entries either way, but it would miss
// `['employees', 'detail', id]` and `['employees', 'salaryHistory', id]`, which also need to
// refetch after an edit.
export function invalidateEmployeeData(queryClient) {
  queryClient.invalidateQueries({ queryKey: queryKeys.employees.all() })
  queryClient.invalidateQueries({ queryKey: queryKeys.kpis.all() })
  queryClient.invalidateQueries({ queryKey: queryKeys.breakdowns.all() })
}
