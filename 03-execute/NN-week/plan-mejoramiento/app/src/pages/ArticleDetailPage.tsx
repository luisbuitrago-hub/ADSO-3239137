import { useCallback, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { useAuth } from '../auth/context'
import { DataError, Flash, Loading } from '../components/DataViews'
import { useCatalog } from '../hooks/useCatalog'
import { useRemote } from '../hooks/useRemote'
import { useMutation } from '../hooks/useMutation'

export function ArticleDetailPage() {
  const { id = '' } = useParams()
  const { session } = useAuth()
  const api = useCatalog()
  const navigate = useNavigate()
  const state = useRemote(
    `article:${id}`,
    useCallback((signal: AbortSignal) => api.article(id, signal), [api, id]),
  )
  const mutation = useMutation()
  const [confirm, setConfirm] = useState(false)
  const confirmButton = useRef<HTMLButtonElement>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  async function deactivate() {
    const result = await mutation.run((signal) => api.deactivateArticle(id, signal))
    if (result.ok)
      navigate('/articles', {
        replace: true,
        state: { flash: 'Artículo desactivado correctamente. Su historial se conserva.' },
      })
  }
  const item = state.data
  return (
    <>
      <Link className="back-link" to="/articles">
        ← Volver al catálogo
      </Link>
      <Flash />
      {state.loading ? (
        <Loading label="Cargando artículo…" />
      ) : state.error ? (
        <DataError error={state.error} retry={state.reload} />
      ) : (
        item && (
          <>
            <div className="page-heading">
              <div>
                <span className="eyebrow">DETALLE DEL ARTÍCULO</span>
                <h1>{item.name}</h1>
                <p className="muted">Referencia: {item.reference}</p>
              </div>
              {session?.role === 'admin' && (
                <div className="page-actions">
                  <Link className="button button-secondary" to={`/articles/${id}/edit`}>
                    Editar artículo
                  </Link>
                  <button
                    className="button button-danger"
                    type="button"
                    ref={trigger}
                    onClick={() => {
                      mutation.clearError()
                      setConfirm(true)
                      requestAnimationFrame(() => confirmButton.current?.focus())
                    }}
                  >
                    Desactivar artículo
                  </button>
                </div>
              )}
            </div>
            <div className="page-actions">
              <Link className="button button-secondary" to="/loans/new">
                Registrar préstamo
              </Link>
              <Link className="button button-secondary" to="/loans">
                Consultar préstamos
              </Link>
            </div>
            {confirm && session?.role === 'admin' && (
              <section className="confirm-panel" aria-labelledby="confirm-title">
                <h2 id="confirm-title">¿Desactivar este artículo?</h2>
                <p>
                  Dejará de aparecer en el catálogo activo. Su historial se conserva. No se permite
                  la baja si tiene unidades pendientes de devolución.
                </p>
                {mutation.error && <DataError error={mutation.error} />}
                <div className="page-actions">
                  <button
                    className="button button-danger"
                    type="button"
                    ref={confirmButton}
                    disabled={mutation.pending}
                    onClick={() => void deactivate()}
                  >
                    {mutation.pending ? 'Desactivando…' : 'Confirmar desactivación'}
                  </button>
                  <button
                    className="button button-secondary"
                    type="button"
                    disabled={mutation.pending}
                    onClick={() => {
                      setConfirm(false)
                      mutation.clearError()
                      trigger.current?.focus()
                    }}
                  >
                    Cancelar
                  </button>
                </div>
              </section>
            )}
            <section className="detail-panel" aria-label="Información del artículo">
              <h2>Información del artículo</h2>
              <p className="description-text">{item.description}</p>
              <dl className="detail-grid">
                <div>
                  <dt>Categoría</dt>
                  <dd>{item.category.name}</dd>
                </div>
                <div>
                  <dt>Referencia</dt>
                  <dd>{item.reference}</dd>
                </div>
                <div>
                  <dt>Unidades totales</dt>
                  <dd>{item.total_units}</dd>
                </div>
                <div>
                  <dt>Unidades disponibles</dt>
                  <dd>{item.available_units}</dd>
                </div>
              </dl>
              {item.available_units === 0 && (
                <p className="notice">
                  Este artículo no tiene unidades disponibles en este momento.
                </p>
              )}
            </section>
          </>
        )
      )}
    </>
  )
}
