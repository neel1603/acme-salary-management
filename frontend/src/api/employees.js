import { parseMoney } from '@/lib/money'
import { apiFetch } from './client'

function mapEmployeeSummary(wire) {
  return {
    id: wire.id,
    employeeCode: wire.employee_code,
    firstName: wire.first_name,
    lastName: wire.last_name,
    email: wire.email,
    departmentName: wire.department_name,
    countryName: wire.country_name,
    jobTitle: wire.job_title,
    jobLevel: wire.job_level,
    salaryUsd: parseMoney(wire.salary_usd),
    hireDate: wire.hire_date,
    employmentStatus: wire.employment_status,
  }
}

export async function fetchEmployees(params) {
  const wire = await apiFetch('/employees', params)
  return {
    items: wire.items.map(mapEmployeeSummary),
    page: wire.page,
    pageSize: wire.page_size,
    totalItems: wire.total_items,
    totalPages: wire.total_pages,
  }
}
