import { useQuery } from '@tanstack/react-query'
import { fetchCountries, fetchDepartments } from '@/api/lookups'
import { queryKeys } from '@/lib/queryKeys'

export function useLookups() {
  const countries = useQuery({
    queryKey: queryKeys.lookups.countries(),
    queryFn: fetchCountries,
  })
  const departments = useQuery({
    queryKey: queryKeys.lookups.departments(),
    queryFn: fetchDepartments,
  })

  return { countries, departments }
}
