import { describe, expect, it } from 'vitest'
import { formatApiErrorDetail } from './apiError'

describe('formatApiErrorDetail', () => {
  it('passes a plain string detail through unchanged', () => {
    expect(formatApiErrorDetail({ detail: 'Email is already in use' })).toBe('Email is already in use')
  })

  it('joins FastAPI validation-error objects into readable text', () => {
    const error = {
      detail: [
        { loc: ['body', 'salary_local'], msg: 'Input should be greater than 0', type: 'greater_than' },
        { loc: ['body', 'email'], msg: 'value is not a valid email address', type: 'value_error' },
      ],
    }

    const message = formatApiErrorDetail(error)

    expect(message).toContain('Input should be greater than 0')
    expect(message).toContain('value is not a valid email address')
  })

  it('falls back to a generic message when detail is missing or malformed', () => {
    expect(formatApiErrorDetail({})).toBe('Something went wrong. Please try again.')
    expect(formatApiErrorDetail({ detail: {} })).toBe('Something went wrong. Please try again.')
    expect(formatApiErrorDetail(undefined)).toBe('Something went wrong. Please try again.')
  })

  it('accepts a custom fallback message', () => {
    expect(formatApiErrorDetail({}, 'Could not save employee.')).toBe('Could not save employee.')
  })
})
