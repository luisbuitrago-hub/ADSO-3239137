import { ApiError, type HttpClient } from './http'
import { isUuid, parseArticle, queryPath } from './catalog'

export interface ReportRow {
  article_id: string
  article_name: string
  category_name: string
  times_borrowed: number
}
export interface BorrowedReport {
  from: string
  to: string
  rows: ReportRow[]
}
export interface Operator {
  id: string
  username: string
  role: 'operator'
}
const record = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object'
function invalid(): never {
  throw new ApiError(
    0,
    'INVALID_RESPONSE',
    'La respuesta del servicio no tiene el formato esperado.',
  )
}
function coverPath(id: string) {
  if (!isUuid(id)) throw new ApiError(404, 'NOT_FOUND', 'El artículo solicitado no existe.')
  return `/articles/${id}/cover`
}
export const MAX_COVER_BYTES = 2097152
export function coverError(file: File | null): string | undefined {
  if (!file) return 'Selecciona una imagen.'
  if (!['image/jpeg', 'image/png'].includes(file.type)) return 'Selecciona un archivo JPG o PNG.'
  if (file.size < 1 || file.size > MAX_COVER_BYTES)
    return 'La imagen debe contener datos y no superar 2 MB (2.097.152 bytes).'
}
export function validDay(value: string) {
  return (
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    value >= '0001-01-01' &&
    Number.isFinite(Date.parse(value + 'T00:00:00Z')) &&
    new Date(value + 'T00:00:00Z').toISOString().slice(0, 10) === value
  )
}
export function rangeErrors(from: string, to: string): Record<string, string> {
  const errors: Record<string, string> = {}
  if (!validDay(from)) errors.from = 'Introduce una fecha inicial válida.'
  if (!validDay(to)) errors.to = 'Introduce una fecha final válida.'
  if (!errors.from && !errors.to && to < from)
    errors.to = 'La fecha final no puede ser anterior a la inicial.'
  return errors
}
export function administrationApi(client: HttpClient) {
  return {
    cover: (id: string, signal?: AbortSignal) =>
      client.request<Blob>(coverPath(id), { signal, cache: 'no-store' }, true, 'image'),
    uploadCover: async (id: string, file: File, signal?: AbortSignal) => {
      const body = new FormData()
      body.append('file', file)
      return parseArticle(
        await client.request<unknown>(coverPath(id), { method: 'PUT', body, signal }),
      )
    },
    deleteCover: (id: string, signal?: AbortSignal) =>
      client.request<void>(coverPath(id), { method: 'DELETE', signal }),
    report: async (from: string, to: string, signal?: AbortSignal): Promise<BorrowedReport> => {
      const v = await client.request<unknown>(queryPath('/reports/most-borrowed', { from, to }), {
        signal,
      })
      if (!record(v) || v.from !== from || v.to !== to || !Array.isArray(v.rows)) return invalid()
      const rows = v.rows.map((r: unknown): ReportRow => {
        if (
          !record(r) ||
          typeof r.article_id !== 'string' ||
          !isUuid(r.article_id) ||
          typeof r.article_name !== 'string' ||
          typeof r.category_name !== 'string' ||
          typeof r.times_borrowed !== 'number' ||
          !Number.isSafeInteger(r.times_borrowed) ||
          r.times_borrowed < 1
        )
          return invalid()
        return {
          article_id: r.article_id,
          article_name: r.article_name,
          category_name: r.category_name,
          times_borrowed: r.times_borrowed,
        }
      })
      return { from, to, rows }
    },
    createOperator: async (
      username: string,
      password: string,
      signal?: AbortSignal,
    ): Promise<Operator> => {
      const v = await client.request<unknown>('/users', {
        method: 'POST',
        body: JSON.stringify({ username, password, role: 'operator' }),
        signal,
      })
      if (
        !record(v) ||
        typeof v.id !== 'string' ||
        !isUuid(v.id) ||
        typeof v.username !== 'string' ||
        v.role !== 'operator'
      )
        return invalid()
      return { id: v.id, username: v.username, role: v.role }
    },
    health: async (signal?: AbortSignal) => {
      const v = await client.request<unknown>('/health', { signal }, false)
      if (!record(v) || v.status !== 'ok') return invalid()
      return 'Servicio disponible.'
    },
  }
}
