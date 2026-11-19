import { afterEach, describe, expect, it, vi } from 'vitest'
import { apiBaseUrl, createHttpClient } from '../src/services/http'
import { sessionFromResponse } from '../src/auth/session'
import { failure, loginPayload, response } from './fixtures'

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})
describe('Cliente HTTP y contrato de sesión', () => {
  it('permite espacios y puntos en búsquedas codificadas sin permitir traversal de rutas', async () => {
    const fetchMock = vi.fn().mockResolvedValue(response({ items: [] }))
    vi.stubGlobal('fetch', fetchMock)
    await createHttpClient().request('/articles?q=olla+grande+..+%25_%21')
    expect(new URL(fetchMock.mock.calls[0][0]).searchParams.get('q')).toBe('olla grande .. %_!')
    await expect(createHttpClient().request('/../health')).rejects.toThrow('Ruta API inválida')
    await expect(createHttpClient().request('/articles#fragment')).rejects.toThrow(
      'Ruta API inválida',
    )
  })
  it.each([
    'https://host/api/v1?token=no',
    'https://user:secret@host/api/v1',
    'javascript:alert(1)',
    'https://host/v2',
  ])('rechaza configuración insegura o fuera de contrato: %s', (url) => {
    expect(() => apiBaseUrl(url)).toThrow()
  })
  it('admite URL pública explícita o ruta del proxy sin doble slash', () => {
    expect(apiBaseUrl('https://api.example/api/v1/')).toBe('https://api.example/api/v1')
    expect(apiBaseUrl('/api/v1')).toContain('/api/v1')
  })
  it('cancela por timeout con mensaje comprensible', async () => {
    vi.useFakeTimers()
    vi.stubGlobal(
      'fetch',
      vi.fn(
        (_url: string, init: RequestInit) =>
          new Promise((_resolve, reject) => {
            init.signal?.addEventListener('abort', () =>
              reject(new DOMException('Aborted', 'AbortError')),
            )
          }),
      ),
    )
    const promise = createHttpClient({ timeoutMs: 50 }).request('/health')
    const assertion = expect(promise).rejects.toMatchObject({ code: 'TIMEOUT' })
    await vi.advanceTimersByTimeAsync(51)
    await assertion
  })
  it('no expone HTML, trazas o contenido arbitrario en errores no JSON', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response('<html>internal error</html>', { status: 502 })),
    )
    await expect(createHttpClient().request('/health')).rejects.toMatchObject({
      code: 'INVALID_RESPONSE',
    })
  })
  it('un 401 en una petición pública no invalida otra sesión', async () => {
    const onUnauthorized = vi.fn()
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(failure(401, 'INVALID_CREDENTIALS', 'Credenciales incorrectas.')),
    )
    await expect(
      createHttpClient({ getToken: () => loginPayload().access_token, onUnauthorized }).request(
        '/auth/login',
        {},
        false,
      ),
    ).rejects.toMatchObject({ status: 401 })
    expect(onUnauthorized).not.toHaveBeenCalled()
  })
  it('rechaza redirigir las credenciales a otro origen', async () => {
    const fetchMock = vi.fn().mockResolvedValue(response({ status: 'ok' }))
    vi.stubGlobal('fetch', fetchMock)
    await createHttpClient().request('/health')
    expect(fetchMock.mock.calls[0][1].redirect).toBe('error')
    await expect(createHttpClient().request('//external.example')).rejects.toThrow(
      'Ruta API inválida',
    )
  })
  it.each([
    () => ({ ...loginPayload(), role: 'neighbor' }),
    () => ({ ...loginPayload(), expires_in: 10 }),
    () => loginPayload('operator', Math.floor(Date.now() / 1000) - 1),
    () => ({ ...loginPayload(), token_type: 'Cookie' }),
    () => ({ ...loginPayload(), access_token: loginPayload('operator').access_token }),
  ])('rechaza respuestas o claims incompatibles', (payload) => {
    expect(() => sessionFromResponse(payload(), 'admin')).toThrow('La sesión recibida no es válida')
  })
})
