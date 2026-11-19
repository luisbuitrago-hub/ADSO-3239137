import { useEffect, useState } from 'react'
import { useAdministration } from '../hooks/useAdministration'
import { ApiError } from '../services/http'
import { DataError, Loading } from './DataViews'

function CoverImage({ id, name }: { id: string; name: string }) {
  const api = useAdministration()
  const [state, setState] = useState<{ url?: string; error?: ApiError }>({})
  const [revision, setRevision] = useState(0)
  useEffect(() => {
    const controller = new AbortController()
    let url: string | undefined
    void api
      .cover(id, controller.signal)
      .then((blob) => {
        if (controller.signal.aborted) return
        url = URL.createObjectURL(blob)
        setState({ url })
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted)
          setState({
            error:
              error instanceof ApiError
                ? error
                : new ApiError(0, 'NETWORK_ERROR', 'No pudimos cargar la imagen.'),
          })
      })
    return () => {
      controller.abort()
      if (url) URL.revokeObjectURL(url)
    }
  }, [api, id, revision])
  if (state.error?.status === 404) return <p className="cover-placeholder">Sin imagen disponible</p>
  if (state.error)
    return (
      <DataError
        error={state.error}
        retry={() => {
          setState({})
          setRevision((value) => value + 1)
        }}
      />
    )
  return state.url ? (
    <img
      className="article-cover"
      src={state.url}
      alt={`Imagen de ${name}`}
      onError={() =>
        setState({
          error: new ApiError(0, 'INVALID_IMAGE', 'No pudimos mostrar la imagen recibida.'),
        })
      }
    />
  ) : (
    <Loading label="Cargando imagen…" />
  )
}
export function ArticleCover({
  id,
  name,
  coverKey,
}: {
  id: string
  name: string
  coverKey: string | null
}) {
  return coverKey ? (
    <CoverImage key={`${id}:${coverKey}`} id={id} name={name} />
  ) : (
    <p className="cover-placeholder">Sin imagen disponible</p>
  )
}
