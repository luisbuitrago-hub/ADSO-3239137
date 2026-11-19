import { useCallback } from 'react'
import { Link } from 'react-router'
import { useAuth } from '../auth/context'
import { DataError, Empty, Flash, Loading, Pagination } from '../components/DataViews'
import { useCatalog } from '../hooks/useCatalog'
import { useRemote } from '../hooks/useRemote'
import { useListParams } from '../hooks/useListParams'

export function ArticlesPage() {
  const { session } = useAuth()
  const api = useCatalog()
  const { q, categoryId, page, size, update } = useListParams()
  const categories = useRemote(
    'categories',
    useCallback((signal: AbortSignal) => api.categories(signal), [api]),
  )
  const state = useRemote(
    `articles:${q}:${categoryId}:${page}:${size}`,
    useCallback(
      (signal: AbortSignal) =>
        api.articles({ q, category_id: categoryId || undefined, page, size }, signal),
      [api, q, categoryId, page, size],
    ),
  )
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">CATÁLOGO COMUNITARIO</span>
          <h1>Artículos</h1>
          <p className="muted">Consulta los utensilios activos y sus unidades disponibles.</p>
        </div>
        <div className="page-actions">
          <Link className="button button-secondary" to="/categories">
            Categorías
          </Link>
          {session?.role === 'admin' && (
            <Link className="button button-primary" to="/articles/new">
              Registrar artículo
            </Link>
          )}
        </div>
      </div>
      <Flash />
      <form
        className="filter-bar"
        key={q}
        onSubmit={(event) => {
          event.preventDefault()
          const values = new FormData(event.currentTarget)
          update({
            q: String(values.get('q') || '').trim(),
            category_id: String(values.get('category_id') || ''),
            page: 1,
          })
        }}
      >
        <div>
          <label htmlFor="article-search">Buscar por nombre o descripción</label>
          <input id="article-search" name="q" defaultValue={q} placeholder="Escribe para buscar" />
        </div>
        <div>
          <label htmlFor="article-category">Categoría</label>
          <select
            id="article-category"
            name="category_id"
            value={categoryId}
            onChange={(event) => update({ category_id: event.target.value, page: 1 })}
            disabled={categories.loading || !!categories.error}
          >
            <option value="">Todas las categorías</option>
            {categories.data?.map((item) => (
              <option value={item.id} key={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </div>
        <button className="button button-primary" type="submit">
          Buscar
        </button>
        <button
          className="button button-secondary"
          type="button"
          onClick={() => update({ q: '', category_id: '', page: 1 })}
        >
          Limpiar filtros
        </button>
      </form>
      {categories.loading && <Loading label="Cargando categorías…" />}
      {categories.error && <DataError error={categories.error} retry={categories.reload} />}
      {categories.data?.length === 0 && (
        <p className="notice">No hay categorías disponibles para filtrar.</p>
      )}
      {state.loading ? (
        <Loading label="Cargando artículos…" />
      ) : state.error ? (
        <DataError error={state.error} retry={state.reload} />
      ) : (
        state.data && (
          <>
            <div className="results-heading">
              <h2>Artículos del catálogo</h2>
              <span>
                {state.data.total} {state.data.total === 1 ? 'resultado' : 'resultados'}
              </span>
            </div>
            {state.data.items.length === 0 ? (
              <Empty title="No encontramos artículos">
                <p>Prueba con otra búsqueda o categoría.</p>
              </Empty>
            ) : (
              <div
                className="table-scroll"
                tabIndex={0}
                role="region"
                aria-label="Listado de artículos"
              >
                <table>
                  <caption className="sr-only">Artículos activos ordenados por nombre</caption>
                  <thead>
                    <tr>
                      <th scope="col">Artículo</th>
                      <th scope="col">Referencia</th>
                      <th scope="col">Categoría</th>
                      <th scope="col">Disponibles / total</th>
                      <th scope="col">Consulta</th>
                    </tr>
                  </thead>
                  <tbody>
                    {state.data.items.map((item) => (
                      <tr key={item.id}>
                        <th scope="row">{item.name}</th>
                        <td>{item.reference}</td>
                        <td>{item.category.name}</td>
                        <td>
                          <span
                            className={
                              item.available_units === 0 ? 'stock-badge empty-stock' : 'stock-badge'
                            }
                          >
                            {item.available_units} / {item.total_units}
                          </span>
                        </td>
                        <td>
                          <Link
                            className="table-link"
                            to={`/articles/${item.id}`}
                            aria-label={`Ver detalle de ${item.name}`}
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
