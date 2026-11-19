import { useCallback, useState } from 'react'
import { useCatalog } from '../hooks/useCatalog'
import { useRemote } from '../hooks/useRemote'
import { DataError, Empty, FormField, Loading } from './DataViews'

export function NeighborPicker({
  value,
  onChange,
  disabled = false,
}: {
  value: string
  onChange: (id: string) => void
  disabled?: boolean
}) {
  const api = useCatalog()
  const [draft, setDraft] = useState('')
  const [q, setQ] = useState('')
  const [page, setPage] = useState(1)
  const state = useRemote(
    `neighbor-picker:${q}:${page}`,
    useCallback(
      (signal: AbortSignal) => api.neighbors({ q, page, size: 10 }, signal),
      [api, q, page],
    ),
  )
  const selected = useRemote(
    `selected-neighbor:${value}`,
    useCallback(
      (signal: AbortSignal) => (value ? api.neighbor(value, signal) : Promise.resolve(null)),
      [api, value],
    ),
  )
  return (
    <section className="detail-panel" aria-label="Seleccionar vecino">
      <h2>Vecino</h2>
      <FormField
        id="neighbor-search"
        label="Buscar vecino por nombre o documento"
        value={draft}
        onChange={setDraft}
        disabled={disabled}
      />
      <button
        type="button"
        className="button button-secondary"
        disabled={disabled}
        onClick={() => {
          setQ(draft.trim())
          setPage(1)
        }}
      >
        Buscar vecino
      </button>
      {value && (
        <div role="status">
          {selected.loading
            ? 'Cargando vecino seleccionado…'
            : selected.data
              ? `Seleccionado: ${selected.data.full_name} · ${selected.data.document_number}`
              : null}
          <button
            className="button button-secondary"
            type="button"
            disabled={disabled}
            onClick={() => onChange('')}
          >
            Quitar vecino
          </button>
        </div>
      )}
      {selected.error && <DataError error={selected.error} retry={selected.reload} />}
      {state.loading ? (
        <Loading label="Buscando vecinos…" />
      ) : state.error ? (
        <DataError error={state.error} retry={state.reload} />
      ) : (
        state.data && (
          <>
            {state.data.items.length === 0 ? (
              <Empty title="No encontramos vecinos" />
            ) : (
              <ul className="selection-list">
                {state.data.items.map((neighbor) => (
                  <li key={neighbor.id}>
                    <span>
                      {neighbor.full_name} · {neighbor.document_number}
                    </span>
                    <button
                      className="button button-secondary"
                      type="button"
                      disabled={disabled || value === neighbor.id}
                      onClick={() => onChange(neighbor.id)}
                      aria-label={
                        value === neighbor.id
                          ? `Seleccionado: ${neighbor.full_name}`
                          : `Seleccionar a ${neighbor.full_name}`
                      }
                    >
                      {value === neighbor.id ? 'Seleccionado' : 'Seleccionar'}
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <div className="page-actions">
              <button
                className="button button-secondary"
                type="button"
                disabled={disabled || page <= 1}
                onClick={() => setPage(page - 1)}
              >
                Vecinos anteriores
              </button>
              <span>Página de vecinos {page}</span>
              <button
                className="button button-secondary"
                type="button"
                disabled={disabled || page * 10 >= state.data.total}
                onClick={() => setPage(page + 1)}
              >
                Más vecinos
              </button>
            </div>
          </>
        )
      )}
    </section>
  )
}
