import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router'
import { DataError, Flash, Loading } from '../components/DataViews'
import { useCatalog } from '../hooks/useCatalog'
import { useLoans } from '../hooks/useLoans'
import { useMutation } from '../hooks/useMutation'
import { useRemote } from '../hooks/useRemote'
import { statusName, utcDate } from '../services/loans'
import type { LoanItem } from '../types/loans'

function LoanNeighbor({ id }: { id: string }) {
  const api = useCatalog()
  const state = useRemote(
    `loan-neighbor:${id}`,
    useCallback((signal: AbortSignal) => api.neighbor(id, signal), [api, id]),
  )
  return (
    <section className="detail-panel">
      <h2>Vecino asociado</h2>
      {state.loading ? (
        <Loading />
      ) : state.error ? (
        <DataError error={state.error} retry={state.reload} />
      ) : (
        state.data && (
          <>
            <Link to={`/neighbors/${id}`}>{state.data.full_name}</Link>
            <p>
              Documento: {state.data.document_number} · Artículos pendientes:{' '}
              {state.data.active_loans}
            </p>
          </>
        )
      )}
    </section>
  )
}
function Inventory({ id }: { id: string }) {
  const api = useCatalog()
  const state = useRemote(
    `loan-stock:${id}`,
    useCallback((signal: AbortSignal) => api.article(id, signal), [api, id]),
  )
  return (
    <div className="current-stock">
      {state.loading ? (
        <Loading label="Consultando inventario actual…" />
      ) : state.error?.status === 404 ? (
        <p>Artículo no disponible en el catálogo activo. Su historial se conserva.</p>
      ) : state.error ? (
        <DataError error={state.error} retry={state.reload} />
      ) : (
        state.data && (
          <p>
            Inventario actual: {state.data.available_units} de {state.data.total_units} unidades
            disponibles. <Link to={`/articles/${id}`}>Consultar artículo actual</Link>
          </p>
        )
      )}
    </div>
  )
}
export function LoanDetailPage() {
  const { id = '' } = useParams()
  const api = useLoans()
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 30000)
    return () => window.clearInterval(timer)
  }, [])
  const [revision, setRevision] = useState(0)
  const [returning, setReturning] = useState<LoanItem | null>(null)
  const [notice, setNotice] = useState('')
  const confirm = useRef<HTMLButtonElement>(null)
  const origin = useRef<HTMLButtonElement | null>(null)
  const mutation = useMutation()
  const state = useRemote(
    `loan:${id}:${revision}`,
    useCallback((signal: AbortSignal) => api.get(id, signal), [api, id]),
  )
  function refresh() {
    setReturning(null)
    setRevision((value) => value + 1)
    mutation.clearError()
  }
  async function saveReturn() {
    if (!returning) return
    const result = await mutation.run((signal) => api.returnItem(id, returning.id, signal))
    if (result.ok) {
      setNotice('Devolución registrada correctamente. El inventario se restauró una sola vez.')
      refresh()
      requestAnimationFrame(() => document.getElementById('return-notice')?.focus())
    }
  }
  return (
    <>
      <Link className="back-link" to="/loans">
        ← Volver a préstamos
      </Link>
      <Flash />
      {notice && (
        <p id="return-notice" tabIndex={-1} className="notice" role="status">
          {notice}
        </p>
      )}
      {state.loading ? (
        <Loading label="Cargando préstamo…" />
      ) : state.error ? (
        <DataError error={state.error} retry={state.reload} />
      ) : (
        state.data && (
          <>
            <div className="page-heading">
              <div>
                <span className="eyebrow">DETALLE HISTÓRICO</span>
                <h1>Detalle del préstamo</h1>
                <p className="record-id">{state.data.id}</p>
                <p>
                  Estado: <strong>{statusName[state.data.status]}</strong> · Entrega:{' '}
                  {utcDate(state.data.loaned_at)}
                </p>
              </div>
              <button
                className="button button-secondary"
                disabled={mutation.pending}
                onClick={refresh}
              >
                Actualizar préstamo e inventario
              </button>
            </div>
            <LoanNeighbor key={`neighbor:${revision}`} id={state.data.neighbor_id} />
            <section aria-label="Artículos del préstamo">
              <h2>Artículos del préstamo</h2>
              <p>
                Una unidad por línea. Nombre, referencia y categoría conservados al realizar la
                entrega.
              </p>
              {state.data.items.map((item) => (
                <article className="detail-panel" key={item.id}>
                  <h3>{item.article_name}</h3>
                  <dl className="detail-grid">
                    <div>
                      <dt>Referencia histórica</dt>
                      <dd>{item.article_reference}</dd>
                    </div>
                    <div>
                      <dt>Categoría histórica</dt>
                      <dd>{item.category_name}</dd>
                    </div>
                    <div>
                      <dt>Cantidad</dt>
                      <dd>1 unidad</dd>
                    </div>
                    <div>
                      <dt>Fecha límite</dt>
                      <dd>{utcDate(item.due_at)}</dd>
                    </div>
                    <div>
                      <dt>Devolución</dt>
                      <dd>
                        {item.returned_at
                          ? utcDate(item.returned_at)
                          : Date.parse(item.due_at) < now
                            ? 'Vencido · pendiente de devolución'
                            : 'Pendiente de devolución'}
                      </dd>
                    </div>
                  </dl>
                  <Inventory key={`${item.article_id}:${revision}`} id={item.article_id} />
                  {!item.returned_at && (
                    <button
                      className="button button-primary"
                      type="button"
                      disabled={mutation.pending || returning !== null}
                      aria-label={`Devolver ${item.article_name}`}
                      onClick={(event) => {
                        origin.current = event.currentTarget
                        setReturning(item)
                        setNotice('')
                        mutation.clearError()
                        requestAnimationFrame(() => confirm.current?.focus())
                      }}
                    >
                      Devolver
                    </button>
                  )}
                </article>
              ))}
            </section>
            {returning && (
              <section className="confirm-panel" aria-label="Confirmar devolución">
                <h2>Confirmar devolución</h2>
                <p>
                  ¿Recibiste una unidad de {returning.article_name} ({returning.article_reference})?
                  Esta acción registra la devolución completa de esa línea.
                </p>
                {mutation.error && (
                  <>
                    <DataError error={mutation.error} />
                    <p>
                      El resultado pudo cambiar en otra sesión. Actualiza el préstamo antes de
                      realizar otra operación.
                    </p>
                    <button className="button button-secondary" type="button" onClick={refresh}>
                      Consultar estado actualizado
                    </button>
                  </>
                )}
                <div className="page-actions">
                  <button
                    ref={confirm}
                    className="button button-primary"
                    type="button"
                    disabled={mutation.pending || !!mutation.error}
                    onClick={() => void saveReturn()}
                  >
                    {mutation.pending ? 'Registrando devolución…' : 'Confirmar devolución'}
                  </button>
                  <button
                    className="button button-secondary"
                    type="button"
                    disabled={mutation.pending}
                    onClick={() => {
                      if (mutation.error) refresh()
                      else setReturning(null)
                      mutation.clearError()
                      requestAnimationFrame(() => {
                        if (origin.current?.isConnected) origin.current.focus()
                        else document.getElementById('main-content')?.focus()
                      })
                    }}
                  >
                    Cancelar
                  </button>
                </div>
              </section>
            )}
          </>
        )
      )}
    </>
  )
}
