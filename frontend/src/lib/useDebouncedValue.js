import { useEffect, useState } from 'react'

// The first free-text filter in the app -- narrow enough that a library would be more code than
// this. `value` should update immediately in the input for responsive typing; only the returned
// debounced value should feed a query key, so keystrokes don't each trigger a request.
export function useDebouncedValue(value, delayMs = 300) {
  const [debounced, setDebounced] = useState(value)

  useEffect(() => {
    const timeoutId = setTimeout(() => setDebounced(value), delayMs)
    return () => clearTimeout(timeoutId)
  }, [value, delayMs])

  return debounced
}
