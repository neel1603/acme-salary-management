import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { useDeactivateEmployee } from '@/hooks/useDeactivateEmployee'
import { DeactivateEmployeeDialog } from './DeactivateEmployeeDialog'

vi.mock('@/hooks/useDeactivateEmployee')

describe('DeactivateEmployeeDialog', () => {
  it('asks for confirmation by name before calling the mutation', () => {
    useDeactivateEmployee.mockReturnValue({ mutate: vi.fn(), isPending: false, isError: false })

    render(<DeactivateEmployeeDialog employeeId={1} employeeName="Ada Lovelace" open onOpenChange={vi.fn()} />)

    expect(screen.getByText('Deactivate Ada Lovelace?')).toBeInTheDocument()
  })

  it('mutates with the employee id and closes on success when confirmed', async () => {
    const mutate = vi.fn((_id, { onSuccess }) => onSuccess())
    useDeactivateEmployee.mockReturnValue({ mutate, isPending: false, isError: false })
    const onOpenChange = vi.fn()

    render(<DeactivateEmployeeDialog employeeId={1} employeeName="Ada Lovelace" open onOpenChange={onOpenChange} />)
    await userEvent.click(screen.getByRole('button', { name: 'Deactivate' }))

    expect(mutate).toHaveBeenCalledWith(1, expect.objectContaining({ onSuccess: expect.any(Function) }))
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it('shows an error banner and stays open when the mutation fails', () => {
    useDeactivateEmployee.mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
      isError: true,
      error: { detail: 'Something went wrong' },
    })
    const onOpenChange = vi.fn()

    render(<DeactivateEmployeeDialog employeeId={1} employeeName="Ada Lovelace" open onOpenChange={onOpenChange} />)

    expect(screen.getByRole('alert')).toHaveTextContent('Something went wrong')
    expect(onOpenChange).not.toHaveBeenCalled()
  })
})
