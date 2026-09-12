import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { MemoryRouter } from 'react-router'
import { App } from './App'

function renderAt(path) {
  render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>,
  )
}

describe('App routing', () => {
  it('renders the Dashboard heading at /', () => {
    renderAt('/')

    expect(
      screen.getByRole('heading', { name: 'Dashboard' }),
    ).toBeInTheDocument()
  })

  it('renders the Employees heading at /employees', () => {
    renderAt('/employees')

    expect(
      screen.getByRole('heading', { name: 'Employees' }),
    ).toBeInTheDocument()
  })

  it('renders not-found copy at an unknown path', () => {
    renderAt('/does-not-exist')

    expect(
      screen.getByRole('heading', { name: 'Page not found' }),
    ).toBeInTheDocument()
  })
})
