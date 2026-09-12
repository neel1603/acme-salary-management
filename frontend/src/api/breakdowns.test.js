import { afterEach, describe, expect, it, vi } from 'vitest'
import { fetchCountryBreakdown, fetchDepartmentBreakdown } from './breakdowns'

function stubFetchOnce(body) {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({ ok: true, status: 200, json: () => Promise.resolve(body) }),
  )
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('fetchDepartmentBreakdown', () => {
  it('never sends department_id, even when present in the filters passed in', async () => {
    stubFetchOnce({ data: [] })

    await fetchDepartmentBreakdown({ department_id: 3, country_id: 2, employment_status: 'All' })

    const requestedUrl = fetch.mock.calls[0][0]
    expect(requestedUrl).not.toContain('department_id')
    expect(requestedUrl).toContain('country_id=2')
    expect(requestedUrl).toContain('employment_status=All')
  })
})

describe('fetchCountryBreakdown', () => {
  it('never sends country_id, even when present in the filters passed in', async () => {
    stubFetchOnce({ data: [] })

    await fetchCountryBreakdown({ department_id: 3, country_id: 2, employment_status: 'All' })

    const requestedUrl = fetch.mock.calls[0][0]
    expect(requestedUrl).not.toContain('country_id')
    expect(requestedUrl).toContain('department_id=3')
    expect(requestedUrl).toContain('employment_status=All')
  })
})
