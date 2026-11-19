import { useCallback, useState } from 'react'
import { useAdministration } from '../hooks/useAdministration'
import { useRemote } from '../hooks/useRemote'
import { DataError, Loading } from './DataViews'
function HealthResult() {
  const api = useAdministration()
  const state = useRemote(
    'health',
    useCallback((signal: AbortSignal) => api.health(signal), [api]),
  )
  return state.loading ? (
    <Loading label="Comprobando servicio…" />
  ) : state.error ? (
    <DataError error={state.error} retry={state.reload} />
  ) : (
    <p role="status">{state.data}</p>
  )
}
export function ServiceStatus() {
  const [revision, setRevision] = useState(0)
  return (
    <section className="detail-panel">
      <h2>Estado del servicio</h2>
      <button
        className="button button-secondary"
        type="button"
        onClick={() => setRevision((value) => value + 1)}
      >
        Comprobar servicio
      </button>
      {revision > 0 && <HealthResult key={revision} />}
    </section>
  )
}
