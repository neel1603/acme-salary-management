import { useKpiSummary } from '@/hooks/useKpiSummary'
import { formatUsd, formatUsdCompact } from '@/lib/money'
import { KpiCard } from './KpiCard'

export function KpiCardGrid({ filters }) {
  const { data, isLoading, isError } = useKpiSummary(filters)

  if (isError) {
    return <p role="alert">Couldn&apos;t load KPI summary.</p>
  }

  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
      <KpiCard
        label="Headcount"
        value={data && data.headcount.toLocaleString()}
        isLoading={isLoading}
      />
      <KpiCard
        label="Total Payroll"
        value={data && formatUsdCompact(data.totalPayrollUsd)}
        isLoading={isLoading}
      />
      <KpiCard
        label="Average Salary"
        value={data && formatUsd(data.averageSalaryUsd)}
        isLoading={isLoading}
      />
      <KpiCard
        label="Median Salary"
        value={data && formatUsd(data.medianSalaryUsd)}
        isLoading={isLoading}
      />
    </div>
  )
}
