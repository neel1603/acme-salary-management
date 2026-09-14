export const queryKeys = {
  aiQuery: {
    status: () => ['aiQuery', 'status'],
  },
  lookups: {
    countries: () => ['lookups', 'countries'],
    departments: () => ['lookups', 'departments'],
  },
  kpis: {
    all: () => ['kpis'],
    summary: (filters) => ['kpis', 'summary', filters],
  },
  breakdowns: {
    all: () => ['breakdowns'],
    department: (filters) => ['breakdowns', 'department', filters],
    country: (filters) => ['breakdowns', 'country', filters],
  },
  employees: {
    all: () => ['employees'],
    list: (params) => ['employees', 'list', params],
    detail: (id) => ['employees', 'detail', id],
    salaryHistory: (id) => ['employees', 'salaryHistory', id],
  },
}
