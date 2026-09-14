import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { useAiQuery } from '@/hooks/useAiQuery'
import { useAiQueryStatus } from '@/hooks/useAiQueryStatus'
import { AiQueryBox } from './AiQueryBox'

vi.mock('@/hooks/useAiQuery')
vi.mock('@/hooks/useAiQueryStatus')

const IDLE_QUERY = { status: 'idle', answer: '', grounding: [], errorMessage: null, ask: vi.fn() }

describe('AiQueryBox', () => {
  it('renders nothing while unavailable or loading', () => {
    useAiQuery.mockReturnValue(IDLE_QUERY)

    useAiQueryStatus.mockReturnValue({ data: undefined })
    const { container: loadingContainer } = render(<AiQueryBox />)
    expect(loadingContainer).toBeEmptyDOMElement()

    useAiQueryStatus.mockReturnValue({ data: { available: false } })
    const { container: unavailableContainer } = render(<AiQueryBox />)
    expect(unavailableContainer).toBeEmptyDOMElement()
  })

  it('submitting calls ask with the trimmed question', async () => {
    useAiQueryStatus.mockReturnValue({ data: { available: true } })
    const ask = vi.fn()
    useAiQuery.mockReturnValue({ ...IDLE_QUERY, ask })

    render(<AiQueryBox />)
    await userEvent.type(screen.getByLabelText('Question'), '  average salary?  ')
    await userEvent.click(screen.getByRole('button', { name: 'Ask' }))

    expect(ask).toHaveBeenCalledWith('average salary?')
  })

  it('input and button are disabled while pending', () => {
    useAiQueryStatus.mockReturnValue({ data: { available: true } })
    useAiQuery.mockReturnValue({ ...IDLE_QUERY, status: 'pending' })

    render(<AiQueryBox />)

    expect(screen.getByLabelText('Question')).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Ask' })).toBeDisabled()
  })

  it('shows "Thinking…" only until the first chunk arrives', () => {
    useAiQueryStatus.mockReturnValue({ data: { available: true } })
    useAiQuery.mockReturnValue({ ...IDLE_QUERY, status: 'pending', answer: '' })

    const { rerender } = render(<AiQueryBox />)
    expect(screen.getByText('Thinking…')).toBeInTheDocument()

    useAiQuery.mockReturnValue({ ...IDLE_QUERY, status: 'pending', answer: 'The average' })
    rerender(<AiQueryBox />)

    expect(screen.queryByText('Thinking…')).not.toBeInTheDocument()
    expect(screen.getByText('The average')).toBeInTheDocument()
  })

  it('renders the grounding list once done', () => {
    useAiQueryStatus.mockReturnValue({ data: { available: true } })
    useAiQuery.mockReturnValue({
      ...IDLE_QUERY,
      status: 'done',
      answer: 'It is $90k.',
      grounding: [{ tool: 'get_kpi_summary', arguments: { department_id: 3 } }],
    })

    render(<AiQueryBox />)

    expect(screen.getByText('get_kpi_summary({"department_id":3})')).toBeInTheDocument()
  })

  it('renders an inline error without clearing a partial answer', () => {
    useAiQueryStatus.mockReturnValue({ data: { available: true } })
    useAiQuery.mockReturnValue({
      ...IDLE_QUERY,
      status: 'error',
      answer: 'Partial answer',
      errorMessage: 'AI query is temporarily unavailable',
    })

    render(<AiQueryBox />)

    expect(screen.getByText('Partial answer')).toBeInTheDocument()
    expect(screen.getByRole('alert')).toHaveTextContent('AI query is temporarily unavailable')
  })
})
