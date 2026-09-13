import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { useEmployees } from '@/hooks/useEmployees'
import { EmployeePagination } from './EmployeePagination'

vi.mock('@/hooks/useEmployees')

const PARAMS = { page: 1, page_size: 25 }

function noop() {}

describe('EmployeePagination', () => {
  it('renders nothing until the query resolves', () => {
    useEmployees.mockReturnValue({ data: undefined })

    const { container } = render(<EmployeePagination params={PARAMS} onPageChange={noop} onPageSizeChange={noop} />)

    expect(container).toBeEmptyDOMElement()
  })

  it('shows the page summary and disables Prev on the first page', () => {
    useEmployees.mockReturnValue({ data: { page: 1, pageSize: 25, totalItems: 63, totalPages: 3 } })

    render(<EmployeePagination params={PARAMS} onPageChange={noop} onPageSizeChange={noop} />)

    expect(screen.getByText('Page 1 of 3 (63 total)')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Prev' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Next' })).toBeEnabled()
    // Regression: the trigger must show the "25 / page" label, not the raw value "25".
    expect(screen.getByRole('combobox')).toHaveTextContent('25 / page')
  })

  it('disables Next on the last page', () => {
    useEmployees.mockReturnValue({ data: { page: 3, pageSize: 25, totalItems: 63, totalPages: 3 } })

    render(<EmployeePagination params={{ ...PARAMS, page: 3 }} onPageChange={noop} onPageSizeChange={noop} />)

    expect(screen.getByRole('button', { name: 'Prev' })).toBeEnabled()
    expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled()
  })

  it('calls onPageChange with page + 1 when Next is clicked', async () => {
    useEmployees.mockReturnValue({ data: { page: 1, pageSize: 25, totalItems: 63, totalPages: 3 } })
    const onPageChange = vi.fn()

    render(<EmployeePagination params={PARAMS} onPageChange={onPageChange} onPageSizeChange={noop} />)
    await userEvent.click(screen.getByRole('button', { name: 'Next' }))

    expect(onPageChange).toHaveBeenCalledWith(2)
  })

  it('calls onPageSizeChange with the picked size when the page-size select changes', async () => {
    useEmployees.mockReturnValue({ data: { page: 1, pageSize: 25, totalItems: 63, totalPages: 3 } })
    const onPageSizeChange = vi.fn()

    render(<EmployeePagination params={PARAMS} onPageChange={noop} onPageSizeChange={onPageSizeChange} />)
    await userEvent.click(screen.getByRole('combobox'))
    await userEvent.click(await screen.findByRole('option', { name: '50 / page' }))

    expect(onPageSizeChange).toHaveBeenCalledWith(50)
  })
})
