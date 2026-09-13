import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { useEmployee } from '@/hooks/useEmployee'
import { useSalaryHistory } from '@/hooks/useSalaryHistory'
import { EmployeeDetailDialog } from './EmployeeDetailDialog'

vi.mock('@/hooks/useEmployee')
vi.mock('@/hooks/useSalaryHistory')

function detail(overrides = {}) {
  return {
    id: 1,
    employeeCode: 'EMP00001',
    firstName: 'Ada',
    lastName: 'Lovelace',
    email: 'ada@example.com',
    departmentName: 'Engineering',
    countryName: 'India',
    jobTitle: 'Staff Engineer',
    jobLevel: 'Staff',
    salaryLocal: 12000000,
    salaryUsd: 145000,
    currencyCode: 'INR',
    hireDate: '2020-01-15',
    employmentStatus: 'Active',
    ...overrides,
  }
}

describe('EmployeeDetailDialog', () => {
  it('does not fetch detail or history while closed', () => {
    useEmployee.mockReturnValue({ isSuccess: false, isError: false })
    useSalaryHistory.mockReturnValue({ isSuccess: false, isError: false })

    render(<EmployeeDetailDialog employeeId={1} open={false} onOpenChange={vi.fn()} />)

    expect(useEmployee).toHaveBeenCalledWith(1, { enabled: false })
    expect(useSalaryHistory).toHaveBeenCalledWith(1, { enabled: false })
  })

  it('renders employee fields and history rows in the employee’s local currency once both queries resolve', () => {
    useEmployee.mockReturnValue({ data: detail(), isSuccess: true, isError: false })
    useSalaryHistory.mockReturnValue({
      data: [{ id: 1, oldSalaryLocal: 10000000, newSalaryLocal: 12000000, hikePercent: 20, changedAt: '2024-06-01T00:00:00Z' }],
      isSuccess: true,
      isError: false,
    })

    render(<EmployeeDetailDialog employeeId={1} open onOpenChange={vi.fn()} />)

    expect(screen.getByText('Ada Lovelace')).toBeInTheDocument()
    expect(screen.getByText('Engineering')).toBeInTheDocument()
    expect(screen.getByText(/₹10,000,000.*₹12,000,000.*\+20%/)).toBeInTheDocument()
  })

  it('shows an alert instead of the detail fields when the detail query fails', () => {
    useEmployee.mockReturnValue({ isSuccess: false, isError: true })
    useSalaryHistory.mockReturnValue({ isSuccess: false, isError: false })

    render(<EmployeeDetailDialog employeeId={1} open onOpenChange={vi.fn()} />)

    expect(screen.getByRole('alert')).toHaveTextContent("Couldn't load employee.")
  })
})
