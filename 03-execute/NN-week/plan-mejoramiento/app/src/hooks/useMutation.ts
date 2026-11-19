import { useEffect, useRef, useState } from 'react'
import { ApiError } from '../services/http'

export function useMutation() {
  const controller = useRef<AbortController | null>(null)
  const busy = useRef(false)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<ApiError | null>(null)
  useEffect(
    () => () => {
      controller.current?.abort()
    },
    [],
  )
  async function run<T>(
    operation: (signal: AbortSignal) => Promise<T>,
  ): Promise<{ ok: true; value: T } | { ok: false }> {
    if (busy.current) return { ok: false }
    busy.current = true
    const next = new AbortController()
    controller.current = next
    setPending(true)
    setError(null)
    try {
      const value = await operation(next.signal)
      return next.signal.aborted ? { ok: false } : { ok: true, value }
    } catch (reason) {
      if (!next.signal.aborted)
        setError(
          reason instanceof ApiError
            ? reason.status === 0
              ? new ApiError(
                  0,
                  reason.code,
                  `${reason.message} No podemos confirmar si se guardó; revisa el listado antes de volver a intentarlo.`,
                )
              : reason
            : new ApiError(
                0,
                'NETWORK_ERROR',
                'No pudimos guardar los cambios. Revisa el listado antes de volver a intentarlo.',
              ),
        )
      return { ok: false }
    } finally {
      busy.current = false
      if (!next.signal.aborted) setPending(false)
    }
  }
  return { run, pending, error, clearError: () => setError(null) }
}
