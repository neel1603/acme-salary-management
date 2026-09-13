import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  createEmployee,
  deactivateEmployee,
  fetchEmployee,
  fetchEmployees,
  fetchSalaryHistory,
  updateEmployee,
} from './employees'

function stubFetchOnce(body, { status = 200 } = {}) {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({ ok: status < 300, status, json: () => Promise.resolve(body) }),
  )
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('fetchEmployees', () => {
  it('maps salary_usd from a wire string to a number for each item', async () => {
    stubFetchOnce({
      items: [
        {
          id: 1,
          employee_code: 'EMP00001',
          first_name: 'Ada',
          last_name: 'Lovelace',
          email: 'ada@example.com',
          department_name: 'Engineering',
          country_name: 'United Kingdom',
          job_title: 'Staff Engineer',
          job_level: 'Staff',
          salary_usd: '145000.00',
          hire_date: '2020-01-15',
          employment_status: 'Active',
        },
      ],
      page: 1,
      page_size: 25,
      total_items: 1,
      total_pages: 1,
    })

    const result = await fetchEmployees({ page: 1 })

    expect(result.items[0].salaryUsd).toBe(145000)
    expect(result).toMatchObject({ page: 1, pageSize: 25, totalItems: 1, totalPages: 1 })
  })
})

function employeeDetailWire(overrides = {}) {
  return {
    id: 1,
    employee_code: 'EMP00001',
    first_name: 'Ada',
    last_name: 'Lovelace',
    email: 'ada@example.com',
    department_id: 2,
    department_name: 'Engineering',
    country_id: 3,
    country_name: 'India',
    job_title: 'Staff Engineer',
    job_level: 'Staff',
    salary_local: '12000000.00',
    salary_usd: '145000.00',
    currency_code: 'INR',
    hire_date: '2020-01-15',
    employment_status: 'Active',
    manager_id: null,
    created_at: '2020-01-15T00:00:00Z',
    updated_at: '2020-01-15T00:00:00Z',
    ...overrides,
  }
}

describe('fetchEmployee', () => {
  it('maps the detail response, including fields the list row omits', async () => {
    stubFetchOnce(employeeDetailWire())

    const result = await fetchEmployee(1)

    expect(result).toMatchObject({
      departmentId: 2,
      countryId: 3,
      salaryLocal: 12000000,
      salaryUsd: 145000,
      currencyCode: 'INR',
    })
  })
})

describe('createEmployee', () => {
  it('POSTs the mapped request body and returns the mapped detail response', async () => {
    stubFetchOnce(employeeDetailWire(), { status: 201 })

    const result = await createEmployee({
      firstName: 'Ada',
      lastName: 'Lovelace',
      email: 'ada@example.com',
      departmentId: 2,
      countryId: 3,
      jobTitle: 'Staff Engineer',
      jobLevel: 'Staff',
      salaryLocal: 12000000,
      hireDate: '2020-01-15',
    })

    const [, options] = fetch.mock.calls[0]
    expect(options.method).toBe('POST')
    expect(JSON.parse(options.body)).toMatchObject({
      first_name: 'Ada',
      department_id: 2,
      salary_local: 12000000,
    })
    expect(JSON.parse(options.body)).not.toHaveProperty('employment_status')
    expect(result.salaryUsd).toBe(145000)
  })
})

describe('updateEmployee', () => {
  it('PUTs the mapped request body including employment_status (a full replace)', async () => {
    stubFetchOnce(employeeDetailWire())

    await updateEmployee(1, {
      firstName: 'Ada',
      lastName: 'Lovelace',
      email: 'ada@example.com',
      departmentId: 2,
      countryId: 3,
      jobTitle: 'Staff Engineer',
      jobLevel: 'Staff',
      salaryLocal: 12000000,
      hireDate: '2020-01-15',
      employmentStatus: 'Active',
    })

    const [url, options] = fetch.mock.calls[0]
    expect(url).toContain('/employees/1')
    expect(options.method).toBe('PUT')
    expect(JSON.parse(options.body)).toMatchObject({ employment_status: 'Active' })
  })
})

describe('deactivateEmployee', () => {
  it('sends a PATCH with no body', async () => {
    stubFetchOnce(employeeDetailWire({ employment_status: 'Terminated' }))

    const result = await deactivateEmployee(1)

    const [url, options] = fetch.mock.calls[0]
    expect(url).toContain('/employees/1/deactivate')
    expect(options.method).toBe('PATCH')
    expect(result.employmentStatus).toBe('Terminated')
  })
})

describe('fetchSalaryHistory', () => {
  it('unwraps {data} and maps money/hike_percent strings to numbers', async () => {
    stubFetchOnce({
      data: [
        {
          id: 1,
          old_salary_local: '100000.00',
          new_salary_local: '110000.00',
          hike_percent: '10.00',
          changed_at: '2026-01-01T00:00:00Z',
        },
      ],
    })

    const result = await fetchSalaryHistory(1)

    expect(result).toEqual([
      {
        id: 1,
        oldSalaryLocal: 100000,
        newSalaryLocal: 110000,
        hikePercent: 10,
        changedAt: '2026-01-01T00:00:00Z',
      },
    ])
  })
})
