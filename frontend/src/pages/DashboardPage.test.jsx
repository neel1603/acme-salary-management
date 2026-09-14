import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { useAiQuery } from '@/hooks/useAiQuery'
import { useAiQueryStatus } from '@/hooks/useAiQueryStatus'
import { useCountryBreakdown } from '@/hooks/useCountryBreakdown'
import { useDepartmentBreakdown } from '@/hooks/useDepartmentBreakdown'
import { useKpiSummary } from '@/hooks/useKpiSummary'
import { useLookups } from '@/hooks/useLookups'
import { DashboardPage } from './DashboardPage'

vi.mock('@/hooks/useKpiSummary')
vi.mock('@/hooks/useDepartmentBreakdown')
vi.mock('@/hooks/useCountryBreakdown')
vi.mock('@/hooks/useLookups')
vi.mock('@/hooks/useAiQueryStatus')
vi.mock('@/hooks/useAiQuery')

function mockHooksSteady() {
  useKpiSummary.mockReturnValue({
    data: { headcount: 100, totalPayrollUsd: 8000000, averageSalaryUsd: 80000, medianSalaryUsd: 75000 },
    isLoading: false,
    isError: false,
  })
  useDepartmentBreakdown.mockReturnValue({ data: [], isLoading: false, isError: false })
  useCountryBreakdown.mockReturnValue({ data: [], isLoading: false, isError: false })
  useLookups.mockReturnValue({
    countries: { data: [{ id: 5, name: 'Canada' }] },
    departments: { data: [{ id: 1, name: 'Engineering' }] },
  })
  useAiQueryStatus.mockReturnValue({ data: { available: true } })
  useAiQuery.mockReturnValue({ status: 'idle', answer: '', grounding: [], errorMessage: null, ask: vi.fn() })
}

describe('DashboardPage', () => {
  it('renders the KPI grid and both breakdown sections', () => {
    mockHooksSteady()

    render(<DashboardPage />)

    expect(screen.getByRole('heading', { name: 'Dashboard' })).toBeInTheDocument()
    expect(screen.getByText('Headcount')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'By Department' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'By Country' })).toBeInTheDocument()
  })

  it('renders AiQueryBox alongside the existing dashboard sections', () => {
    mockHooksSteady()

    render(<DashboardPage />)

    expect(screen.getByText('Ask a question')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'By Country' })).toBeInTheDocument()
  })

  it('defaults employment_status to Active on first render', () => {
    mockHooksSteady()

    render(<DashboardPage />)

    expect(useKpiSummary).toHaveBeenCalledWith({ employment_status: 'Active' })
  })

  it('passes a picked department filter to the KPI and country hooks, driving them to refetch', async () => {
    mockHooksSteady()

    render(<DashboardPage />)

    await userEvent.click(screen.getByLabelText('Department'))
    await userEvent.click(await screen.findByRole('option', { name: 'Engineering' }))

    const lastKpiCall = useKpiSummary.mock.calls.at(-1)[0]
    const lastCountryCall = useCountryBreakdown.mock.calls.at(-1)[0]
    expect(lastKpiCall).toEqual({ employment_status: 'Active', department_id: 1 })
    expect(lastCountryCall).toEqual({ employment_status: 'Active', department_id: 1 })
  })
})
