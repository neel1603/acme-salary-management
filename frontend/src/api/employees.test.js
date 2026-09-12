import { afterEach, describe, expect, it, vi } from 'vitest'
import { fetchEmployees } from './employees'

function stubFetchOnce(body) {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({ ok: true, status: 200, json: () => Promise.resolve(body) }),
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
