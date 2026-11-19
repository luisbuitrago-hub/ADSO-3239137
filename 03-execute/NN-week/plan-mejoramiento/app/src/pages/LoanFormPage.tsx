import { useCallback, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { DataError, Empty, FormField, Loading, Pagination } from '../components/DataViews'
import { NeighborPicker } from '../components/NeighborPicker'
import { useCatalog } from '../hooks/useCatalog'
import { useLoans } from '../hooks/useLoans'
import { useMutation } from '../hooks/useMutation'
import { useRemote } from '../hooks/useRemote'
import type { Article } from '../types/catalog'

function fieldName(field: string) {
  if (field === 'neighbor_id') return 'Vecino'
  const line = /^items\.(\d+)(?:\.article_id)?$/.exec(field)
  return line ? `Artículo ${Number(line[1]) + 1}` : 'Artículos'
}

export function LoanFormPage() {
  const catalog = useCatalog()
  const loans = useLoans()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const [neighborId, setNeighborId] = useState(params.get('neighbor_id') || '')
  const [draft, setDraft] = useState('')
  const [q, setQ] = useState('')
  const [page, setPage] = useState(1)
  const [size, setSize] = useState(10)
  const [selected, setSelected] = useState<Article[]>([])
  const [review, setReview] = useState(false)
  const [validation, setValidation] = useState('')
  const confirm = useRef<HTMLButtonElement>(null)
  const reviewButton = useRef<HTMLButtonElement>(null)
  const mutation = useMutation()
  const neighbor = useRemote(
    `eligibility:${neighborId}`,
    useCallback(
      async (signal: AbortSignal) => {
        if (!neighborId) return null
        const [person, overdue] = await Promise.all([
          catalog.neighbor(neighborId, signal),
          loans.list({ neighbor_id: neighborId, status: 'overdue', page: 1, size: 1 }, signal),
        ])
        return { person, overdue: overdue.total > 0 }
      },
      [catalog, loans, neighborId],
    ),
  )
  const articles = useRemote(
    `available:${q}:${page}:${size}`,
    useCallback(
      (signal: AbortSignal) => catalog.articles({ q, page, size }, signal),
      [catalog, q, page, size],
    ),
  )
  const reason = !neighborId
    ? 'Selecciona un vecino.'
    : neighbor.loading
      ? 'Espera la verificación del vecino.'
      : neighbor.error
        ? 'No se pudo verificar al vecino.'
        : neighbor.data?.overdue
          ? 'El vecino tiene artículos vencidos pendientes de devolución.'
          : (neighbor.data?.person.active_loans ?? 3) + selected.length > 3
            ? 'El vecino no puede superar tres artículos pendientes de devolución.'
            : selected.length === 0
              ? 'Selecciona entre uno y tres artículos distintos.'
              : ''
  function refresh() {
    articles.reload()
    neighbor.reload()
  }
  function beginReview() {
    if (reason) {
      setValidation(reason)
      return
    }
    setValidation('')
    mutation.clearError()
    setReview(true)
    requestAnimationFrame(() => confirm.current?.focus())
  }
  async function save() {
    if (reason) {
      setValidation(reason)
      return
    }
    const result = await mutation.run((signal) =>
      loans.create(
        { neighbor_id: neighborId, items: selected.map((article) => ({ article_id: article.id })) },
        signal,
      ),
    )
    if (result.ok)
      navigate(`/loans/${result.value.id}`, {
        replace: true,
        state: { flash: 'Préstamo registrado correctamente. Se descontó una unidad por artículo.' },
      })
  }
  return (
    <>
      <Link className="back-link" to="/loans">
        ← Volver a préstamos
      </Link>
      <div className="page-heading">
        <div>
          <span className="eyebrow">NUEVA ENTREGA</span>
          <h1>Registrar préstamo</h1>
          <p className="muted">
            Plazo de tres días desde el registro. Fechas en UTC. Una unidad por artículo distinto.
          </p>
        </div>
      </div>
      {!review ? (
        <>
          <NeighborPicker
            value={neighborId}
            onChange={(id) => {
              setNeighborId(id)
              setValidation('')
            }}
          />
          {neighborId &&
            (neighbor.loading ? (
              <Loading label="Verificando pendientes y vencimientos…" />
            ) : neighbor.error ? (
              <DataError error={neighbor.error} retry={neighbor.reload} />
            ) : (
              neighbor.data && (
                <p className="notice" role="status">
                  {neighbor.data.person.full_name}: {neighbor.data.person.active_loans} artículos
                  pendientes.{' '}
                  {neighbor.data.overdue
                    ? 'No puede recibir préstamos: tiene vencimientos.'
                    : `Puede recibir hasta ${Math.max(0, 3 - neighbor.data.person.active_loans)} artículos más.`}
                </p>
              )
            ))}
          <section className="editor-panel" aria-label="Seleccionar artículos">
            <h2>Artículos disponibles</h2>
            <form
              className="filter-bar"
              onSubmit={(e) => {
                e.preventDefault()
                setQ(draft.trim())
                setPage(1)
              }}
            >
              <FormField
                id="article-search"
                label="Buscar artículo por nombre o descripción"
                value={draft}
                onChange={setDraft}
              />
              <button className="button button-secondary" type="submit">
                Buscar artículos
              </button>
            </form>
            {articles.loading ? (
              <Loading label="Cargando artículos disponibles…" />
            ) : articles.error ? (
              <DataError error={articles.error} retry={articles.reload} />
            ) : (
              articles.data && (
                <>
                  {articles.data.items.length === 0 ? (
                    <Empty title="No encontramos artículos" />
                  ) : (
                    <ul className="selection-list">
                      {articles.data.items.map((article) => (
                        <li key={article.id}>
                          <span>
                            <strong>{article.name}</strong> · {article.reference}
                            <br />
                            Disponibles: {article.available_units} de {article.total_units}
                          </span>
                          <button
                            className="button button-secondary"
                            type="button"
                            disabled={
                              article.available_units < 1 ||
                              selected.length >= 3 ||
                              selected.some((a) => a.id === article.id)
                            }
                            onClick={() => setSelected([...selected, article])}
                            aria-label={`${article.available_units < 1 ? 'Sin disponibilidad de' : 'Agregar'} ${article.name}`}
                          >
                            {selected.some((a) => a.id === article.id)
                              ? 'Agregar'
                              : article.available_units < 1
                                ? 'Sin disponibilidad'
                                : 'Agregar'}
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                  <Pagination
                    page={articles.data.page}
                    size={articles.data.size}
                    total={articles.data.total}
                    onPage={setPage}
                    onSize={(value) => {
                      setSize(value)
                      setPage(1)
                    }}
                  />
                </>
              )
            )}
          </section>
          <section className="detail-panel" aria-label="Artículos seleccionados">
            <h2>Selección: {selected.length} de 3 artículos</h2>
            <ul className="selection-list">
              {selected.map((article) => (
                <li key={article.id}>
                  <span>
                    {article.name} · {article.reference} · 1 unidad
                  </span>
                  <button
                    className="button button-secondary"
                    type="button"
                    onClick={() => setSelected(selected.filter((a) => a.id !== article.id))}
                    aria-label={`Quitar ${article.name}`}
                  >
                    Quitar
                  </button>
                </li>
              ))}
            </ul>
            <p>El límite cuenta también las unidades pendientes de préstamos anteriores.</p>
          </section>
          {validation && (
            <p className="field-error" role="alert">
              {validation}
            </p>
          )}
          <div className="page-actions">
            <button
              ref={reviewButton}
              className="button button-primary"
              type="button"
              onClick={beginReview}
            >
              Revisar préstamo
            </button>
            <button className="button button-secondary" type="button" onClick={refresh}>
              Actualizar disponibilidad
            </button>
          </div>
        </>
      ) : (
        <section className="confirm-panel" aria-label="Revisar préstamo">
          <h2>Confirmar entrega</h2>
          <p>
            Vecino: {neighbor.data?.person.full_name} · {neighbor.data?.person.document_number}
          </p>
          <ul>
            {selected.map((article) => (
              <li key={article.id}>
                {article.name} · {article.reference} · {article.category.name} · 1 unidad
              </li>
            ))}
          </ul>
          <p>Plazo: tres días. La disponibilidad y el límite se comprobarán de nuevo al guardar.</p>
          {mutation.error && (
            <>
              <DataError error={mutation.error} />
              <ul>
                {mutation.error.details.map((detail, index) => (
                  <li key={index}>
                    {fieldName(detail.field)}: {detail.issue}
                  </li>
                ))}
              </ul>
              <Link to="/loans">Consultar préstamos antes de reintentar</Link>
            </>
          )}
          {validation && (
            <p className="field-error" role="alert">
              {validation}
            </p>
          )}
          <div className="page-actions">
            <button
              ref={confirm}
              className="button button-primary"
              type="button"
              disabled={mutation.pending}
              onClick={() => void save()}
            >
              {mutation.pending ? 'Registrando…' : 'Confirmar préstamo'}
            </button>
            <button
              className="button button-secondary"
              type="button"
              disabled={mutation.pending}
              onClick={() => {
                setReview(false)
                refresh()
                requestAnimationFrame(() => reviewButton.current?.focus())
              }}
            >
              Volver a editar
            </button>
          </div>
        </section>
      )}
    </>
  )
}
