import { parseMoney } from '@/lib/money'
import { apiFetch } from './client'

function mapDepartmentBreakdownItem(wire) {
  return {
    departmentId: wire.department_id,
    departmentName: wire.department_name,
    headcount: wire.headcount,
    totalPayrollUsd: parseMoney(wire.total_payroll_usd),
    averageSalaryUsd: parseMoney(wire.average_salary_usd),
    medianSalaryUsd: parseMoney(wire.median_salary_usd),
  }
}

export async function fetchDepartmentBreakdown(filters = {}) {
  const { country_id, employment_status, hire_date_from, hire_date_to } = filters
  const wire = await apiFetch('/breakdown/department', {
    country_id,
    employment_status,
    hire_date_from,
    hire_date_to,
  })
  return wire.data.map(mapDepartmentBreakdownItem)
}

function mapCountryBreakdownItem(wire) {
  return {
    countryId: wire.country_id,
    countryName: wire.country_name,
    currencyCode: wire.currency_code,
    headcount: wire.headcount,
    totalPayrollUsd: parseMoney(wire.total_payroll_usd),
    averageSalaryUsd: parseMoney(wire.average_salary_usd),
    medianSalaryUsd: parseMoney(wire.median_salary_usd),
  }
}

export async function fetchCountryBreakdown(filters = {}) {
  const { department_id, employment_status, hire_date_from, hire_date_to } = filters
  const wire = await apiFetch('/breakdown/country', {
    department_id,
    employment_status,
    hire_date_from,
    hire_date_to,
  })
  return wire.data.map(mapCountryBreakdownItem)
}
