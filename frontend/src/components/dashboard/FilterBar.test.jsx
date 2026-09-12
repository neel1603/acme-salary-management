import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { useLookups } from '@/hooks/useLookups'
import { FilterBar } from './FilterBar'

vi.mock('@/hooks/useLookups')

useLookups.mockReturnValue({
  countries: { data: [{ id: 5, name: 'Canada' }] },
  departments: { data: [{ id: 1, name: 'Engineering' }] },
})

describe('FilterBar', () => {
  it('calls onFiltersChange with the department id when a department is picked', async () => {
    const onFiltersChange = vi.fn()
    render(<FilterBar filters={{ employment_status: 'Active' }} onFiltersChange={onFiltersChange} />)

    await userEvent.click(screen.getByLabelText('Department'))
    await userEvent.click(await screen.findByRole('option', { name: 'Engineering' }))

    expect(onFiltersChange).toHaveBeenCalledWith({ employment_status: 'Active', department_id: 1 })
  })

  it('clears department_id when "All Departments" is picked', async () => {
    const onFiltersChange = vi.fn()
    render(
      <FilterBar
        filters={{ employment_status: 'Active', department_id: 1 }}
        onFiltersChange={onFiltersChange}
      />,
    )

    await userEvent.click(screen.getByLabelText('Department'))
    await userEvent.click(await screen.findByRole('option', { name: 'All Departments' }))

    expect(onFiltersChange).toHaveBeenCalledWith({ employment_status: 'Active', department_id: undefined })
  })

  it('updates hire_date_from from the date input without touching other filters', async () => {
    const onFiltersChange = vi.fn()
    render(
      <FilterBar filters={{ employment_status: 'Active', country_id: 5 }} onFiltersChange={onFiltersChange} />,
    )

    const input = screen.getByLabelText('Hired from')
    await userEvent.type(input, '2024-01-15')

    expect(onFiltersChange).toHaveBeenLastCalledWith({
      employment_status: 'Active',
      country_id: 5,
      hire_date_from: '2024-01-15',
    })
  })
})
