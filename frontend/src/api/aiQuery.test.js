import { afterEach, describe, expect, it, vi } from 'vitest'
import { fetchAiQueryStatus, streamAiQuery } from './aiQuery'

const GROUNDING_FRAME = 'event: grounding\ndata: {"grounding":[{"tool":"get_kpi_summary","arguments":{}}]}\n\n'
const CHUNK_FRAME_1 = 'event: chunk\ndata: {"text":"Hello "}\n\n'
const CHUNK_FRAME_2 = 'event: chunk\ndata: {"text":"there"}\n\n'
const ERROR_FRAME = 'event: error\ndata: {"detail":"AI query is temporarily unavailable"}\n\n'

function streamFromFrames(frames) {
  const encoder = new TextEncoder()
  let index = 0
  return {
    getReader() {
      return {
        read() {
          if (index >= frames.length) return Promise.resolve({ done: true, value: undefined })
          const value = encoder.encode(frames[index])
          index += 1
          return Promise.resolve({ done: false, value })
        },
      }
    },
  }
}

function stubStreamResponse(frames) {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({ ok: true, status: 200, body: streamFromFrames(frames) }),
  )
}

function stubErrorResponse(detail, status) {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({ ok: false, status, json: () => Promise.resolve({ detail }) }),
  )
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('fetchAiQueryStatus', () => {
  it('passes the wire response through unchanged', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true, status: 200, json: () => Promise.resolve({ available: true }) }),
    )

    await expect(fetchAiQueryStatus()).resolves.toEqual({ available: true })
  })
})

describe('streamAiQuery', () => {
  it('calls onGrounding before any onChunk', async () => {
    stubStreamResponse([GROUNDING_FRAME, CHUNK_FRAME_1])
    const calls = []

    await streamAiQuery('how many employees?', {
      onGrounding: () => calls.push('grounding'),
      onChunk: () => calls.push('chunk'),
    })

    expect(calls).toEqual(['grounding', 'chunk'])
  })

  it('calls onChunk once per chunk event, in order', async () => {
    stubStreamResponse([GROUNDING_FRAME, CHUNK_FRAME_1, CHUNK_FRAME_2])
    const chunks = []

    await streamAiQuery('how many employees?', { onChunk: (text) => chunks.push(text) })

    expect(chunks).toEqual(['Hello ', 'there'])
  })

  it('a non-2xx initial response calls onError and never reads a stream', async () => {
    stubErrorResponse('AI query is not configured', 503)
    const onChunk = vi.fn()
    const onError = vi.fn()

    await streamAiQuery('how many employees?', { onChunk, onError })

    expect(onError).toHaveBeenCalledWith('AI query is not configured')
    expect(onChunk).not.toHaveBeenCalled()
  })

  it('a mid-stream error event calls onError without another onChunk', async () => {
    stubStreamResponse([GROUNDING_FRAME, CHUNK_FRAME_1, ERROR_FRAME])
    const chunks = []
    const errors = []

    await streamAiQuery('how many employees?', {
      onChunk: (text) => chunks.push(text),
      onError: (detail) => errors.push(detail),
    })

    expect(chunks).toEqual(['Hello '])
    expect(errors).toEqual(['AI query is temporarily unavailable'])
  })

  it('aborting the given signal stops reading without throwing', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new DOMException('Aborted', 'AbortError')))
    const onError = vi.fn()
    const onChunk = vi.fn()

    await expect(
      streamAiQuery('how many employees?', { onChunk, onError, signal: new AbortController().signal }),
    ).resolves.toBeUndefined()
    expect(onError).not.toHaveBeenCalled()
    expect(onChunk).not.toHaveBeenCalled()
  })
})
