import { useCallback, useState } from 'react'
import { DataError, Empty, Loading } from '../components/DataViews'
import { useAdministration } from '../hooks/useAdministration'
import { useRemote } from '../hooks/useRemote'
import { rangeErrors } from '../services/administration'

function Results({ from, to }: { from: string; to: string }) {
  const api = useAdministration()
  const state = useRemote(
    `report:${from}:${to}`,
    useCallback((signal: AbortSignal) => api.report(from, to, signal), [api, from, to]),
  )
  if (state.loading) return <Loading label="Consultando reporte…" />
  if (state.error) return <DataError error={state.error} retry={state.reload} />
  return (
    state.data && (
      <section aria-label="Resultados del reporte">
        <h2>
          Resultados del {state.data.from} al {state.data.to} (UTC)
        </h2>
        <p>
          Ordenados por cantidad de préstamos descendente y nombre histórico. Un artículo puede
          aparecer con distintos nombres y categorías históricos.
        </p>
        {state.data.rows.length === 0 ? (
          <Empty title="No hay préstamos en este periodo" />
        ) : (
          <div
            className="table-scroll"
            tabIndex={0}
            role="region"
            aria-label="Artículos más prestados"
          >
            <table>
              <caption className="sr-only">
                Préstamos por artículo, nombre y categoría históricos
              </caption>
              <thead>
                <tr>
                  <th scope="col">Artículo histórico</th>
                  <th scope="col">Categoría histórica</th>
                  <th scope="col">Veces prestado</th>
                </tr>
              </thead>
              <tbody>
                {state.data.rows.map((row) => (
                  <tr key={JSON.stringify([row.article_id, row.article_name, row.category_name])}>
                    <th scope="row">{row.article_name}</th>
                    <td>{row.category_name}</td>
                    <td>{row.times_borrowed}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    )
  )
}
export function ReportsPage() {
  const [range, setRange] = useState<{ from: string; to: string; revision: number } | null>(null)
  const [errors, setErrors] = useState<Record<string, string>>({})
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">HISTORIAL</span>
          <h1>Reportes</h1>
          <h2>Artículos más prestados</h2>
          <p className="muted">
            Consulta administrativa. Ambas fechas son inclusivas y se interpretan en UTC.
          </p>
        </div>
      </div>
      <form
        className="filter-bar"
        noValidate
        onSubmit={(e) => {
          e.preventDefault()
          const data = new FormData(e.currentTarget)
          const from = String(data.get('from') || '')
          const to = String(data.get('to') || '')
          const issues = rangeErrors(from, to)
          setErrors(issues)
          if (Object.keys(issues).length === 0)
            setRange({ from, to, revision: (range?.revision || 0) + 1 })
        }}
      >
        <div className="form-field">
          <label htmlFor="report-from">Fecha inicial (UTC)</label>
          <input
            id="report-from"
            name="from"
            type="date"
            required
            aria-invalid={!!errors.from}
            aria-describedby={errors.from ? 'report-from-error' : undefined}
            onChange={() => {
              setRange(null)
              setErrors({})
            }}
          />
          {errors.from && (
            <p id="report-from-error" className="field-error" role="alert">
              {errors.from}
            </p>
          )}
        </div>
        <div className="form-field">
          <label htmlFor="report-to">Fecha final (UTC)</label>
          <input
            id="report-to"
            name="to"
            type="date"
            required
            aria-invalid={!!errors.to}
            aria-describedby={errors.to ? 'report-to-error' : undefined}
            onChange={() => {
              setRange(null)
              setErrors({})
            }}
          />
          {errors.to && (
            <p id="report-to-error" className="field-error" role="alert">
              {errors.to}
            </p>
          )}
        </div>
        <button className="button button-primary" type="submit">
          Consultar reporte
        </button>
      </form>
      {range ? (
        <Results key={range.revision} from={range.from} to={range.to} />
      ) : (
        <p className="notice">Selecciona un rango de fechas para consultar el historial.</p>
      )}
    </>
  )
}
