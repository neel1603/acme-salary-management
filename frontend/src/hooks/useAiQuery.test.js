import { act, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { streamAiQuery } from '@/api/aiQuery'
import { useAiQuery } from './useAiQuery'

vi.mock('@/api/aiQuery', () => ({ streamAiQuery: vi.fn() }))

function deferred() {
  let resolve
  const promise = new Promise((res) => {
    resolve = res
  })
  return { promise, resolve }
}

afterEach(() => {
  vi.clearAllMocks()
})

describe('useAiQuery', () => {
  it('ask() goes idle -> pending -> done with the final answer/grounding', async () => {
    const { promise, resolve } = deferred()
    let callbacks
    streamAiQuery.mockImplementation((question, opts) => {
      callbacks = opts
      return promise
    })

    const { result } = renderHook(() => useAiQuery())
    expect(result.current.status).toBe('idle')

    act(() => result.current.ask('average salary in Engineering?'))
    expect(result.current.status).toBe('pending')

    act(() => {
      callbacks.onGrounding([{ tool: 'get_kpi_summary', arguments: {} }])
      callbacks.onChunk('The average ')
      callbacks.onChunk('is $90k.')
    })
    expect(result.current.answer).toBe('The average is $90k.')
    expect(result.current.grounding).toEqual([{ tool: 'get_kpi_summary', arguments: {} }])
    expect(result.current.status).toBe('pending')

    await act(async () => resolve())
    expect(result.current.status).toBe('done')
  })

  it('a second ask() aborts the first', () => {
    const signals = []
    streamAiQuery.mockImplementation((question, { signal }) => {
      signals.push(signal)
      return new Promise(() => {})
    })

    const { result } = renderHook(() => useAiQuery())

    act(() => result.current.ask('first question'))
    act(() => result.current.ask('second question'))

    expect(signals).toHaveLength(2)
    expect(signals[0].aborted).toBe(true)
    expect(signals[1].aborted).toBe(false)
    expect(result.current.status).toBe('pending')
    expect(result.current.answer).toBe('')
  })

  it('an initial error sets status to error with an empty answer', async () => {
    streamAiQuery.mockImplementation((question, { onError }) => {
      onError('AI query is not configured')
      return Promise.resolve()
    })

    const { result } = renderHook(() => useAiQuery())

    await act(async () => {
      result.current.ask('how many employees?')
      await Promise.resolve()
    })

    expect(result.current.status).toBe('error')
    expect(result.current.errorMessage).toBe('AI query is not configured')
    expect(result.current.answer).toBe('')
  })

  it('a mid-stream error sets status to error but keeps the partial answer', async () => {
    streamAiQuery.mockImplementation((question, { onChunk, onError }) => {
      onChunk('Partial answer')
      onError('AI query is temporarily unavailable')
      return Promise.resolve()
    })

    const { result } = renderHook(() => useAiQuery())

    await act(async () => {
      result.current.ask('how many employees?')
      await Promise.resolve()
    })

    expect(result.current.status).toBe('error')
    expect(result.current.answer).toBe('Partial answer')
    expect(result.current.errorMessage).toBe('AI query is temporarily unavailable')
  })

  it('unmounting while pending aborts the in-flight request', () => {
    let capturedSignal
    streamAiQuery.mockImplementation((question, { signal }) => {
      capturedSignal = signal
      return new Promise(() => {})
    })

    const { result, unmount } = renderHook(() => useAiQuery())
    act(() => result.current.ask('how many employees?'))

    unmount()

    expect(capturedSignal.aborted).toBe(true)
  })
})
