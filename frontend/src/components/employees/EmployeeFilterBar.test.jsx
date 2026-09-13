import { act, fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useLookups } from '@/hooks/useLookups'
import { EmployeeFilterBar } from './EmployeeFilterBar'

vi.mock('@/hooks/useLookups')

useLookups.mockReturnValue({
  countries: { data: [{ id: 5, name: 'Canada' }] },
  departments: { data: [{ id: 1, name: 'Engineering' }] },
})

const BASE_FILTERS = { employment_status: 'Active', sort_by: 'last_name', sort_dir: 'asc', page: 1, page_size: 25 }

describe('EmployeeFilterBar', () => {
  it('calls onFiltersChange with the department id when a department is picked, leaving other params untouched', async () => {
    const onFiltersChange = vi.fn()
    render(<EmployeeFilterBar filters={BASE_FILTERS} onFiltersChange={onFiltersChange} />)

    await userEvent.click(screen.getByLabelText('Department'))
    await userEvent.click(await screen.findByRole('option', { name: 'Engineering' }))

    expect(onFiltersChange).toHaveBeenCalledWith({ ...BASE_FILTERS, department_id: 1 })
  })

  it('clears country_id when "All Countries" is picked', async () => {
    const onFiltersChange = vi.fn()
    render(<EmployeeFilterBar filters={{ ...BASE_FILTERS, country_id: 5 }} onFiltersChange={onFiltersChange} />)

    await userEvent.click(screen.getByLabelText('Country'))
    await userEvent.click(await screen.findByRole('option', { name: 'All Countries' }))

    expect(onFiltersChange).toHaveBeenCalledWith({ ...BASE_FILTERS, country_id: undefined })
  })

  it('shows the selected department and country names in the triggers, not their raw ids', () => {
    render(
      <EmployeeFilterBar filters={{ ...BASE_FILTERS, department_id: 1, country_id: 5 }} onFiltersChange={vi.fn()} />,
    )

    expect(screen.getByLabelText('Department')).toHaveTextContent('Engineering')
    expect(screen.getByLabelText('Country')).toHaveTextContent('Canada')
  })

  it('calls onFiltersChange with the new status when a status is picked', async () => {
    const onFiltersChange = vi.fn()
    render(<EmployeeFilterBar filters={BASE_FILTERS} onFiltersChange={onFiltersChange} />)

    await userEvent.click(screen.getByLabelText('Status'))
    await userEvent.click(await screen.findByRole('option', { name: 'On Leave' }))

    expect(onFiltersChange).toHaveBeenCalledWith({ ...BASE_FILTERS, employment_status: 'On Leave' })
  })

  describe('search', () => {
    beforeEach(() => {
      vi.useFakeTimers()
    })

    afterEach(() => {
      vi.useRealTimers()
    })

    it('does not call onFiltersChange until the debounce settles', () => {
      const onFiltersChange = vi.fn()
      render(<EmployeeFilterBar filters={BASE_FILTERS} onFiltersChange={onFiltersChange} />)

      fireEvent.change(screen.getByLabelText('Search'), { target: { value: 'Ada' } })
      expect(onFiltersChange).not.toHaveBeenCalled()

      act(() => vi.advanceTimersByTime(300))
      expect(onFiltersChange).toHaveBeenCalledWith({ ...BASE_FILTERS, search: 'Ada' })
    })

    it('sends undefined, not an empty string, when the search box is cleared', () => {
      const onFiltersChange = vi.fn()
      render(<EmployeeFilterBar filters={{ ...BASE_FILTERS, search: 'Ada' }} onFiltersChange={onFiltersChange} />)

      fireEvent.change(screen.getByLabelText('Search'), { target: { value: '' } })
      act(() => vi.advanceTimersByTime(300))

      expect(onFiltersChange).toHaveBeenCalledWith({ ...BASE_FILTERS, search: undefined })
    })

    it('shows a clear button only once text is typed, and clearing it empties the box immediately', () => {
      render(<EmployeeFilterBar filters={BASE_FILTERS} onFiltersChange={vi.fn()} />)

      expect(screen.queryByRole('button', { name: 'Clear search' })).not.toBeInTheDocument()

      fireEvent.change(screen.getByLabelText('Search'), { target: { value: 'Ada' } })
      fireEvent.click(screen.getByRole('button', { name: 'Clear search' }))

      expect(screen.getByLabelText('Search')).toHaveValue('')
      expect(screen.queryByRole('button', { name: 'Clear search' })).not.toBeInTheDocument()
    })
  })

  describe('clear filters', () => {
    it('is hidden when every filter is already at its default', () => {
      render(<EmployeeFilterBar filters={BASE_FILTERS} onFiltersChange={vi.fn()} />)
      expect(screen.queryByRole('button', { name: 'Clear filters' })).not.toBeInTheDocument()
    })

    it('appears once a filter is applied and resets department, country, status, and search, keeping sort/page params', () => {
      const onFiltersChange = vi.fn()
      const filters = { ...BASE_FILTERS, department_id: 1, country_id: 5, employment_status: 'On Leave', search: 'Ada' }
      render(<EmployeeFilterBar filters={filters} onFiltersChange={onFiltersChange} />)

      fireEvent.click(screen.getByRole('button', { name: 'Clear filters' }))

      expect(onFiltersChange).toHaveBeenCalledWith({
        ...BASE_FILTERS,
        department_id: undefined,
        country_id: undefined,
        employment_status: 'Active',
        search: undefined,
      })
      expect(screen.getByLabelText('Search')).toHaveValue('')
    })
  })
})
