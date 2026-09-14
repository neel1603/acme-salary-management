import { useCallback, useEffect, useRef, useState } from 'react'
import { streamAiQuery } from '@/api/aiQuery'
import { formatApiErrorDetail } from '@/lib/apiError'

const IDLE_STATE = { status: 'idle', answer: '', grounding: [], errorMessage: null }

// Hand-rolled instead of a TanStack Query mutation: there's no cache key worth keeping for a
// one-shot, incrementally-updating stream (see docs/frontend-ai-query.md), same call already
// made for useDebouncedValue.
export function useAiQuery() {
  const [state, setState] = useState(IDLE_STATE)
  const activeAbortRef = useRef(null)

  useEffect(() => () => activeAbortRef.current?.abort(), [])

  const ask = useCallback((question) => {
    activeAbortRef.current?.abort()
    const controller = new AbortController()
    activeAbortRef.current = controller

    setState({ status: 'pending', answer: '', grounding: [], errorMessage: null })

    streamAiQuery(question, {
      signal: controller.signal,
      onGrounding: (grounding) => setState((prev) => ({ ...prev, grounding })),
      onChunk: (text) => setState((prev) => ({ ...prev, answer: prev.answer + text })),
      onError: (detail) =>
        setState((prev) => ({ ...prev, status: 'error', errorMessage: formatApiErrorDetail({ detail }) })),
    }).then(() => {
      if (controller.signal.aborted) return
      setState((prev) => (prev.status === 'error' ? prev : { ...prev, status: 'done' }))
    })
  }, [])

  return { ...state, ask }
}
