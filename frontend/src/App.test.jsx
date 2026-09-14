import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter } from 'react-router'
import { App } from './App'

function renderAt(path) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })

  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[path]}>
        <App />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      json: () => Promise.resolve({ detail: 'stubbed in App.test.jsx' }),
    }),
  )
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('App routing', () => {
  it('renders the Dashboard heading at /', async () => {
    renderAt('/')

    // Generous timeout: first resolution of the lazy DashboardPage chunk (pulls in recharts)
    // can take longer than findByRole's default 1000ms window in a cold test run.
    expect(
      await screen.findByRole('heading', { name: 'Dashboard' }, { timeout: 5000 }),
    ).toBeInTheDocument()
  })

  it('renders the Employees heading at /employees', async () => {
    renderAt('/employees')

    expect(
      await screen.findByRole('heading', { name: 'Employees' }, { timeout: 5000 }),
    ).toBeInTheDocument()
  })

  it('renders not-found copy at an unknown path', () => {
    renderAt('/does-not-exist')

    expect(
      screen.getByRole('heading', { name: 'Page not found' }),
    ).toBeInTheDocument()
  })
})
