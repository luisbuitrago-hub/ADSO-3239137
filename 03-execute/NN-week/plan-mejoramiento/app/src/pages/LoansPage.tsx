import { useCallback } from 'react'
import { Link, useSearchParams } from 'react-router'
import { DataError, Empty, Loading, Pagination } from '../components/DataViews'
import { NeighborPicker } from '../components/NeighborPicker'
import { useListParams } from '../hooks/useListParams'
import { useLoans } from '../hooks/useLoans'
import { useRemote } from '../hooks/useRemote'
import { statusName, utcDate } from '../services/loans'

export function LoansPage() {
  const api = useLoans()
  const [params] = useSearchParams()
  const { page, size, update } = useListParams()
  const status = params.get('status') || ''
  const from = params.get('from') || ''
  const to = params.get('to') || ''
  const neighborId = params.get('neighbor_id') || ''
  const state = useRemote(
    `loans:${status}:${from}:${to}:${neighborId}:${page}:${size}`,
    useCallback(
      (signal: AbortSignal) =>
        api.list({ status, from, to, neighbor_id: neighborId, page, size }, signal),
      [api, status, from, to, neighborId, page, size],
    ),
  )
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">ENTREGAS Y DEVOLUCIONES</span>
          <h1>Préstamos</h1>
          <p className="muted">Fechas y rangos inclusivos en UTC. Una unidad por línea.</p>
        </div>
        <Link className="button button-primary" to="/loans/new">
          Registrar préstamo
        </Link>
      </div>
      <div className="filter-bar">
        <div className="form-field">
          <label htmlFor="loan-status">Estado</label>
          <select
            id="loan-status"
            value={status}
            onChange={(e) => update({ status: e.target.value, page: 1 })}
          >
            <option value="">Todos</option>
            <option value="open">Abierto</option>
            <option value="overdue">Vencido</option>
            <option value="closed">Cerrado</option>
          </select>
        </div>
        <div className="form-field">
          <label htmlFor="loan-from">Desde (UTC)</label>
          <input
            type="date"
            id="loan-from"
            value={from}
            onChange={(e) => update({ from: e.target.value, page: 1 })}
          />
        </div>
        <div className="form-field">
          <label htmlFor="loan-to">Hasta (UTC)</label>
          <input
            type="date"
            id="loan-to"
            value={to}
            onChange={(e) => update({ to: e.target.value, page: 1 })}
          />
        </div>
        <button
          className="button button-secondary"
          onClick={() => update({ status: '', from: '', to: '', neighbor_id: '', page: 1 })}
        >
          Limpiar filtros
        </button>
      </div>
      <details>
        <summary>Filtrar por vecino</summary>
        <NeighborPicker
          value={neighborId}
          onChange={(id) => update({ neighbor_id: id, page: 1 })}
        />
      </details>
      {state.loading ? (
        <Loading label="Cargando préstamos…" />
      ) : state.error ? (
        <DataError error={state.error} retry={state.reload} />
      ) : (
        state.data && (
          <>
            {state.data.items.length === 0 ? (
              <Empty title="No encontramos préstamos">
                <p>Prueba otros filtros o registra un préstamo.</p>
              </Empty>
            ) : (
              <div
                className="table-scroll"
                tabIndex={0}
                role="region"
                aria-label="Listado de préstamos"
              >
                <table>
                  <caption className="sr-only">Préstamos registrados</caption>
                  <thead>
                    <tr>
                      <th scope="col">Préstamo / vecino</th>
                      <th scope="col">Entrega</th>
                      <th scope="col">Estado</th>
                      <th scope="col">Artículos históricos</th>
                      <th scope="col">Acción</th>
                    </tr>
                  </thead>
                  <tbody>
                    {state.data.items.map((loan) => (
                      <tr key={loan.id}>
                        <td>
                          <span className="record-id">{loan.id}</span>
                          <Link to={`/neighbors/${loan.neighbor_id}`}>Consultar vecino</Link>
                        </td>
                        <td>{utcDate(loan.loaned_at)}</td>
                        <td>{statusName[loan.status]}</td>
                        <td>{loan.items.map((item) => item.article_name).join(', ')}</td>
                        <td>
                          <Link
                            to={`/loans/${loan.id}`}
                            aria-label={`Ver detalle del préstamo ${loan.id}`}
                          >
                            Ver detalle
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <Pagination
              page={state.data.page}
              size={state.data.size}
              total={state.data.total}
              onPage={(value) => update({ page: value })}
              onSize={(value) => update({ size: value, page: 1 })}
            />
          </>
        )
      )}
    </>
  )
}
