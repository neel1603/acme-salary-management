import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { useEmployee } from '@/hooks/useEmployee'
import { useEmployees } from '@/hooks/useEmployees'
import { useLookups } from '@/hooks/useLookups'
import { useSalaryHistory } from '@/hooks/useSalaryHistory'
import { EmployeesPage } from './EmployeesPage'

vi.mock('@/hooks/useEmployees')
vi.mock('@/hooks/useLookups')
vi.mock('@/hooks/useEmployee')
vi.mock('@/hooks/useSalaryHistory')

function employee(overrides = {}) {
  return {
    id: 1,
    employeeCode: 'EMP00001',
    firstName: 'Ada',
    lastName: 'Lovelace',
    departmentName: 'Engineering',
    countryName: 'United Kingdom',
    jobTitle: 'Staff Engineer',
    jobLevel: 'Staff',
    salaryUsd: 145000,
    hireDate: '2020-01-15',
    employmentStatus: 'Active',
    ...overrides,
  }
}

function detail(overrides = {}) {
  return {
    id: 1,
    employeeCode: 'EMP00001',
    firstName: 'Ada',
    lastName: 'Lovelace',
    email: 'ada@example.com',
    departmentName: 'Engineering',
    countryName: 'United Kingdom',
    jobTitle: 'Staff Engineer',
    jobLevel: 'Staff',
    salaryLocal: 145000,
    salaryUsd: 145000,
    currencyCode: 'GBP',
    hireDate: '2020-01-15',
    employmentStatus: 'Active',
    ...overrides,
  }
}

function mockSteady() {
  useLookups.mockReturnValue({
    countries: { data: [{ id: 5, name: 'Canada', currencyCode: 'CAD' }] },
    departments: { data: [{ id: 1, name: 'Engineering' }] },
  })
  useEmployees.mockReturnValue({
    data: {
      items: [employee(), employee({ id: 2, firstName: 'Grace', lastName: 'Hopper' })],
      page: 1,
      pageSize: 25,
      totalItems: 63,
      totalPages: 3,
    },
    isLoading: false,
    isError: false,
  })
  useSalaryHistory.mockReturnValue({ data: [], isSuccess: true, isError: false })
}

describe('EmployeesPage', () => {
  it('resets to page 1 when a filter changes, but keeps the current page on a sort change', async () => {
    mockSteady()
    render(<EmployeesPage />)

    await userEvent.click(screen.getByRole('button', { name: 'Next' }))
    expect(useEmployees.mock.calls.at(-1)[0]).toMatchObject({ page: 2 })

    await userEvent.click(screen.getByRole('button', { name: 'Department' }))
    expect(useEmployees.mock.calls.at(-1)[0]).toMatchObject({ page: 2, sort_by: 'department', sort_dir: 'asc' })

    await userEvent.click(screen.getByLabelText('Department'))
    await userEvent.click(await screen.findByRole('option', { name: 'Engineering' }))
    expect(useEmployees.mock.calls.at(-1)[0]).toMatchObject({ page: 1, department_id: 1 })
  })

  it('shows no leaked state when viewing employee B right after employee A', async () => {
    mockSteady()
    useEmployee.mockImplementation((id) => ({
      data:
        id === 1
          ? detail()
          : detail({ id: 2, firstName: 'Grace', lastName: 'Hopper', email: 'grace@example.com' }),
      isSuccess: id != null,
      isError: false,
    }))

    render(<EmployeesPage />)

    await userEvent.click(screen.getByRole('button', { name: 'View Ada Lovelace' }))
    expect(screen.getByText('ada@example.com')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Close' }))
    await userEvent.click(screen.getByRole('button', { name: 'View Grace Hopper' }))

    expect(screen.getByText('grace@example.com')).toBeInTheDocument()
    expect(screen.queryByText('ada@example.com')).not.toBeInTheDocument()
  })
})
