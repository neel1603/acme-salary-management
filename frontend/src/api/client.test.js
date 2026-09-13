import { afterEach, describe, expect, it, vi } from 'vitest'
import { apiFetch, apiMutate, ApiError } from './client'

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

  it('drops an empty-string param the same as unset, instead of sending a literal "key="', async () => {
    stubFetchOnce(jsonResponse({}))

    await apiFetch('/employees', { search: '', department_id: 3 })

    const requestedUrl = fetch.mock.calls[0][0]
    expect(requestedUrl).not.toContain('search')
    expect(requestedUrl).toContain('department_id=3')
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

describe('apiMutate', () => {
  it('sends the given method and a JSON-encoded body', async () => {
    stubFetchOnce(jsonResponse({ id: 1 }, { status: 201 }))

    await apiMutate('/employees', { method: 'POST', body: { first_name: 'Ada' } })

    const [url, options] = fetch.mock.calls[0]
    expect(url).toContain('/employees')
    expect(options.method).toBe('POST')
    expect(options.headers).toMatchObject({ 'Content-Type': 'application/json' })
    expect(JSON.parse(options.body)).toEqual({ first_name: 'Ada' })
  })

  it('sends no body for a method that needs none, e.g. deactivate', async () => {
    stubFetchOnce(jsonResponse({ id: 1 }))

    await apiMutate('/employees/1/deactivate', { method: 'PATCH' })

    const [, options] = fetch.mock.calls[0]
    expect(options.body).toBeUndefined()
    expect(options.headers).toBeUndefined()
  })

  it('throws an ApiError with status + detail on a non-2xx response, same as apiFetch', async () => {
    stubFetchOnce(jsonResponse({ detail: 'Email is already in use' }, { ok: false, status: 409 }))

    await expect(apiMutate('/employees', { method: 'POST', body: {} })).rejects.toMatchObject({
      status: 409,
      detail: 'Email is already in use',
    })
  })
})
