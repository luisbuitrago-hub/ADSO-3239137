import { useCallback } from 'react'
import { Link } from 'react-router'
import { useCatalog } from '../hooks/useCatalog'
import { useRemote } from '../hooks/useRemote'
import { DataError, Empty, Loading } from '../components/DataViews'
import { Icon } from '../components/Icon'

export function CategoriesPage() {
  const api = useCatalog()
  const state = useRemote(
    'categories',
    useCallback((signal: AbortSignal) => api.categories(signal), [api]),
  )
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">CATÁLOGO COMUNITARIO</span>
          <h1>Categorías</h1>
          <p className="muted">
            Las categorías del salón comunal. Selecciona una para consultar sus artículos.
          </p>
        </div>
        <Link className="button button-secondary" to="/articles">
          Ver todos los artículos
        </Link>
      </div>
      {state.loading ? (
        <Loading label="Cargando categorías…" />
      ) : state.error ? (
        <DataError error={state.error} retry={state.reload} />
      ) : state.data?.length === 0 ? (
        <Empty title="No hay categorías disponibles">
          <p>Vuelve a consultar más tarde.</p>
        </Empty>
      ) : (
        <div className="category-grid">
          {state.data?.map((item) => (
            <Link
              className="module-card"
              to={`/articles?category_id=${encodeURIComponent(item.id)}`}
              key={item.id}
            >
              <span className="module-icon">
                <Icon name="articles" />
              </span>
              <h2>{item.name}</h2>
              <span className="module-link">
                Consultar artículos <Icon name="arrow" />
              </span>
            </Link>
          ))}
        </div>
      )}
    </>
  )
}
