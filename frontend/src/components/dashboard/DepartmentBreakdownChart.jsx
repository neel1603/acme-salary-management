import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { useDepartmentBreakdown } from '@/hooks/useDepartmentBreakdown'
import { formatUsd, formatUsdCompact } from '@/lib/money'

function ChartTooltip({ active, payload }) {
  if (!active || !payload?.length) return null
  const item = payload[0].payload
  return (
    <div className="rounded-lg border bg-popover p-2 text-sm shadow-md">
      <p className="font-medium">{item.departmentName}</p>
      <p>Average salary: {formatUsd(item.averageSalaryUsd)}</p>
      <p>Median salary: {formatUsd(item.medianSalaryUsd)}</p>
      <p>Headcount: {item.headcount}</p>
      <p>Total payroll: {formatUsd(item.totalPayrollUsd)}</p>
    </div>
  )
}

export function DepartmentBreakdownChart({ filters }) {
  const { data, isLoading, isError } = useDepartmentBreakdown(filters)

  if (isError) {
    return <p role="alert">Couldn&apos;t load department breakdown.</p>
  }

  if (isLoading) {
    return <p>Loading…</p>
  }

  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={data} margin={{ bottom: 24 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey="departmentName" interval={0} angle={-35} textAnchor="end" height={60} />
        <YAxis tickFormatter={formatUsdCompact} />
        <Tooltip content={<ChartTooltip />} />
        <Legend />
        <Bar dataKey="averageSalaryUsd" name="Average" fill="var(--chart-1)" />
        <Bar dataKey="medianSalaryUsd" name="Median" fill="var(--chart-4)" />
      </BarChart>
    </ResponsiveContainer>
  )
}
