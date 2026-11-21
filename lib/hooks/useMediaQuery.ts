'use client'

import { useCallback, useSyncExternalStore } from 'react'

/**
 * True while the media query matches. The server render (and the first client render) uses
 * `serverValue`, then React switches to the real value without a hydration mismatch.
 */
export function useMediaQuery(query: string, serverValue = false) {
  const subscribe = useCallback(
    (onChange: () => void) => {
      const list = window.matchMedia(query)
      list.addEventListener('change', onChange)
      return () => list.removeEventListener('change', onChange)
    },
    [query],
  )
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(query).matches,
    () => serverValue,
  )
}
