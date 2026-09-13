const BASE_URL = import.meta.env.VITE_API_BASE_URL

export class ApiError extends Error {
  constructor(message, { status, detail } = {}) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.detail = detail
  }
}

function buildQueryString(params) {
  const searchParams = new URLSearchParams()
  for (const [key, value] of Object.entries(params ?? {})) {
    // '' is treated the same as unset -- a cleared search box should send no `search` param at
    // all, not a literal `search=` (which would be a distinct, redundant cache key/request).
    if (value === undefined || value === null || value === '') continue
    searchParams.set(key, value)
  }
  const query = searchParams.toString()
  return query ? `?${query}` : ''
}

async function handleResponse(response, path) {
  if (!response.ok) {
    const body = await response.json().catch(() => null)
    throw new ApiError(`Request to ${path} failed with status ${response.status}`, {
      status: response.status,
      detail: body?.detail,
    })
  }

  return response.json()
}

export async function apiFetch(path, params) {
  const response = await fetch(`${BASE_URL}${path}${buildQueryString(params)}`)
  return handleResponse(response, path)
}

// Sibling to apiFetch for writes. Kept as a separate function (rather than widening apiFetch's
// signature) so every existing GET call site -- kpis.js, breakdowns.js, lookups.js, employees.js's
// own reads -- stays untouched, and so "builds a query string" and "sends a body" stay two things
// a reader can look at separately instead of one function branching on which one was meant.
export async function apiMutate(path, { method, body } = {}) {
  const response = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  return handleResponse(response, path)
}
