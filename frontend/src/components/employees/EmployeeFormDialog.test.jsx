import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { useCreateEmployee } from '@/hooks/useCreateEmployee'
import { useEmployee } from '@/hooks/useEmployee'
import { useLookups } from '@/hooks/useLookups'
import { useUpdateEmployee } from '@/hooks/useUpdateEmployee'
import { EmployeeFormDialog } from './EmployeeFormDialog'

vi.mock('@/hooks/useEmployee')
vi.mock('@/hooks/useLookups')
vi.mock('@/hooks/useCreateEmployee')
vi.mock('@/hooks/useUpdateEmployee')

const LOOKUPS = {
  countries: {
    data: [
      { id: 3, name: 'India', currencyCode: 'INR' },
      { id: 7, name: 'United States', currencyCode: 'USD' },
    ],
  },
  departments: { data: [{ id: 2, name: 'Engineering' }] },
}

function detail(overrides = {}) {
  return {
    id: 1,
    employeeCode: 'EMP00001',
    firstName: 'Ada',
    lastName: 'Lovelace',
    email: 'ada@example.com',
    departmentId: 2,
    departmentName: 'Engineering',
    countryId: 3,
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

function mockMutations({ createMutate = vi.fn(), updateMutate = vi.fn(), isError = false, error } = {}) {
  useCreateEmployee.mockReturnValue({ mutate: createMutate, isPending: false, isError, error })
  useUpdateEmployee.mockReturnValue({ mutate: updateMutate, isPending: false, isError, error })
  return { createMutate, updateMutate }
}

describe('EmployeeFormDialog', () => {
  it('renders nothing but a loading state in edit mode until the detail query succeeds', () => {
    useLookups.mockReturnValue(LOOKUPS)
    useEmployee.mockReturnValue({ isSuccess: false, isError: false })
    mockMutations()

    render(<EmployeeFormDialog mode="edit" employeeId={1} open onOpenChange={vi.fn()} />)

    expect(screen.getByText('Loading…')).toBeInTheDocument()
    expect(screen.queryByLabelText('First Name')).not.toBeInTheDocument()
  })

  it('prefills from the fetched detail, not any list-row data', () => {
    useLookups.mockReturnValue(LOOKUPS)
    useEmployee.mockReturnValue({ data: detail(), isSuccess: true, isError: false })
    mockMutations()

    render(<EmployeeFormDialog mode="edit" employeeId={1} open onOpenChange={vi.fn()} />)

    expect(screen.getByLabelText('First Name')).toHaveValue('Ada')
    expect(screen.getByLabelText('Email')).toHaveValue('ada@example.com')
    expect(screen.getByLabelText(/^Salary/)).toHaveValue(12000000)
    // Regression: the Select triggers must show the department/country names, not their raw ids.
    expect(screen.getByLabelText('Department')).toHaveTextContent('Engineering')
    expect(screen.getByLabelText('Country')).toHaveTextContent('India')
  })

  it('clears the salary field and shows the new currency when the country is changed', async () => {
    useLookups.mockReturnValue(LOOKUPS)
    useEmployee.mockReturnValue({ data: detail(), isSuccess: true, isError: false })
    mockMutations()

    render(<EmployeeFormDialog mode="edit" employeeId={1} open onOpenChange={vi.fn()} />)

    await userEvent.click(screen.getByLabelText('Country'))
    await userEvent.click(await screen.findByRole('option', { name: 'United States' }))

    expect(screen.getByLabelText(/^Salary/)).toHaveValue(null)
    expect(screen.getByText(/re-enter salary in USD/)).toBeInTheDocument()
    expect(screen.getByLabelText('Salary (USD)')).toBeInTheDocument()
  })

  it('submits the full field set including employment_status on edit', async () => {
    useLookups.mockReturnValue(LOOKUPS)
    useEmployee.mockReturnValue({ data: detail(), isSuccess: true, isError: false })
    const { updateMutate } = mockMutations()

    render(<EmployeeFormDialog mode="edit" employeeId={1} open onOpenChange={vi.fn()} />)
    await userEvent.click(screen.getByRole('button', { name: 'Save' }))

    expect(updateMutate).toHaveBeenCalledWith(
      {
        id: 1,
        payload: expect.objectContaining({
          firstName: 'Ada',
          departmentId: 2,
          countryId: 3,
          salaryLocal: 12000000,
          employmentStatus: 'Active',
        }),
      },
      expect.objectContaining({ onSuccess: expect.any(Function) }),
    )
  })

  it('shows the 409 conflict detail in a banner and leaves the dialog open', () => {
    useLookups.mockReturnValue(LOOKUPS)
    useEmployee.mockReturnValue({ data: detail(), isSuccess: true, isError: false })
    const onOpenChange = vi.fn()
    mockMutations({ isError: true, error: { detail: 'email ada@example.com is already in use by another employee' } })

    render(<EmployeeFormDialog mode="edit" employeeId={1} open onOpenChange={onOpenChange} />)

    expect(screen.getByRole('alert')).toHaveTextContent('email ada@example.com is already in use by another employee')
    expect(onOpenChange).not.toHaveBeenCalled()
  })

  it('does not fetch a detail in create mode, and starts with empty fields', () => {
    useLookups.mockReturnValue(LOOKUPS)
    useEmployee.mockReturnValue({ isSuccess: false, isError: false })
    mockMutations()

    render(<EmployeeFormDialog mode="create" open onOpenChange={vi.fn()} />)

    expect(useEmployee).toHaveBeenCalledWith(undefined, { enabled: false })
    expect(screen.getByLabelText('First Name')).toHaveValue('')
    expect(screen.queryByLabelText('Status')).not.toBeInTheDocument()
  })
})
