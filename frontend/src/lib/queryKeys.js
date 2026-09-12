export const queryKeys = {
  lookups: {
    countries: () => ['lookups', 'countries'],
    departments: () => ['lookups', 'departments'],
  },
  kpis: {
    summary: (filters) => ['kpis', 'summary', filters],
  },
  breakdowns: {
    department: (filters) => ['breakdowns', 'department', filters],
    country: (filters) => ['breakdowns', 'country', filters],
  },
  employees: {
    list: (params) => ['employees', 'list', params],
  },
}
