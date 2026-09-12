import { parseMoney } from '@/lib/money'
import { apiFetch } from './client'

function mapKpiSummary(wire) {
  return {
    headcount: wire.headcount,
    totalPayrollUsd: parseMoney(wire.total_payroll_usd),
    averageSalaryUsd: parseMoney(wire.average_salary_usd),
    medianSalaryUsd: parseMoney(wire.median_salary_usd),
  }
}

export async function fetchKpiSummary(filters) {
  const wire = await apiFetch('/kpis/summary', filters)
  return mapKpiSummary(wire)
}
