import { ApiError, type HttpClient } from './http'
import type {
  Article,
  ArticleInput,
  ArticleUpdate,
  Category,
  Neighbor,
  NeighborDetail,
  NeighborInput,
  PageResult,
} from '../types/catalog'

export const isUuid = (value: string) =>
  /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(value)
const record = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object'
const integer = (value: unknown): value is number =>
  typeof value === 'number' && Number.isSafeInteger(value) && value >= 0
function invalid(): never {
  throw new ApiError(
    0,
    'INVALID_RESPONSE',
    'La respuesta del servicio no tiene el formato esperado. Inténtalo nuevamente.',
  )
}
function category(value: unknown): Category {
  if (
    !record(value) ||
    typeof value.id !== 'string' ||
    !isUuid(value.id) ||
    typeof value.name !== 'string'
  )
    return invalid()
  return { id: value.id, name: value.name }
}
function article(value: unknown): Article {
  if (
    !record(value) ||
    typeof value.id !== 'string' ||
    !isUuid(value.id) ||
    typeof value.name !== 'string' ||
    typeof value.description !== 'string' ||
    typeof value.reference !== 'string' ||
    !integer(value.total_units) ||
    value.total_units < 1 ||
    !integer(value.available_units) ||
    value.available_units > value.total_units ||
    !(value.cover_key === null || typeof value.cover_key === 'string')
  )
    return invalid()
  return {
    id: value.id,
    name: value.name,
    description: value.description,
    reference: value.reference,
    category: category(value.category),
    total_units: value.total_units,
    available_units: value.available_units,
    cover_key: value.cover_key,
  }
}
function neighbor(value: unknown): Neighbor {
  if (
    !record(value) ||
    typeof value.id !== 'string' ||
    !isUuid(value.id) ||
    typeof value.full_name !== 'string' ||
    typeof value.document_number !== 'string'
  )
    return invalid()
  return { id: value.id, full_name: value.full_name, document_number: value.document_number }
}
function page<T>(value: unknown, parse: (item: unknown) => T): PageResult<T> {
  if (
    !record(value) ||
    !Array.isArray(value.items) ||
    !integer(value.page) ||
    value.page < 1 ||
    !integer(value.size) ||
    value.size < 1 ||
    value.size > 50 ||
    !integer(value.total)
  )
    return invalid()
  return { items: value.items.map(parse), page: value.page, size: value.size, total: value.total }
}
export function queryPath(path: string, params: Record<string, string | number | undefined>) {
  const query = new URLSearchParams()
  for (const [key, value] of Object.entries(params))
    if (value !== undefined && value !== '') query.set(key, String(value))
  return `${path}?${query.toString()}`
}
export function catalogApi(client: HttpClient) {
  const get = (path: string, signal?: AbortSignal) => client.request<unknown>(path, { signal })
  const idPath = (resource: string, id: string) => {
    if (!isUuid(id)) throw new ApiError(404, 'NOT_FOUND', 'El registro solicitado no existe.')
    return `/${resource}/${id}`
  }
  return {
    categories: async (signal?: AbortSignal) => {
      const value = await get('/categories', signal)
      return Array.isArray(value) ? value.map(category) : invalid()
    },
    articles: async (
      params: { q?: string; category_id?: string; page: number; size: number },
      signal?: AbortSignal,
    ) => page(await get(queryPath('/articles', params), signal), article),
    article: async (id: string, signal?: AbortSignal) =>
      article(await get(idPath('articles', id), signal)),
    createArticle: async (input: ArticleInput, signal?: AbortSignal) =>
      article(
        await client.request<unknown>('/articles', {
          method: 'POST',
          body: JSON.stringify(input),
          signal,
        }),
      ),
    updateArticle: async (id: string, input: ArticleUpdate, signal?: AbortSignal) =>
      article(
        await client.request<unknown>(idPath('articles', id), {
          method: 'PUT',
          body: JSON.stringify(input),
          signal,
        }),
      ),
    deactivateArticle: (id: string, signal?: AbortSignal) =>
      client.request<void>(idPath('articles', id), { method: 'DELETE', signal }),
    neighbors: async (params: { q?: string; page: number; size: number }, signal?: AbortSignal) =>
      page(await get(queryPath('/neighbors', params), signal), neighbor),
    neighbor: async (id: string, signal?: AbortSignal): Promise<NeighborDetail> => {
      const value = await get(idPath('neighbors', id), signal)
      if (!record(value) || !integer(value.active_loans)) return invalid()
      return { ...neighbor(value), active_loans: value.active_loans }
    },
    createNeighbor: async (input: NeighborInput, signal?: AbortSignal) =>
      neighbor(
        await client.request<unknown>('/neighbors', {
          method: 'POST',
          body: JSON.stringify(input),
          signal,
        }),
      ),
  }
}
