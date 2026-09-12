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
    if (value === undefined || value === null) continue
    searchParams.set(key, value)
  }
  const query = searchParams.toString()
  return query ? `?${query}` : ''
}

export async function apiFetch(path, params) {
  const response = await fetch(`${BASE_URL}${path}${buildQueryString(params)}`)

  if (!response.ok) {
    const body = await response.json().catch(() => null)
    throw new ApiError(`Request to ${path} failed with status ${response.status}`, {
      status: response.status,
      detail: body?.detail,
    })
  }

  return response.json()
}
