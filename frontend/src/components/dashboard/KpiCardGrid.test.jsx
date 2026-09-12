import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { useKpiSummary } from '@/hooks/useKpiSummary'
import { KpiCardGrid } from './KpiCardGrid'

vi.mock('@/hooks/useKpiSummary')

describe('KpiCardGrid', () => {
  it('formats each KPI with the money helpers', () => {
    useKpiSummary.mockReturnValue({
      data: {
        headcount: 10000,
        totalPayrollUsd: 712345678.9,
        averageSalaryUsd: 71234.57,
        medianSalaryUsd: 68000,
      },
      isLoading: false,
      isError: false,
    })

    render(<KpiCardGrid filters={{}} />)

    expect(screen.getByText('10,000')).toBeInTheDocument()
    expect(screen.getByText('$712.3M')).toBeInTheDocument()
    expect(screen.getByText('$71,235')).toBeInTheDocument()
    expect(screen.getByText('$68,000')).toBeInTheDocument()
  })

  it('shows a placeholder dash on each card while loading', () => {
    useKpiSummary.mockReturnValue({ data: undefined, isLoading: true, isError: false })

    render(<KpiCardGrid filters={{}} />)

    expect(screen.getAllByText('—')).toHaveLength(4)
  })

  it('shows an alert instead of the cards on error', () => {
    useKpiSummary.mockReturnValue({ data: undefined, isLoading: false, isError: true })

    render(<KpiCardGrid filters={{}} />)

    expect(screen.getByRole('alert')).toHaveTextContent("Couldn't load KPI summary.")
  })
})
