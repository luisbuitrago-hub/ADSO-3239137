import { useCallback } from 'react'
import { Link } from 'react-router'
import { DataError, Empty, Loading } from '../components/DataViews'
import { useLoans } from '../hooks/useLoans'
import { useRemote } from '../hooks/useRemote'
import { utcDate } from '../services/loans'

export function OverduePage() {
  const api = useLoans()
  const state = useRemote(
    'overdue',
    useCallback((signal: AbortSignal) => api.overdue(signal), [api]),
  )
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">SEGUIMIENTO</span>
          <h1>Préstamos vencidos</h1>
          <p className="muted">
            Líneas pendientes ordenadas por fecha límite, desde la más antigua. Fechas en UTC.
          </p>
        </div>
        <button className="button button-secondary" onClick={state.reload}>
          Actualizar vencimientos
        </button>
      </div>
      {state.loading ? (
        <Loading label="Cargando vencimientos…" />
      ) : state.error ? (
        <DataError error={state.error} retry={state.reload} />
      ) : (
        state.data &&
        (state.data.length === 0 ? (
          <Empty title="No hay artículos vencidos">
            <p>No hay líneas pendientes vencidas en este momento.</p>
          </Empty>
        ) : (
          <div className="table-scroll" tabIndex={0} role="region" aria-label="Artículos vencidos">
            <table>
              <caption className="sr-only">Artículos pendientes vencidos</caption>
              <thead>
                <tr>
                  <th scope="col">Vecino</th>
                  <th scope="col">Artículo histórico</th>
                  <th scope="col">Fecha límite</th>
                  <th scope="col">Días completos de atraso</th>
                  <th scope="col">Acción</th>
                </tr>
              </thead>
              <tbody>
                {state.data.map((item) => (
                  <tr key={item.item_id}>
                    <td>{item.neighbor_name}</td>
                    <td>{item.article_name}</td>
                    <td>{utcDate(item.due_at)}</td>
                    <td>{item.days_late}</td>
                    <td>
                      <Link to={`/loans/${item.loan_id}`}>Ver préstamo y devolver</Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))
      )}
    </>
  )
}
