export const queryKeys = {
  lookups: {
    countries: () => ['lookups', 'countries'],
    departments: () => ['lookups', 'departments'],
  },
  kpis: {
    summary: (filters) => ['kpis', 'summary', filters],
  },
}
