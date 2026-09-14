import { parseSseEvents } from '@/lib/sse'
import { apiFetch, BASE_URL, extractErrorDetail } from './client'

export async function fetchAiQueryStatus() {
  return apiFetch('/ai-query/status')
}

// Doesn't reuse apiFetch/apiMutate: a successful response here isn't JSON, it's a byte stream,
// while a failed one is plain JSON exactly like every other endpoint -- so this checks
// response.ok itself before deciding which of the two to do. Reports everything through
// callbacks rather than a return value/throw, since results arrive incrementally over time
// rather than once. An aborted `signal` (a new question superseding this one, or the caller
// unmounting) ends the read loop quietly -- that's an expected way to stop, not a failure.
export async function streamAiQuery(question, { onGrounding, onChunk, onError, signal } = {}) {
  try {
    const response = await fetch(`${BASE_URL}/ai-query`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question }),
      signal,
    })

    if (!response.ok) {
      onError?.(await extractErrorDetail(response))
      return
    }

    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''

    while (true) {
      const { done, value } = await reader.read()
      if (done) return

      buffer += decoder.decode(value, { stream: true })
      const parsed = parseSseEvents(buffer)
      buffer = parsed.remainder

      for (const { event, data } of parsed.events) {
        if (event === 'grounding') onGrounding?.(data.grounding)
        else if (event === 'chunk') onChunk?.(data.text)
        else if (event === 'error') onError?.(data.detail)
      }
    }
  } catch (error) {
    if (error.name === 'AbortError') return
    throw error
  }
}
