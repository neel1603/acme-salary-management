// Money arrives from the API as a string (Pydantic serializes Decimal that way) and is parsed
// to a number once, here, at the API-client boundary. Safe as a plain number: even a $5B total
// payroll is four orders of magnitude below Number.MAX_SAFE_INTEGER, and nothing client-side
// accumulates values — the backend already sums with Decimal.
export function parseMoney(value) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

const usdFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
})

const usdCompactFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  notation: 'compact',
  maximumFractionDigits: 1,
})

export function formatUsd(value) {
  return usdFormatter.format(value)
}

export function formatUsdCompact(value) {
  return usdCompactFormatter.format(value)
}
