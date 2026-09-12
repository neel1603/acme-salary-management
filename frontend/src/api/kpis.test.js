import { afterEach, describe, expect, it, vi } from 'vitest'
import { fetchKpiSummary } from './kpis'

function stubFetchOnce(body) {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({ ok: true, status: 200, json: () => Promise.resolve(body) }),
  )
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('fetchKpiSummary', () => {
  it('maps money fields from wire strings to numbers', async () => {
    stubFetchOnce({
      headcount: 10000,
      total_payroll_usd: '712345678.90',
      average_salary_usd: '71234.57',
      median_salary_usd: '68000.00',
    })

    const summary = await fetchKpiSummary()

    expect(summary).toEqual({
      headcount: 10000,
      totalPayrollUsd: 712345678.9,
      averageSalaryUsd: 71234.57,
      medianSalaryUsd: 68000,
    })
  })
})
