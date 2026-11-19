import type { ApiErrorBody } from '../types/api'

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details: ApiErrorBody['details'] = [],
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

export function apiBaseUrl(value: string = import.meta.env.VITE_API_BASE_URL || '/api/v1'): string {
  const base = value.trim().replace(/\/+$/, '')
  const url = new URL(base, window.location.origin)
  if (
    !['http:', 'https:'].includes(url.protocol) ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    !url.pathname.endsWith('/api/v1')
  ) {
    throw new Error(
      'VITE_API_BASE_URL debe terminar en /api/v1 y no contener credenciales ni parámetros.',
    )
  }
  return url.href.replace(/\/+$/, '')
}

function errorBody(value: unknown): ApiErrorBody | null {
  if (!value || typeof value !== 'object') return null
  const body = value as Partial<ApiErrorBody>
  if (
    typeof body.code !== 'string' ||
    typeof body.message !== 'string' ||
    !Array.isArray(body.details)
  )
    return null
  return {
    code: body.code,
    message: body.message,
    details: body.details.filter(
      (detail): detail is ApiErrorBody['details'][number] =>
        !!detail &&
        typeof detail === 'object' &&
        typeof detail.field === 'string' &&
        typeof detail.issue === 'string',
    ),
  }
}

export interface HttpOptions {
  baseUrl?: string
  getToken?: () => string | undefined
  onUnauthorized?: (token: string) => void
  timeoutMs?: number
}

export function createHttpClient(options: HttpOptions = {}) {
  const base = apiBaseUrl(options.baseUrl)
  let auth: Pick<HttpOptions, 'getToken' | 'onUnauthorized'> = options
  return {
    bindAuthentication(handlers: Pick<HttpOptions, 'getToken' | 'onUnauthorized'>) {
      auth = handlers
      return () => {
        if (auth === handlers) auth = {}
      }
    },
    async request<T>(path: string, init: RequestInit = {}, authenticated = true): Promise<T> {
      if (!/^\/[a-z0-9][a-z0-9/_?=&%-]*$/i.test(path) || path.includes('..'))
        throw new Error('Ruta API inválida.')
      const token = authenticated ? auth.getToken?.() : undefined
      const controller = new AbortController()
      let timedOut = false
      const abort = () => controller.abort()
      if (init.signal?.aborted) controller.abort()
      init.signal?.addEventListener('abort', abort, { once: true })
      const timer = setTimeout(() => {
        timedOut = true
        controller.abort()
      }, options.timeoutMs ?? 15000)
      try {
        const headers = new Headers(init.headers)
        headers.set('Accept', 'application/json')
        if (init.body && !(init.body instanceof FormData))
          headers.set('Content-Type', 'application/json')
        if (token) headers.set('Authorization', `Bearer ${token}`)
        const response = await fetch(base + path, {
          ...init,
          headers,
          signal: controller.signal,
          credentials: 'omit',
          redirect: 'error',
          referrerPolicy: 'no-referrer',
        })
        if (response.status === 401 && token) auth.onUnauthorized?.(token)
        if (response.status === 204) return undefined as T
        let body: unknown
        try {
          body = await response.json()
        } catch {
          if (controller.signal.aborted)
            throw new DOMException('Solicitud cancelada.', 'AbortError')
          throw new ApiError(
            response.status,
            'INVALID_RESPONSE',
            response.status >= 500
              ? 'El servicio no está disponible en este momento. Inténtalo más tarde.'
              : 'No pudimos interpretar la respuesta del servidor. Inténtalo nuevamente.',
          )
        }
        if (!response.ok) {
          const error = errorBody(body)
          const message =
            response.status >= 500
              ? 'El servicio no está disponible en este momento. Inténtalo más tarde.'
              : response.status === 401
                ? 'El usuario o la contraseña no son correctos.'
                : response.status === 403
                  ? 'No tienes permisos para realizar esta acción.'
                  : error?.message || 'No pudimos completar la solicitud.'
          throw new ApiError(
            response.status,
            error?.code || 'HTTP_ERROR',
            message,
            response.status >= 500 ? [] : error?.details,
          )
        }
        return body as T
      } catch (error) {
        if (error instanceof ApiError) throw error
        if (controller.signal.aborted && !timedOut)
          throw new DOMException('Solicitud cancelada.', 'AbortError')
        throw new ApiError(
          0,
          timedOut ? 'TIMEOUT' : 'NETWORK_ERROR',
          timedOut
            ? 'El servidor está tardando demasiado. Vuelve a intentarlo.'
            : 'No pudimos conectar con el servicio. Revisa tu conexión e inténtalo nuevamente.',
        )
      } finally {
        clearTimeout(timer)
        init.signal?.removeEventListener('abort', abort)
      }
    },
  }
}
export type HttpClient = ReturnType<typeof createHttpClient>
