import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { useDepartmentBreakdown } from '@/hooks/useDepartmentBreakdown'
import { DepartmentBreakdownChart } from './DepartmentBreakdownChart'

vi.mock('@/hooks/useDepartmentBreakdown')

describe('DepartmentBreakdownChart', () => {
  it('shows a loading state before data arrives', () => {
    useDepartmentBreakdown.mockReturnValue({ data: undefined, isLoading: true, isError: false })

    render(<DepartmentBreakdownChart filters={{}} />)

    expect(screen.getByText('Loading…')).toBeInTheDocument()
  })

  it('shows an alert on error instead of the chart', () => {
    useDepartmentBreakdown.mockReturnValue({ data: undefined, isLoading: false, isError: true })

    render(<DepartmentBreakdownChart filters={{}} />)

    expect(screen.getByRole('alert')).toHaveTextContent("Couldn't load department breakdown.")
  })

  it('renders the chart container instead of the loading/error copy once data arrives', () => {
    useDepartmentBreakdown.mockReturnValue({
      data: [
        { departmentId: 1, departmentName: 'Engineering', headcount: 10, averageSalaryUsd: 90000, totalPayrollUsd: 900000 },
        { departmentId: 2, departmentName: 'Sales', headcount: 5, averageSalaryUsd: 60000, totalPayrollUsd: 300000 },
      ],
      isLoading: false,
      isError: false,
    })

    const { container } = render(<DepartmentBreakdownChart filters={{}} />)

    expect(screen.queryByText('Loading…')).not.toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(container.querySelector('.recharts-responsive-container')).toBeInTheDocument()
  })
})
