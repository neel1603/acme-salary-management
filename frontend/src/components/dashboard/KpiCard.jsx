import { Card, CardContent, CardDescription, CardTitle } from '@/components/ui/card'

export function KpiCard({ label, value, isLoading }) {
  return (
    <Card>
      <CardContent>
        <CardDescription>{label}</CardDescription>
        <CardTitle className="text-2xl">{isLoading ? '—' : value}</CardTitle>
      </CardContent>
    </Card>
  )
}
