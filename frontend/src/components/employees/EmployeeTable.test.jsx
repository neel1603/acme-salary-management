import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { useEmployees } from '@/hooks/useEmployees'
import { EmployeeTable } from './EmployeeTable'

vi.mock('@/hooks/useEmployees')

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

const BASE_PARAMS = { page: 1, page_size: 25, sort_by: 'last_name', sort_dir: 'asc' }

function noop() {}

describe('EmployeeTable', () => {
  it('renders a row for each employee returned by the query', () => {
    useEmployees.mockReturnValue({
      data: { items: [employee(), employee({ id: 2, firstName: 'Grace', lastName: 'Hopper' })], totalItems: 2 },
      isLoading: false,
      isError: false,
    })

    render(<EmployeeTable params={BASE_PARAMS} onSortChange={noop} onPageChange={noop} onView={noop} onEdit={noop} onDeactivate={noop} />)

    expect(screen.getByText('Ada Lovelace')).toBeInTheDocument()
    expect(screen.getByText('Grace Hopper')).toBeInTheDocument()
  })

  it('shows a loading state while the query is pending', () => {
    useEmployees.mockReturnValue({ data: undefined, isLoading: true, isError: false })

    render(<EmployeeTable params={BASE_PARAMS} onSortChange={noop} onPageChange={noop} onView={noop} onEdit={noop} onDeactivate={noop} />)

    expect(screen.getByText('Loading…')).toBeInTheDocument()
  })

  it('shows an alert instead of the table on error', () => {
    useEmployees.mockReturnValue({ data: undefined, isLoading: false, isError: true })

    render(<EmployeeTable params={BASE_PARAMS} onSortChange={noop} onPageChange={noop} onView={noop} onEdit={noop} onDeactivate={noop} />)

    expect(screen.getByRole('alert')).toHaveTextContent("Couldn't load employees.")
  })

  it('offers "Go to first page" on an out-of-range page and calls onPageChange(1) for it', async () => {
    useEmployees.mockReturnValue({ data: { items: [], totalItems: 40 }, isLoading: false, isError: false })
    const onPageChange = vi.fn()

    render(
      <EmployeeTable
        params={{ ...BASE_PARAMS, page: 12 }}
        onSortChange={noop}
        onPageChange={onPageChange}
        onView={noop}
        onEdit={noop}
        onDeactivate={noop}
      />,
    )

    expect(screen.getByText('No employees on this page.')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Go to first page' }))
    expect(onPageChange).toHaveBeenCalledWith(1)
  })

  it('shows a plain empty message (no "Go to first page") when filters simply match nothing', () => {
    useEmployees.mockReturnValue({ data: { items: [], totalItems: 0 }, isLoading: false, isError: false })

    render(<EmployeeTable params={BASE_PARAMS} onSortChange={noop} onPageChange={noop} onView={noop} onEdit={noop} onDeactivate={noop} />)

    expect(screen.getByText('No employees match these filters.')).toBeInTheDocument()
  })

  it('toggles sort_by and sort_dir when a sortable header is clicked', async () => {
    useEmployees.mockReturnValue({ data: { items: [employee()], totalItems: 1 }, isLoading: false, isError: false })
    const onSortChange = vi.fn()

    render(
      <EmployeeTable
        params={BASE_PARAMS}
        onSortChange={onSortChange}
        onPageChange={noop}
        onView={noop}
        onEdit={noop}
        onDeactivate={noop}
      />,
    )

    await userEvent.click(screen.getByRole('button', { name: 'Department' }))
    expect(onSortChange).toHaveBeenCalledWith('department')
  })

  it('renders the Status column with no sort affordance', () => {
    useEmployees.mockReturnValue({ data: { items: [employee()], totalItems: 1 }, isLoading: false, isError: false })

    render(<EmployeeTable params={BASE_PARAMS} onSortChange={noop} onPageChange={noop} onView={noop} onEdit={noop} onDeactivate={noop} />)

    const statusHeader = screen.getByRole('columnheader', { name: 'Status' })
    expect(statusHeader.querySelector('button')).not.toBeInTheDocument()
  })

  it('does not offer a Deactivate action for a Terminated employee', () => {
    useEmployees.mockReturnValue({
      data: { items: [employee({ employmentStatus: 'Terminated' })], totalItems: 1 },
      isLoading: false,
      isError: false,
    })

    render(<EmployeeTable params={BASE_PARAMS} onSortChange={noop} onPageChange={noop} onView={noop} onEdit={noop} onDeactivate={noop} />)

    expect(screen.queryByRole('button', { name: /Deactivate/ })).not.toBeInTheDocument()
  })
})
