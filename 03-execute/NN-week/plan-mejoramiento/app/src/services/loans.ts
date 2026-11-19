import { isUuid, queryPath } from './catalog'
import { ApiError, type HttpClient } from './http'
import type { Loan, LoanFilters, LoanInput, LoanItem, LoanPage, OverdueItem } from '../types/loans'

const object = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object'
const uuid = (v: unknown): v is string => typeof v === 'string' && isUuid(v)
const integer = (v: unknown): v is number =>
  typeof v === 'number' && Number.isSafeInteger(v) && v >= 0
const timestamp = (v: unknown): v is string =>
  typeof v === 'string' && /^\d{4}-\d{2}-\d{2}T.*Z$/.test(v) && Number.isFinite(Date.parse(v))
function invalid(): never {
  throw new ApiError(
    0,
    'INVALID_RESPONSE',
    'La respuesta del servicio no tiene el formato esperado. Inténtalo nuevamente.',
  )
}
function item(v: unknown): LoanItem {
  if (
    !object(v) ||
    !uuid(v.id) ||
    !uuid(v.article_id) ||
    typeof v.article_name !== 'string' ||
    typeof v.article_reference !== 'string' ||
    typeof v.category_name !== 'string' ||
    !timestamp(v.due_at) ||
    !(v.returned_at === null || timestamp(v.returned_at))
  )
    return invalid()
  return {
    id: v.id,
    article_id: v.article_id,
    article_name: v.article_name,
    article_reference: v.article_reference,
    category_name: v.category_name,
    due_at: v.due_at,
    returned_at: v.returned_at,
  }
}
function loan(v: unknown): Loan {
  if (
    !object(v) ||
    !uuid(v.id) ||
    !uuid(v.neighbor_id) ||
    !timestamp(v.loaned_at) ||
    !(v.status === 'open' || v.status === 'overdue' || v.status === 'closed') ||
    !Array.isArray(v.items) ||
    v.items.length < 1 ||
    v.items.length > 3
  )
    return invalid()
  return {
    id: v.id,
    neighbor_id: v.neighbor_id,
    loaned_at: v.loaned_at,
    status: v.status,
    items: v.items.map(item),
  }
}
function overdue(v: unknown): OverdueItem {
  if (
    !object(v) ||
    !uuid(v.loan_id) ||
    !uuid(v.item_id) ||
    typeof v.article_name !== 'string' ||
    typeof v.neighbor_name !== 'string' ||
    !timestamp(v.due_at) ||
    !integer(v.days_late)
  )
    return invalid()
  return {
    loan_id: v.loan_id,
    item_id: v.item_id,
    article_name: v.article_name,
    neighbor_name: v.neighbor_name,
    due_at: v.due_at,
    days_late: v.days_late,
  }
}
const path = (id: string) => {
  if (!isUuid(id)) throw new ApiError(404, 'NOT_FOUND', 'El préstamo solicitado no existe.')
  return `/loans/${id}`
}
export function loansApi(client: HttpClient) {
  return {
    list: async (filters: LoanFilters, signal?: AbortSignal): Promise<LoanPage> => {
      const v = await client.request<unknown>(queryPath('/loans', { ...filters }), { signal })
      if (
        !object(v) ||
        !Array.isArray(v.items) ||
        !integer(v.page) ||
        v.page < 1 ||
        !integer(v.size) ||
        v.size < 1 ||
        v.size > 50 ||
        !integer(v.total)
      )
        return invalid()
      return { items: v.items.map(loan), page: v.page, size: v.size, total: v.total }
    },
    get: async (id: string, signal?: AbortSignal) =>
      loan(await client.request<unknown>(path(id), { signal })),
    create: async (input: LoanInput, signal?: AbortSignal) =>
      loan(
        await client.request<unknown>('/loans', {
          method: 'POST',
          body: JSON.stringify(input),
          signal,
        }),
      ),
    returnItem: async (loanId: string, itemId: string, signal?: AbortSignal) => {
      if (!isUuid(itemId)) throw new ApiError(404, 'NOT_FOUND', 'La línea solicitada no existe.')
      return item(
        await client.request<unknown>(`${path(loanId)}/items/${itemId}/return`, {
          method: 'POST',
          signal,
        }),
      )
    },
    overdue: async (signal?: AbortSignal) => {
      const v = await client.request<unknown>('/loans/overdue', { signal })
      return object(v) && Array.isArray(v.items) ? v.items.map(overdue) : invalid()
    },
  }
}
export const statusName = { open: 'Abierto', overdue: 'Vencido', closed: 'Cerrado' }
export const utcDate = (value: string) =>
  new Intl.DateTimeFormat('es-CO', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'UTC',
    hour12: false,
  }).format(new Date(value)) + ' UTC'
