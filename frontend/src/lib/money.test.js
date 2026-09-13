import { describe, expect, it } from 'vitest'
import { formatLocalCurrency, formatUsd, formatUsdCompact, parseMoney } from './money'

describe('parseMoney', () => {
  it('parses a decimal string to a number', () => {
    expect(parseMoney('80000.00')).toBe(80000)
  })

  it('returns 0 for empty, null, undefined, or malformed input', () => {
    expect(parseMoney('')).toBe(0)
    expect(parseMoney(null)).toBe(0)
    expect(parseMoney(undefined)).toBe(0)
    expect(parseMoney('not-a-number')).toBe(0)
  })
})

describe('formatUsd', () => {
  it('formats a large payroll figure with no decimal noise', () => {
    expect(formatUsd(712345678)).toBe('$712,345,678')
  })

  it('formats zero', () => {
    expect(formatUsd(0)).toBe('$0')
  })
})

describe('formatUsdCompact', () => {
  it('formats a large payroll figure compactly, for chart axis ticks', () => {
    expect(formatUsdCompact(712345678)).toBe('$712.3M')
  })
})

describe('formatLocalCurrency', () => {
  it('formats a value in the given currency, not always USD', () => {
    expect(formatLocalCurrency(1200000, 'INR')).toBe('₹1,200,000')
    expect(formatLocalCurrency(80000, 'EUR')).toBe('€80,000')
  })
})
