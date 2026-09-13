import { parseMoney } from '@/lib/money'
import { apiFetch, apiMutate } from './client'

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

// EmployeeSummary (the list-row shape above) omits salary_local/currency_code/department_id/
// country_id -- the edit dialog needs this full detail shape, fetched separately, rather than
// prefilling from a list row (see docs/frontend-employee-mgmt.md).
function mapEmployeeDetail(wire) {
  return {
    id: wire.id,
    employeeCode: wire.employee_code,
    firstName: wire.first_name,
    lastName: wire.last_name,
    email: wire.email,
    departmentId: wire.department_id,
    departmentName: wire.department_name,
    countryId: wire.country_id,
    countryName: wire.country_name,
    jobTitle: wire.job_title,
    jobLevel: wire.job_level,
    salaryLocal: parseMoney(wire.salary_local),
    salaryUsd: parseMoney(wire.salary_usd),
    currencyCode: wire.currency_code,
    hireDate: wire.hire_date,
    employmentStatus: wire.employment_status,
    managerId: wire.manager_id,
    createdAt: wire.created_at,
    updatedAt: wire.updated_at,
  }
}

// The write-side counterpart of the mappers above: the only place a create/update payload gets
// translated to the wire's snake_case shape. employment_status is included only when the caller
// provides it -- EmployeeCreateRequest defaults it server-side, EmployeeUpdateRequest requires it
// (a full replace), and the form dialog knows which mode it's in.
function mapEmployeeRequestBody(payload) {
  return {
    first_name: payload.firstName,
    last_name: payload.lastName,
    email: payload.email,
    department_id: payload.departmentId,
    country_id: payload.countryId,
    job_title: payload.jobTitle,
    job_level: payload.jobLevel,
    salary_local: payload.salaryLocal,
    hire_date: payload.hireDate,
    ...(payload.employmentStatus !== undefined ? { employment_status: payload.employmentStatus } : {}),
  }
}

function mapSalaryHistoryItem(wire) {
  return {
    id: wire.id,
    oldSalaryLocal: parseMoney(wire.old_salary_local),
    newSalaryLocal: parseMoney(wire.new_salary_local),
    hikePercent: parseMoney(wire.hike_percent),
    changedAt: wire.changed_at,
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

export async function fetchEmployee(id) {
  const wire = await apiFetch(`/employees/${id}`)
  return mapEmployeeDetail(wire)
}

export async function createEmployee(payload) {
  const wire = await apiMutate('/employees', { method: 'POST', body: mapEmployeeRequestBody(payload) })
  return mapEmployeeDetail(wire)
}

export async function updateEmployee(id, payload) {
  const wire = await apiMutate(`/employees/${id}`, { method: 'PUT', body: mapEmployeeRequestBody(payload) })
  return mapEmployeeDetail(wire)
}

export async function deactivateEmployee(id) {
  const wire = await apiMutate(`/employees/${id}/deactivate`, { method: 'PATCH' })
  return mapEmployeeDetail(wire)
}

export async function fetchSalaryHistory(id) {
  const wire = await apiFetch(`/employees/${id}/salary-history`)
  return wire.data.map(mapSalaryHistoryItem)
}
