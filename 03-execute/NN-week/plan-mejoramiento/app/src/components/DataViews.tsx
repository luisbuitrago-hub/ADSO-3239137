import type { ChangeEvent, ReactNode } from 'react'
import { Link, useLocation } from 'react-router'
import type { ApiError } from '../services/http'

export function DataError({ error, retry }: { error: ApiError; retry?: () => void }) {
  return (
    <section className="data-error" role="alert">
      <h2>
        {error.status === 404
          ? 'No encontramos este registro'
          : error.status === 403
            ? 'No tienes acceso a esta operación'
            : 'No pudimos completar la solicitud'}
      </h2>
      <p>{error.message}</p>
      {error.status !== 404 && error.status !== 403 && retry && (
        <button className="button button-secondary" type="button" onClick={retry}>
          Reintentar
        </button>
      )}
    </section>
  )
}
export function Loading({ label = 'Cargando información…' }: { label?: string }) {
  return (
    <p className="data-loading" role="status">
      <span className="spinner dark-spinner" aria-hidden="true" />
      {label}
    </p>
  )
}
export function Empty({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <section className="data-empty">
      <h2>{title}</h2>
      {children}
    </section>
  )
}
export function Flash() {
  const { state } = useLocation()
  const message: unknown = (state as { flash?: unknown } | null)?.flash
  return typeof message === 'string' ? (
    <p className="notice" role="status">
      {message}
    </p>
  ) : null
}
export function AccessDenied() {
  return (
    <section className="empty-state">
      <span className="eyebrow">ACCESO RESTRINGIDO</span>
      <h1>Esta sección es para administradores</h1>
      <p>
        Tu sesión de operador sigue activa. Puedes volver a las secciones autorizadas de tu espacio.
      </p>
      <Link className="button button-primary" to="/home">
        Volver al inicio
      </Link>
    </section>
  )
}
export function Pagination({
  page,
  size,
  total,
  onPage,
  onSize,
}: {
  page: number
  size: number
  total: number
  onPage: (page: number) => void
  onSize: (size: number) => void
}) {
  const pages = Math.max(1, Math.ceil(total / size))
  return (
    <nav className="pagination" aria-label="Paginación">
      <span>
        {total} {total === 1 ? 'resultado' : 'resultados'} · Página {page} de {pages}
      </span>
      <div>
        <label htmlFor="page-size">Por página</label>
        <select
          id="page-size"
          value={size}
          onChange={(event) => onSize(Number(event.target.value))}
        >
          {[...new Set([10, 20, 50, size])]
            .sort((a, b) => a - b)
            .map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
        </select>
        <button
          className="button button-secondary"
          type="button"
          disabled={page <= 1}
          onClick={() => onPage(page - 1)}
        >
          Anterior
        </button>
        <button
          className="button button-secondary"
          type="button"
          disabled={page >= pages}
          onClick={() => onPage(page + 1)}
        >
          Siguiente
        </button>
      </div>
    </nav>
  )
}
export function FormField({
  id,
  label,
  value,
  onChange,
  error,
  hint,
  disabled,
  readOnly,
  as = 'input',
  children,
  inputMode,
}: {
  id: string
  label: string
  value: string
  onChange: (value: string) => void
  error?: string
  hint?: string
  disabled?: boolean
  readOnly?: boolean
  as?: 'input' | 'textarea' | 'select'
  children?: ReactNode
  inputMode?: 'numeric'
}) {
  const common = {
    id,
    value,
    disabled,
    onChange: (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
      onChange(event.target.value),
    'aria-invalid': !!error,
    'aria-describedby':
      [hint && `${id}-hint`, error && `${id}-error`].filter(Boolean).join(' ') || undefined,
  }
  return (
    <div className="form-field">
      <label htmlFor={id}>{label}</label>
      {as === 'select' ? (
        <select {...common}>{children}</select>
      ) : as === 'textarea' ? (
        <textarea {...common} readOnly={readOnly} rows={4} />
      ) : (
        <input {...common} readOnly={readOnly} inputMode={inputMode} />
      )}
      {hint && (
        <p className="field-hint" id={`${id}-hint`}>
          {hint}
        </p>
      )}
      {error && (
        <p className="field-error" id={`${id}-error`}>
          {error}
        </p>
      )}
    </div>
  )
}
