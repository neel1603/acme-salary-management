import { useMutation, useQueryClient } from '@tanstack/react-query'
import { deactivateEmployee } from '@/api/employees'
import { invalidateEmployeeData } from '@/lib/invalidateEmployeeData'

export function useDeactivateEmployee() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: deactivateEmployee,
    onSuccess: () => invalidateEmployeeData(queryClient),
  })
}
