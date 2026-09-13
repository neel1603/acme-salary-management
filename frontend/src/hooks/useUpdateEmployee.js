import { useMutation, useQueryClient } from '@tanstack/react-query'
import { updateEmployee } from '@/api/employees'
import { invalidateEmployeeData } from '@/lib/invalidateEmployeeData'

export function useUpdateEmployee() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, payload }) => updateEmployee(id, payload),
    onSuccess: () => invalidateEmployeeData(queryClient),
  })
}
