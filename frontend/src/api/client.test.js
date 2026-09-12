import { afterEach, describe, expect, it, vi } from 'vitest'
import { apiFetch, ApiError } from './client'

function stubFetchOnce(response) {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response))
}

function jsonResponse(body, { ok = true, status = 200 } = {}) {
  return { ok, status, json: () => Promise.resolve(body) }
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('apiFetch query string', () => {
  it('drops unset params and keeps an explicit "All" value', async () => {
    stubFetchOnce(jsonResponse({}))

    await apiFetch('/kpis/summary', {
      department_id: undefined,
      country_id: null,
      employment_status: 'All',
    })

    const requestedUrl = fetch.mock.calls[0][0]
    expect(requestedUrl).toContain('employment_status=All')
    expect(requestedUrl).not.toContain('department_id')
    expect(requestedUrl).not.toContain('country_id')
  })

  it('requests a bare path when no params are given', async () => {
    stubFetchOnce(jsonResponse([]))

    await apiFetch('/countries')

    expect(fetch.mock.calls[0][0]).not.toContain('?')
  })
})

describe('apiFetch error handling', () => {
  it('throws an ApiError carrying the status and server detail on a non-2xx response', async () => {
    stubFetchOnce(jsonResponse({ detail: 'Employee not found' }, { ok: false, status: 404 }))

    await expect(apiFetch('/employees/999')).rejects.toMatchObject({
      status: 404,
      detail: 'Employee not found',
    })
    await expect(apiFetch('/employees/999')).rejects.toBeInstanceOf(ApiError)
  })
})
