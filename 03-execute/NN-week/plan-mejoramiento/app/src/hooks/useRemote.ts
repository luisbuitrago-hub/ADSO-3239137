import { useCallback, useEffect, useState } from 'react'
import { ApiError } from '../services/http'

export function useRemote<T>(key: string, load: (signal: AbortSignal) => Promise<T>) {
  const [revision, setRevision] = useState(0)
  const requestKey = `${key}:${revision}`
  const [state, setState] = useState<{ key: string; data: T | null; error: ApiError | null }>({
    key: '',
    data: null,
    error: null,
  })
  useEffect(() => {
    const controller = new AbortController()
    void load(controller.signal)
      .then((data) => {
        if (!controller.signal.aborted) setState({ key: requestKey, data, error: null })
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted)
          setState({
            key: requestKey,
            data: null,
            error:
              error instanceof ApiError
                ? error
                : new ApiError(
                    0,
                    'NETWORK_ERROR',
                    'No pudimos cargar la información. Inténtalo nuevamente.',
                  ),
          })
      })
    return () => controller.abort()
  }, [requestKey, load])
  return {
    data: state.key === requestKey ? state.data : null,
    error: state.key === requestKey ? state.error : null,
    loading: state.key !== requestKey,
    reload: useCallback(() => setRevision((value) => value + 1), []),
  }
}
