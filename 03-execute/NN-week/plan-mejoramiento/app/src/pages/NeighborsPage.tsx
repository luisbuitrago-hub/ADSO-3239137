import { useCallback } from 'react'
import { Link } from 'react-router'
import { DataError, Empty, Flash, Loading, Pagination } from '../components/DataViews'
import { useCatalog } from '../hooks/useCatalog'
import { useListParams } from '../hooks/useListParams'
import { useRemote } from '../hooks/useRemote'

export function NeighborsPage() {
  const api = useCatalog()
  const { q, page, size, update } = useListParams()
  const state = useRemote(
    `neighbors:${q}:${page}:${size}`,
    useCallback(
      (signal: AbortSignal) => api.neighbors({ q, page, size }, signal),
      [api, q, page, size],
    ),
  )
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">NUESTRA COMUNIDAD</span>
          <h1>Vecinos</h1>
          <p className="muted">
            Consulta y registra a quienes solicitan los utensilios del salón comunal.
          </p>
        </div>
        <Link className="button button-primary" to="/neighbors/new">
          Registrar vecino
        </Link>
      </div>
      <Flash />
      <form
        className="filter-bar neighbor-search"
        key={q}
        onSubmit={(event) => {
          event.preventDefault()
          const values = new FormData(event.currentTarget)
          update({ q: String(values.get('q') || '').trim(), page: 1 })
        }}
      >
        <div>
          <label htmlFor="neighbor-search">Buscar por nombre o documento</label>
          <input id="neighbor-search" name="q" defaultValue={q} placeholder="Nombre o documento" />
        </div>
        <button className="button button-primary" type="submit">
          Buscar
        </button>
        <button
          className="button button-secondary"
          type="button"
          onClick={() => update({ q: '', page: 1 })}
        >
          Limpiar búsqueda
        </button>
      </form>
      {state.loading ? (
        <Loading label="Cargando vecinos…" />
      ) : state.error ? (
        <DataError error={state.error} retry={state.reload} />
      ) : (
        state.data && (
          <>
            <div className="results-heading">
              <h2>Vecinos registrados</h2>
              <span>
                {state.data.total} {state.data.total === 1 ? 'resultado' : 'resultados'}
              </span>
            </div>
            {state.data.items.length === 0 ? (
              <Empty title="No encontramos vecinos">
                <p>Prueba con otro nombre o documento, o registra un vecino.</p>
              </Empty>
            ) : (
              <div
                className="table-scroll"
                tabIndex={0}
                role="region"
                aria-label="Listado de vecinos"
              >
                <table>
                  <caption className="sr-only">Vecinos registrados ordenados por nombre</caption>
                  <thead>
                    <tr>
                      <th scope="col">Nombre completo</th>
                      <th scope="col">Documento</th>
                      <th scope="col">Consulta</th>
                    </tr>
                  </thead>
                  <tbody>
                    {state.data.items.map((item) => (
                      <tr key={item.id}>
                        <th scope="row">{item.full_name}</th>
                        <td>{item.document_number}</td>
                        <td>
                          <Link
                            className="table-link"
                            to={`/neighbors/${item.id}`}
                            aria-label={`Ver detalle de ${item.full_name}`}
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
