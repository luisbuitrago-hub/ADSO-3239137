import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'
import { App } from '../src/App'
import { AuthProvider } from '../src/auth/AuthProvider'
import { ArticleCover } from '../src/components/ArticleCover'
import {
  administrationApi,
  coverError,
  rangeErrors,
  MAX_COVER_BYTES,
} from '../src/services/administration'
import { createHttpClient } from '../src/services/http'
import type { Role } from '../src/types/api'
import { articleFixture, paginated } from './catalog-fixtures'
import { deferred, failure, loginPayload, response } from './fixtures'

const fetchMock = vi.fn<typeof fetch>()
const createURL = vi.fn(() => 'blob:private-test')
const revokeURL = vi.fn()
const nativeURL = URL
const withCover = { ...articleFixture, cover_key: 'opaque-key' }
const operator = { id: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee', username: 'nuevo', role: 'operator' }
const report = {
  from: '2026-11-01',
  to: '2026-11-30',
  rows: [
    {
      article_id: articleFixture.id,
      article_name: 'Nombre histórico',
      category_name: 'ollas',
      times_borrowed: 3,
    },
    {
      article_id: articleFixture.id,
      article_name: 'Otro nombre histórico',
      category_name: 'vajilla',
      times_borrowed: 1,
    },
  ],
}
type Handler = (url: URL, init: RequestInit) => Response | Promise<Response> | undefined
const image = () =>
  new Response(new Uint8Array([137, 80, 78, 71]), { headers: { 'Content-Type': 'image/png' } })
async function open(path: string, role: Role = 'admin', handler?: Handler) {
  fetchMock.mockImplementation(async (input, init = {}) => {
    const url = new URL(String(input))
    const overridden = handler?.(url, init)
    if (overridden !== undefined) return overridden
    const route = url.pathname.replace('/api/v1', '')
    if (route === '/auth/login') return response(loginPayload(role))
    if (route === `/articles/${articleFixture.id}`) return response(withCover)
    if (route === `/articles/${articleFixture.id}/cover`) {
      if (init.method === 'DELETE') return new Response(null, { status: 204 })
      if (init.method === 'PUT') return response(withCover)
      return image()
    }
    if (route === '/articles') return response(paginated([withCover]))
    if (route === '/categories') return response([articleFixture.category])
    if (route === '/reports/most-borrowed') return response(report)
    if (route === '/users') return response(operator, 201)
    if (route === '/health') return response({ status: 'ok' })
    return failure(404, 'NOT_FOUND', 'No existe el registro.')
  })
  const view = render(
    <MemoryRouter initialEntries={[path]}>
      <AuthProvider>
        <App />
      </AuthProvider>
    </MemoryRouter>,
  )
  const user = userEvent.setup()
  await user.type(await screen.findByLabelText('Nombre de usuario'), 'persona')
  await user.type(screen.getByLabelText('Contraseña'), 'credencial de prueba')
  await user.click(screen.getByRole('button', { name: 'Iniciar sesión' }))
  return { ...view, user }
}
const requests = (suffix: string, method = 'GET') =>
  fetchMock.mock.calls.filter(
    ([url, init]) =>
      new URL(String(url)).pathname.endsWith(suffix) && (init?.method || 'GET') === method,
  )
const file = () => new File(['png-fixture'], 'imagen.png', { type: 'image/png' })
async function fillOperator(user: ReturnType<typeof userEvent.setup>) {
  await user.type(await screen.findByLabelText('Nombre de usuario del operador'), ' NUEVO ')
  await user.type(screen.getByLabelText('Contraseña del operador'), 'contraseña temporal')
}
async function dates(user: ReturnType<typeof userEvent.setup>) {
  fireEvent.change(await screen.findByLabelText('Fecha inicial (UTC)'), {
    target: { value: report.from },
  })
  fireEvent.change(screen.getByLabelText('Fecha final (UTC)'), { target: { value: report.to } })
  await user.click(screen.getByRole('button', { name: 'Consultar reporte' }))
}
beforeEach(() => {
  fetchMock.mockReset()
  createURL.mockClear()
  revokeURL.mockClear()
  vi.stubGlobal('fetch', fetchMock)
  vi.stubGlobal(
    'URL',
    class extends nativeURL {
      static createObjectURL = createURL
      static revokeObjectURL = revokeURL
    },
  )
})
afterEach(() => vi.unstubAllGlobals())

describe('Imágenes privadas', () => {
  it('muestra imágenes autenticadas en listado y detalle, liberando URLs al desmontar', async () => {
    const { user, unmount } = await open('/articles', 'operator')
    expect(await screen.findByRole('img', { name: 'Imagen de Olla comunitaria' })).toHaveAttribute(
      'src',
      'blob:private-test',
    )
    const init = requests('/cover')[0][1]!
    expect(new Headers(init.headers).get('Authorization')).toMatch(/^Bearer /)
    expect(init.cache).toBe('no-store')
    expect(String(requests('/cover')[0][0])).not.toContain('access_token')
    await user.click(screen.getByRole('link', { name: 'Ver detalle de Olla comunitaria' }))
    await screen.findByRole('img', { name: 'Imagen de Olla comunitaria' })
    expect(screen.queryByRole('button', { name: 'Reemplazar imagen' })).not.toBeInTheDocument()
    unmount()
    expect(revokeURL).toHaveBeenCalledWith('blob:private-test')
  })
  it('no solicita imagen cuando cover_key es nulo', async () => {
    await open(`/articles/${articleFixture.id}`, 'operator', (url) =>
      url.pathname.endsWith(`/articles/${articleFixture.id}`)
        ? response(articleFixture)
        : undefined,
    )
    expect(await screen.findByText('Sin imagen disponible')).toBeVisible()
    expect(requests('/cover')).toHaveLength(0)
  })
  it('trata 404 de imagen como alternativa sin imagen', async () => {
    await open(`/articles/${articleFixture.id}`, 'operator', (url) =>
      url.pathname.endsWith('/cover') ? failure(404, 'NOT_FOUND', 'Sin imagen.') : undefined,
    )
    expect(await screen.findByText('Sin imagen disponible')).toBeVisible()
  })
  it.each([401, 403, 500])('maneja error HTTP %s al cargar imagen', async (status) => {
    await open(`/articles/${articleFixture.id}`, 'operator', (url) =>
      url.pathname.endsWith('/cover') ? failure(status, 'ERROR', 'Error del servicio.') : undefined,
    )
    if (status === 401)
      expect(
        await screen.findByText('Tu sesión dejó de ser válida. Inicia sesión nuevamente.'),
      ).toBeVisible()
    else expect(await screen.findByRole('alert')).toBeVisible()
  })
  it('permite reintentar la imagen tras error de conexión', async () => {
    let attempts = 0
    const { user } = await open(`/articles/${articleFixture.id}`, 'operator', (url) =>
      url.pathname.endsWith('/cover')
        ? ++attempts === 1
          ? Promise.reject(new TypeError('offline'))
          : image()
        : undefined,
    )
    await user.click(await screen.findByRole('button', { name: 'Reintentar' }))
    expect(await screen.findByRole('img', { name: 'Imagen de Olla comunitaria' })).toBeVisible()
  })
  it('impide respuestas obsoletas y aborta al cambiar de imagen', async () => {
    const pending = deferred<Response>()
    fetchMock.mockImplementation(() => pending.promise)
    const view = render(
      <AuthProvider>
        <ArticleCover id={articleFixture.id} name="Primera" coverKey="primera" />
      </AuthProvider>,
    )
    await waitFor(() => expect(fetchMock).toHaveBeenCalled())
    const signal = fetchMock.mock.calls[0][1]!.signal!
    view.rerender(
      <AuthProvider>
        <ArticleCover id={articleFixture.id} name="Segunda" coverKey={null} />
      </AuthProvider>,
    )
    expect(signal.aborted).toBe(true)
    await act(async () => pending.resolve(image()))
    expect(createURL).not.toHaveBeenCalled()
    expect(screen.queryByRole('img')).not.toBeInTheDocument()
  })
  it('sube y reemplaza usando PUT multipart con campo file, sin Content-Type manual', async () => {
    const { user } = await open(`/articles/${articleFixture.id}`)
    await user.upload(await screen.findByLabelText('Seleccionar imagen JPG o PNG'), file())
    await user.click(screen.getByRole('button', { name: 'Reemplazar imagen' }))
    expect(await screen.findByText('Imagen guardada correctamente.')).toBeVisible()
    const init = requests('/cover', 'PUT')[0][1]!
    expect(init.body).toBeInstanceOf(FormData)
    expect([...(init.body as FormData).keys()]).toEqual(['file'])
    expect(new Headers(init.headers).has('Content-Type')).toBe(false)
    await waitFor(() => expect(requests('/cover').length).toBe(2))
    expect(revokeURL).toHaveBeenCalled()
    await user.upload(await screen.findByLabelText('Seleccionar imagen JPG o PNG'), file())
    expect(screen.queryByText('Imagen guardada correctamente.')).not.toBeInTheDocument()
  })
  it('valida selección, tipo, cero bytes y frontera de 2 MB', () => {
    expect(coverError(null)).toContain('Selecciona')
    expect(coverError(new File(['svg'], 'fake.svg', { type: 'image/svg+xml' }))).toContain(
      'JPG o PNG',
    )
    expect(coverError(new File([], 'empty.png', { type: 'image/png' }))).toContain('contener datos')
    expect(
      coverError(new File([new Uint8Array(MAX_COVER_BYTES)], 'max.png', { type: 'image/png' })),
    ).toBeUndefined()
    expect(
      coverError(
        new File([new Uint8Array(MAX_COVER_BYTES + 1)], 'large.png', { type: 'image/png' }),
      ),
    ).toContain('2 MB')
  })
  it('no envía archivos inválidos y muestra error por campo', async () => {
    const { user } = await open(`/articles/${articleFixture.id}`)
    const input = await screen.findByLabelText('Seleccionar imagen JPG o PNG')
    fireEvent.change(input, {
      target: { files: [new File(['svg'], 'bad.svg', { type: 'image/svg+xml' })] },
    })
    await user.click(screen.getByRole('button', { name: 'Reemplazar imagen' }))
    expect(screen.getByRole('alert')).toHaveTextContent('JPG o PNG')
    expect(requests('/cover', 'PUT')).toHaveLength(0)
  })
  it.each([404, 422])('muestra error HTTP %s de subida sin perder archivo', async (status) => {
    const { user } = await open(`/articles/${articleFixture.id}`, 'admin', (url, init) =>
      url.pathname.endsWith('/cover') && init.method === 'PUT'
        ? failure(status, 'VALIDATION_ERROR', 'No se pudo guardar la imagen.', [
            { field: 'file', issue: 'Revisa el contenido.' },
          ])
        : undefined,
    )
    await user.upload(await screen.findByLabelText('Seleccionar imagen JPG o PNG'), file())
    await user.click(screen.getByRole('button', { name: 'Reemplazar imagen' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('No se pudo guardar')
    expect(screen.getByText('Imagen: Revisa el contenido.')).toBeVisible()
    expect(
      (screen.getByLabelText('Seleccionar imagen JPG o PNG') as HTMLInputElement).files,
    ).toHaveLength(1)
  })
  it('elimina solo después de confirmar, con prevención de doble envío', async () => {
    const pending = deferred<Response>()
    let deleted = false
    const { user } = await open(`/articles/${articleFixture.id}`, 'admin', (url, init) => {
      if (url.pathname.endsWith('/cover') && init.method === 'DELETE') {
        deleted = true
        return pending.promise
      }
      if (deleted && url.pathname.endsWith(`/articles/${articleFixture.id}`))
        return response(articleFixture)
    })
    await user.click(await screen.findByRole('button', { name: 'Eliminar imagen' }))
    expect(requests('/cover', 'DELETE')).toHaveLength(0)
    const button = screen.getByRole('button', { name: 'Confirmar eliminación de imagen' })
    await waitFor(() => expect(button).toHaveFocus())
    fireEvent.click(button)
    fireEvent.click(button)
    expect(requests('/cover', 'DELETE')).toHaveLength(1)
    await act(async () => pending.resolve(new Response(null, { status: 204 })))
    expect(await screen.findByText('Imagen eliminada correctamente.')).toBeVisible()
    expect(await screen.findByText('Sin imagen disponible')).toBeVisible()
  })
  it('cancelar la eliminación conserva imagen y foco', async () => {
    const { user } = await open(`/articles/${articleFixture.id}`)
    const button = await screen.findByRole('button', { name: 'Eliminar imagen' })
    await user.click(button)
    await user.click(screen.getByRole('button', { name: 'Cancelar eliminación' }))
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Eliminar imagen' })).toHaveFocus(),
    )
    expect(requests('/cover', 'DELETE')).toHaveLength(0)
  })
  it('rechaza SVG recibido como imagen aunque HTTP sea 200', async () => {
    fetchMock.mockResolvedValue(
      new Response('<svg/>', { headers: { 'Content-Type': 'image/svg+xml' } }),
    )
    await expect(
      administrationApi(createHttpClient()).cover(articleFixture.id),
    ).rejects.toMatchObject({ code: 'INVALID_RESPONSE' })
    expect(createURL).not.toHaveBeenCalled()
  })
})

describe('Reporte histórico', () => {
  it('envía fechas inclusivas UTC y conserva filas históricas y orden de API', async () => {
    const { user } = await open('/reports')
    expect(requests('/reports/most-borrowed')).toHaveLength(0)
    await dates(user)
    expect(await screen.findByRole('table')).toHaveTextContent('Nombre histórico')
    expect(
      screen
        .getAllByRole('row')
        .slice(1)
        .map((row) => row.textContent),
    ).toEqual(['Nombre históricoollas3', 'Otro nombre históricovajilla1'])
    const query = new URL(String(requests('/reports/most-borrowed')[0][0])).searchParams
    expect(Object.fromEntries(query)).toEqual({ from: report.from, to: report.to })
  })
  it('valida fechas reales, obligatorias y orden sin solicitar al servidor', async () => {
    const { user } = await open('/reports')
    await user.click(await screen.findByRole('button', { name: 'Consultar reporte' }))
    expect(screen.getAllByRole('alert')).toHaveLength(2)
    expect(rangeErrors('2026-02-29', '2026-03-01').from).toBeTruthy()
    expect(rangeErrors('2024-02-29', '2024-02-29')).toEqual({})
    fireEvent.change(screen.getByLabelText('Fecha inicial (UTC)'), {
      target: { value: '2026-11-30' },
    })
    fireEvent.change(screen.getByLabelText('Fecha final (UTC)'), {
      target: { value: '2026-11-01' },
    })
    await user.click(screen.getByRole('button', { name: 'Consultar reporte' }))
    expect(screen.getByRole('alert')).toHaveTextContent('anterior a la inicial')
    expect(requests('/reports/most-borrowed')).toHaveLength(0)
  })
  it('muestra resultados vacíos', async () => {
    const { user } = await open('/reports', 'admin', (url) =>
      url.pathname.endsWith('/reports/most-borrowed')
        ? response({ ...report, rows: [] })
        : undefined,
    )
    await dates(user)
    expect(await screen.findByText('No hay préstamos en este periodo')).toBeVisible()
  })
  it('oculta resultados anteriores al cambiar fechas', async () => {
    const { user } = await open('/reports')
    await dates(user)
    await screen.findByRole('table')
    fireEvent.change(screen.getByLabelText('Fecha final (UTC)'), {
      target: { value: '2026-11-29' },
    })
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
  })
  it.each([401, 403, 422, 500])('maneja HTTP %s en reporte', async (status) => {
    const { user } = await open('/reports', 'admin', (url) =>
      url.pathname.endsWith('/reports/most-borrowed')
        ? failure(status, 'INVALID_DATE_RANGE', 'Rango inválido.')
        : undefined,
    )
    await dates(user)
    if (status === 401)
      expect(
        await screen.findByText('Tu sesión dejó de ser válida. Inicia sesión nuevamente.'),
      ).toBeVisible()
    else expect(await screen.findByRole('alert')).toBeVisible()
  })
  it('no permite reportes al operador ni emite la petición', async () => {
    await open('/reports', 'operator')
    expect(await screen.findByText('Esta sección es para administradores')).toBeVisible()
    expect(requests('/reports/most-borrowed')).toHaveLength(0)
  })
})

describe('Registro seguro de operadores', () => {
  it('crea solamente operator, normaliza usuario y vacía contraseña sin almacenarla', async () => {
    const { user } = await open('/users')
    await fillOperator(user)
    await user.click(screen.getByRole('button', { name: 'Registrar operador' }))
    expect(await screen.findByText('Operador nuevo registrado correctamente.')).toBeVisible()
    const body = JSON.parse(String(requests('/users', 'POST')[0][1]!.body))
    expect(body).toEqual({ username: 'nuevo', password: 'contraseña temporal', role: 'operator' })
    expect(screen.getByLabelText('Contraseña del operador')).toHaveValue('')
    expect(localStorage.length).toBe(0)
    expect(sessionStorage.length).toBe(0)
    expect(screen.queryByText('contraseña temporal')).not.toBeInTheDocument()
    expect(requests('/users')).toHaveLength(0)
  })
  it('valida usuario, contraseña obligatoria y límite de 72 bytes, sin mínimo inventado', async () => {
    const { user } = await open('/users')
    await user.click(await screen.findByRole('button', { name: 'Registrar operador' }))
    expect(screen.getByText(/debe contener entre 1 y 120/)).toBeVisible()
    await user.type(screen.getByLabelText('Nombre de usuario del operador'), 'nuevo')
    await user.type(screen.getByLabelText('Contraseña del operador'), 'á'.repeat(37))
    await user.click(screen.getByRole('button', { name: 'Registrar operador' }))
    expect(screen.getByText('La contraseña no puede superar 72 bytes.')).toBeVisible()
    expect(requests('/users', 'POST')).toHaveLength(0)
    await user.type(screen.getByLabelText('Contraseña del operador'), 'x')
    await user.click(screen.getByRole('button', { name: 'Registrar operador' }))
    expect(await screen.findByText('Operador nuevo registrado correctamente.')).toBeVisible()
  })
  it.each([401, 403, 409, 422])('maneja HTTP %s sin conservar contraseña', async (status) => {
    const { user } = await open('/users', 'admin', (url, init) =>
      url.pathname.endsWith('/users') && init.method === 'POST'
        ? failure(
            status,
            status === 409 ? 'USERNAME_TAKEN' : 'VALIDATION_ERROR',
            'No se pudo registrar.',
            [{ field: 'username', issue: 'Revisa el nombre.' }],
          )
        : undefined,
    )
    await fillOperator(user)
    await user.click(screen.getByRole('button', { name: 'Registrar operador' }))
    if (status === 401)
      expect(
        await screen.findByText('Tu sesión dejó de ser válida. Inicia sesión nuevamente.'),
      ).toBeVisible()
    else {
      expect(await screen.findByRole('alert')).toBeVisible()
      expect(screen.getByLabelText('Contraseña del operador')).toHaveValue('')
    }
  })
  it('impide doble registro mientras espera respuesta', async () => {
    const pending = deferred<Response>()
    const { user } = await open('/users', 'admin', (url, init) =>
      url.pathname.endsWith('/users') && init.method === 'POST' ? pending.promise : undefined,
    )
    await fillOperator(user)
    const button = screen.getByRole('button', { name: 'Registrar operador' })
    fireEvent.click(button)
    fireEvent.click(button)
    expect(requests('/users', 'POST')).toHaveLength(1)
    expect(button).toBeDisabled()
    await act(async () => pending.resolve(response(operator, 201)))
    await screen.findByText('Operador nuevo registrado correctamente.')
  })
  it('rechaza acceso directo del operador', async () => {
    await open('/users', 'operator')
    expect(await screen.findByText('Esta sección es para administradores')).toBeVisible()
    expect(requests('/users', 'POST')).toHaveLength(0)
  })
  it('advierte resultado incierto sin inventar un listado de usuarios cuando falla la red', async () => {
    const { user } = await open('/users', 'admin', (url, init) =>
      url.pathname.endsWith('/users') && init.method === 'POST'
        ? Promise.reject(new TypeError('offline'))
        : undefined,
    )
    await fillOperator(user)
    await user.click(screen.getByRole('button', { name: 'Registrar operador' }))
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Consulta con administración antes de repetir',
    )
    expect(screen.getByLabelText('Contraseña del operador')).toHaveValue('')
    expect(requests('/users')).toHaveLength(0)
    expect(requests('/users', 'POST')).toHaveLength(1)
  })
  it('acepta respuestas JPG autenticadas sin convertirlas en URLs públicas', async () => {
    fetchMock.mockResolvedValue(
      new Response(new Uint8Array([255, 216, 255, 217]), {
        headers: { 'Content-Type': 'image/jpeg' },
      }),
    )
    const blob = await administrationApi(createHttpClient()).cover(articleFixture.id)
    expect(blob.type).toBe('image/jpeg')
    expect(blob.size).toBe(4)
  })
  it('permite comprobar el endpoint público health desde inicio sin Bearer', async () => {
    const { user } = await open('/home')
    await user.click(await screen.findByRole('button', { name: 'Comprobar servicio' }))
    expect(await screen.findByText('Servicio disponible.')).toBeVisible()
    expect(new Headers(requests('/health')[0][1]!.headers).has('Authorization')).toBe(false)
  })
})
