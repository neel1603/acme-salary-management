import { QueryClient } from '@tanstack/react-query'
import { describe, expect, it, vi } from 'vitest'
import { invalidateEmployeeData } from './invalidateEmployeeData'
import { queryKeys } from './queryKeys'

describe('invalidateEmployeeData', () => {
  it('invalidates the employees, kpis, and breakdowns roots so a mutation never leaves the dashboard stale', () => {
    const queryClient = new QueryClient()
    const invalidateQueries = vi.spyOn(queryClient, 'invalidateQueries')

    invalidateEmployeeData(queryClient)

    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: queryKeys.employees.all() })
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: queryKeys.kpis.all() })
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: queryKeys.breakdowns.all() })
  })

  it('the employees root actually covers detail and salary-history keys, not just the list', async () => {
    const queryClient = new QueryClient()
    await queryClient.prefetchQuery({ queryKey: queryKeys.employees.detail(1), queryFn: () => 'stale-detail' })
    await queryClient.prefetchQuery({ queryKey: queryKeys.employees.salaryHistory(1), queryFn: () => 'stale-history' })

    invalidateEmployeeData(queryClient)

    expect(queryClient.getQueryState(queryKeys.employees.detail(1)).isInvalidated).toBe(true)
    expect(queryClient.getQueryState(queryKeys.employees.salaryHistory(1)).isInvalidated).toBe(true)
  })
})
