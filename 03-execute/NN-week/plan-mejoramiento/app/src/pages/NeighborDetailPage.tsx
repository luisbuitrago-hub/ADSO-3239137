import { useCallback } from 'react'
import { Link, useParams } from 'react-router'
import { DataError, Flash, Loading } from '../components/DataViews'
import { useCatalog } from '../hooks/useCatalog'
import { useRemote } from '../hooks/useRemote'

export function NeighborDetailPage() {
  const { id = '' } = useParams()
  const api = useCatalog()
  const state = useRemote(
    `neighbor:${id}`,
    useCallback((signal: AbortSignal) => api.neighbor(id, signal), [api, id]),
  )
  return (
    <>
      <Link className="back-link" to="/neighbors">
        ← Volver a vecinos
      </Link>
      <Flash />
      {state.loading ? (
        <Loading label="Cargando vecino…" />
      ) : state.error ? (
        <DataError error={state.error} retry={state.reload} />
      ) : (
        state.data && (
          <>
            <div className="page-heading">
              <div>
                <span className="eyebrow">DETALLE DEL VECINO</span>
                <h1>{state.data.full_name}</h1>
                <p className="muted">Información de registro y artículos pendientes.</p>
              </div>
            </div>
            <div className="page-actions">
              <Link className="button button-primary" to={`/loans/new?neighbor_id=${id}`}>
                Registrar préstamo para este vecino
              </Link>
              <Link className="button button-secondary" to={`/loans?neighbor_id=${id}`}>
                Consultar préstamos del vecino
              </Link>
            </div>
            <section className="detail-panel" aria-label="Información del vecino">
              <h2>Información del vecino</h2>
              <dl className="detail-grid">
                <div>
                  <dt>Nombre completo</dt>
                  <dd>{state.data.full_name}</dd>
                </div>
                <div>
                  <dt>Documento</dt>
                  <dd>{state.data.document_number}</dd>
                </div>
                <div>
                  <dt>Artículos pendientes de devolución</dt>
                  <dd>{state.data.active_loans}</dd>
                </div>
              </dl>
              <p className="field-hint">
                Cuenta artículos sin devolver entre todos sus préstamos, incluidos los vencidos. No
                es la cantidad de préstamos.
              </p>
            </section>
          </>
        )
      )}
    </>
  )
}
