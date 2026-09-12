import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { useCountryBreakdown } from '@/hooks/useCountryBreakdown'
import { formatUsd, formatUsdCompact } from '@/lib/money'

function ChartTooltip({ active, payload }) {
  if (!active || !payload?.length) return null
  const item = payload[0].payload
  return (
    <div className="rounded-lg border bg-popover p-2 text-sm shadow-md">
      <p className="font-medium">
        {item.countryName} ({item.currencyCode})
      </p>
      <p>Average salary: {formatUsd(item.averageSalaryUsd)}</p>
      <p>Headcount: {item.headcount}</p>
      <p>Total payroll: {formatUsd(item.totalPayrollUsd)}</p>
    </div>
  )
}

export function CountryBreakdownChart({ filters }) {
  const { data, isLoading, isError } = useCountryBreakdown(filters)

  if (isError) {
    return <p role="alert">Couldn&apos;t load country breakdown.</p>
  }

  if (isLoading) {
    return <p>Loading…</p>
  }

  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey="countryName" />
        <YAxis tickFormatter={formatUsdCompact} />
        <Tooltip content={<ChartTooltip />} />
        <Bar dataKey="averageSalaryUsd" fill="var(--chart-2)" />
      </BarChart>
    </ResponsiveContainer>
  )
}
