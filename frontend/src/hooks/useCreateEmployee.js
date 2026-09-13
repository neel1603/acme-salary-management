import { useMutation, useQueryClient } from '@tanstack/react-query'
import { createEmployee } from '@/api/employees'
import { invalidateEmployeeData } from '@/lib/invalidateEmployeeData'

export function useCreateEmployee() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: createEmployee,
    onSuccess: () => invalidateEmployeeData(queryClient),
  })
}
