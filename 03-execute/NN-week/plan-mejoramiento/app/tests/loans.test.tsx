import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { App } from '../src/App'
import { AuthProvider } from '../src/auth/AuthProvider'
import { createHttpClient } from '../src/services/http'
import { loansApi, utcDate } from '../src/services/loans'
import type { Role } from '../src/types/api'
import { articleFixture, neighborFixture, paginated } from './catalog-fixtures'
import { deferred, failure, loginPayload, response } from './fixtures'
import { loanFixture, overdueFixture } from './loan-fixtures'

const fetchMock = vi.fn<typeof fetch>()
type Handler = (url: URL, init: RequestInit) => Response | Promise<Response> | undefined
async function open(path: string, role: Role = 'operator', handler?: Handler) {
  fetchMock.mockImplementation(async (input, init = {}) => {
    const url = new URL(String(input))
    const override = handler?.(url, init)
    if (override !== undefined) return override
    const route = url.pathname.replace('/api/v1', '')
    if (route === '/auth/login') return response(loginPayload(role))
    if (route === '/loans/overdue') return response({ items: [] })
    if (route === '/loans' && init.method === 'POST') return response(loanFixture, 201)
    if (route === '/loans')
      return response(
        paginated(
          url.searchParams.get('status') === 'overdue' ? [] : [loanFixture],
          Number(url.searchParams.get('page') || 1),
          Number(url.searchParams.get('size') || 20),
        ),
      )
    if (route === `/loans/${loanFixture.id}`) return response(loanFixture)
    if (route === '/neighbors') return response(paginated([neighborFixture], 1, 10))
    if (route === `/neighbors/${neighborFixture.id}`) return response(neighborFixture)
    if (route === '/articles') return response(paginated([articleFixture], 1, 10))
    if (route === `/articles/${articleFixture.id}`) return response(articleFixture)
    return failure(404, 'NOT_FOUND', 'El registro no existe.')
  })
  render(
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
  return user
}
const requests = (suffix: string, method = 'GET') =>
  fetchMock.mock.calls.filter(
    ([url, init]) =>
      new URL(String(url)).pathname.endsWith(suffix) && (init?.method || 'GET') === method,
  )
async function select(user: ReturnType<typeof userEvent.setup>) {
  await user.click(await screen.findByRole('button', { name: 'Seleccionar a María Gómez' }))
  await screen.findByText(/Puede recibir hasta 1 artículos más/)
  await user.click(screen.getByRole('button', { name: 'Agregar Olla comunitaria' }))
  await user.click(screen.getByRole('button', { name: 'Revisar préstamo' }))
  await screen.findByRole('heading', { name: 'Confirmar entrega' })
}
beforeEach(() => {
  fetchMock.mockReset()
  vi.stubGlobal('fetch', fetchMock)
})
afterEach(() => vi.unstubAllGlobals())

describe('Registro de préstamos', () => {
  it.each(['admin', 'operator'] as const)(
    'permite crear al rol %s con una unidad y payload exacto',
    async (role) => {
      const user = await open('/loans/new', role)
      await select(user)
      expect(requests('/loans', 'POST')).toHaveLength(0)
      await user.click(screen.getByRole('button', { name: 'Confirmar préstamo' }))
      expect(await screen.findByText(/Préstamo registrado correctamente/)).toBeVisible()
      const init = requests('/loans', 'POST')[0][1]!
      expect(JSON.parse(String(init.body))).toEqual({
        neighbor_id: neighborFixture.id,
        items: [{ article_id: articleFixture.id }],
      })
      expect(new Headers(init.headers).get('Authorization')).toMatch(/^Bearer /)
      expect(await screen.findByText(/Inventario actual: 3 de 5/)).toBeVisible()
      expect(requests(`/neighbors/${neighborFixture.id}`).length).toBeGreaterThan(1)
    },
  )
  it('exige vecino y selección antes de revisar', async () => {
    const user = await open('/loans/new')
    await user.click(await screen.findByRole('button', { name: 'Revisar préstamo' }))
    expect(screen.getByRole('alert')).toHaveTextContent('Selecciona un vecino')
    await user.click(screen.getByRole('button', { name: 'Seleccionar a María Gómez' }))
    await screen.findByText(/Puede recibir hasta 1/)
    await user.click(screen.getByRole('button', { name: 'Revisar préstamo' }))
    expect(screen.getByRole('alert')).toHaveTextContent('Selecciona entre uno y tres')
  })
  it('busca vecinos y artículos sin mezclar los filtros del contrato', async () => {
    const user = await open('/loans/new')
    await user.type(await screen.findByLabelText('Buscar vecino por nombre o documento'), '001')
    await user.click(screen.getByRole('button', { name: 'Buscar vecino' }))
    await waitFor(() =>
      expect(
        requests('/neighbors').some(
          ([url]) => new URL(String(url)).searchParams.get('q') === '001',
        ),
      ).toBe(true),
    )
    await user.type(screen.getByLabelText('Buscar artículo por nombre o descripción'), 'Olla')
    await user.click(screen.getByRole('button', { name: 'Buscar artículos' }))
    await waitFor(() =>
      expect(
        requests('/articles').some(
          ([url]) => new URL(String(url)).searchParams.get('q') === 'Olla',
        ),
      ).toBe(true),
    )
  })
  it('deshabilita artículos sin disponibilidad', async () => {
    await open('/loans/new', 'operator', (url) =>
      url.pathname.endsWith('/articles')
        ? response(paginated([{ ...articleFixture, available_units: 0 }], 1, 10))
        : undefined,
    )
    expect(
      await screen.findByRole('button', { name: 'Sin disponibilidad de Olla comunitaria' }),
    ).toBeDisabled()
  })
  it('no repite artículos, permite quitarlos y respeta tres líneas distintas', async () => {
    const articles = [0, 1, 2, 3].map((n) => ({
      ...articleFixture,
      id: `aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa${n}`,
      name: `Artículo ${n}`,
    }))
    const user = await open('/loans/new', 'operator', (url) =>
      url.pathname.endsWith('/articles') ? response(paginated(articles, 1, 10)) : undefined,
    )
    for (let n = 0; n < 3; n++)
      await user.click(await screen.findByRole('button', { name: `Agregar Artículo ${n}` }))
    expect(screen.getByRole('button', { name: 'Agregar Artículo 0' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Agregar Artículo 3' })).toBeDisabled()
    await user.click(screen.getByRole('button', { name: 'Quitar Artículo 1' }))
    expect(screen.getByRole('button', { name: 'Agregar Artículo 3' })).toBeEnabled()
  })
  it('cuenta pendientes de otros préstamos y bloquea el cuarto artículo', async () => {
    const user = await open('/loans/new', 'operator', (url) =>
      url.pathname.endsWith(`/neighbors/${neighborFixture.id}`)
        ? response({ ...neighborFixture, active_loans: 3 })
        : undefined,
    )
    await user.click(await screen.findByRole('button', { name: 'Seleccionar a María Gómez' }))
    await screen.findByText(/Puede recibir hasta 0/)
    await user.click(screen.getByRole('button', { name: 'Agregar Olla comunitaria' }))
    await user.click(screen.getByRole('button', { name: 'Revisar préstamo' }))
    expect(screen.getByRole('alert')).toHaveTextContent('tres artículos pendientes')
    expect(requests('/loans', 'POST')).toHaveLength(0)
  })
  it('bloquea vecinos con líneas vencidas', async () => {
    const user = await open('/loans/new', 'operator', (url) =>
      url.pathname.endsWith('/loans') && url.searchParams.get('status') === 'overdue'
        ? response(paginated([{ ...loanFixture, status: 'overdue' }], 1, 1))
        : undefined,
    )
    await user.click(await screen.findByRole('button', { name: 'Seleccionar a María Gómez' }))
    await screen.findByText(/No puede recibir préstamos/)
    await user.click(screen.getByRole('button', { name: 'Agregar Olla comunitaria' }))
    await user.click(screen.getByRole('button', { name: 'Revisar préstamo' }))
    expect(screen.getByRole('alert')).toHaveTextContent('vencidos pendientes')
  })
  it.each([
    [409, 'ARTICLE_NOT_AVAILABLE'],
    [409, 'NEIGHBOR_HAS_OVERDUE'],
    [422, 'NEIGHBOR_LIMIT_EXCEEDED'],
    [422, 'VALIDATION_ERROR'],
  ] as const)('conserva el formulario ante %s %s', async (status, code) => {
    const user = await open('/loans/new', 'operator', (url, init) =>
      url.pathname.endsWith('/loans') && init.method === 'POST'
        ? failure(status, code, 'No se pudo registrar el préstamo.', [
            { field: 'items.0.article_id', issue: 'Revisa este artículo.' },
          ])
        : undefined,
    )
    await select(user)
    await user.click(screen.getByRole('button', { name: 'Confirmar préstamo' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('No se pudo registrar')
    expect(screen.getByText('Artículo 1: Revisa este artículo.')).toBeVisible()
    await user.click(screen.getByRole('button', { name: 'Volver a editar' }))
    expect(screen.getByText(/Olla comunitaria · OLL-001 · 1 unidad/)).toBeVisible()
  })
  it('conserva la selección y advierte de resultado incierto si falla la red al guardar', async () => {
    const user = await open('/loans/new', 'operator', (url, init) =>
      url.pathname.endsWith('/loans') && init.method === 'POST'
        ? Promise.reject(new TypeError('offline'))
        : undefined,
    )
    await select(user)
    await user.click(screen.getByRole('button', { name: 'Confirmar préstamo' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('No podemos confirmar si se guardó')
    expect(
      screen.getByRole('link', { name: 'Consultar préstamos antes de reintentar' }),
    ).toBeVisible()
    expect(requests('/loans', 'POST')).toHaveLength(1)
  })
  it('inicia desde el vecino con su identificador seleccionado y pendientes verificados', async () => {
    const user = await open(`/neighbors/${neighborFixture.id}`)
    await user.click(
      await screen.findByRole('link', { name: 'Registrar préstamo para este vecino' }),
    )
    expect(await screen.findByText(/Seleccionado: María Gómez/)).toBeVisible()
    expect(await screen.findByText(/Puede recibir hasta 1/)).toBeVisible()
  })
  it('no deja confirmar si no puede consultar la elegibilidad del vecino', async () => {
    const user = await open('/loans/new', 'operator', (url) =>
      url.pathname.endsWith('/loans') && url.searchParams.get('status') === 'overdue'
        ? failure(503, 'UNAVAILABLE', 'Temporalmente no disponible.')
        : undefined,
    )
    await user.click(await screen.findByRole('button', { name: 'Seleccionar a María Gómez' }))
    await screen.findByRole('alert')
    await user.click(screen.getByRole('button', { name: 'Agregar Olla comunitaria' }))
    await user.click(screen.getByRole('button', { name: 'Revisar préstamo' }))
    expect(screen.getByText('No se pudo verificar al vecino.')).toBeVisible()
    expect(screen.queryByRole('button', { name: 'Confirmar préstamo' })).not.toBeInTheDocument()
  })
  it('bloquea doble envío mientras espera la respuesta', async () => {
    const pending = deferred<Response>()
    const user = await open('/loans/new', 'operator', (url, init) =>
      url.pathname.endsWith('/loans') && init.method === 'POST' ? pending.promise : undefined,
    )
    await select(user)
    const button = screen.getByRole('button', { name: 'Confirmar préstamo' })
    fireEvent.click(button)
    fireEvent.click(button)
    expect(requests('/loans', 'POST')).toHaveLength(1)
    expect(button).toBeDisabled()
    await act(async () => pending.resolve(response(loanFixture, 201)))
    await screen.findByRole('heading', { name: 'Detalle del préstamo' })
  })
})

describe('Consultas y devoluciones', () => {
  it('lista y filtra estado, rango UTC, vecino y páginas', async () => {
    const user = await open('/loans')
    await user.click(await screen.findByText('Filtrar por vecino'))
    await user.click(await screen.findByRole('button', { name: 'Seleccionar a María Gómez' }))
    expect(await screen.findByRole('table')).toHaveTextContent('Olla histórica')
    await user.selectOptions(screen.getByLabelText('Estado'), 'closed')
    fireEvent.change(screen.getByLabelText('Desde (UTC)'), { target: { value: '2026-11-01' } })
    await waitFor(() =>
      expect(new URL(String(requests('/loans').at(-1)![0])).searchParams.get('from')).toBe(
        '2026-11-01',
      ),
    )
    fireEvent.change(screen.getByLabelText('Hasta (UTC)'), { target: { value: '2026-11-30' } })
    await user.selectOptions(await screen.findByLabelText('Por página'), '50')
    await waitFor(() => {
      const params = new URL(String(requests('/loans').at(-1)![0])).searchParams
      expect(Object.fromEntries(params)).toEqual({
        status: 'closed',
        from: '2026-11-01',
        to: '2026-11-30',
        neighbor_id: neighborFixture.id,
        page: '1',
        size: '50',
      })
    })
    await user.click(screen.getByRole('button', { name: 'Limpiar filtros' }))
    await waitFor(() =>
      expect(new URL(String(requests('/loans').at(-1)![0])).searchParams.has('neighbor_id')).toBe(
        false,
      ),
    )
  })
  it('pagina préstamos sin enviar q', async () => {
    const user = await open('/loans', 'operator', (url) =>
      url.pathname.endsWith('/loans')
        ? response(paginated([loanFixture], Number(url.searchParams.get('page') || 1), 20, 21))
        : undefined,
    )
    await user.click(await screen.findByRole('button', { name: 'Siguiente' }))
    await waitFor(() =>
      expect(new URL(String(requests('/loans').at(-1)![0])).searchParams.get('page')).toBe('2'),
    )
    expect(new URL(String(requests('/loans').at(-1)![0])).searchParams.has('q')).toBe(false)
  })
  it('muestra snapshots y estado cerrado sin permitir devolución', async () => {
    await open(`/loans/${loanFixture.id}`, 'operator', (url) =>
      url.pathname.endsWith(`/loans/${loanFixture.id}`)
        ? response({
            ...loanFixture,
            status: 'closed',
            items: [{ ...loanFixture.items[0], returned_at: '2026-11-20T12:00:00Z' }],
          })
        : undefined,
    )
    expect(await screen.findByRole('heading', { name: 'Olla histórica' })).toBeVisible()
    expect(screen.getByText('HIST-001')).toBeVisible()
    expect(screen.getByText('ollas históricas')).toBeVisible()
    expect(screen.getByText('Cerrado')).toBeVisible()
    expect(
      screen.queryByRole('button', { name: 'Devolver Olla histórica' }),
    ).not.toBeInTheDocument()
    expect(await screen.findByRole('link', { name: 'María Gómez' })).toBeVisible()
  })
  it('devuelve con confirmación y recarga estado, inventario y pendientes reales', async () => {
    let returned = false
    const user = await open(`/loans/${loanFixture.id}`, 'operator', (url, init) => {
      if (url.pathname.endsWith('/return') && init.method === 'POST') {
        returned = true
        return response({ ...loanFixture.items[0], returned_at: '2026-11-20T12:00:00Z' })
      }
      if (returned && url.pathname.endsWith(`/loans/${loanFixture.id}`))
        return response({
          ...loanFixture,
          status: 'closed',
          items: [{ ...loanFixture.items[0], returned_at: '2026-11-20T12:00:00Z' }],
        })
      if (returned && url.pathname.endsWith(`/articles/${articleFixture.id}`))
        return response({ ...articleFixture, available_units: 4 })
      if (returned && url.pathname.endsWith(`/neighbors/${neighborFixture.id}`))
        return response({ ...neighborFixture, active_loans: 1 })
    })
    await user.click(await screen.findByRole('button', { name: 'Devolver Olla histórica' }))
    expect(requests('/return', 'POST')).toHaveLength(0)
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Confirmar devolución' })).toHaveFocus(),
    )
    await user.click(screen.getByRole('button', { name: 'Confirmar devolución' }))
    expect(await screen.findByText(/Devolución registrada correctamente/)).toBeVisible()
    expect(await screen.findByText('Cerrado')).toBeVisible()
    expect(await screen.findByText(/Inventario actual: 4 de 5/)).toBeVisible()
    expect(await screen.findByText(/Artículos pendientes: 1/)).toBeVisible()
    expect(requests('/return', 'POST')[0][1]!.body).toBeUndefined()
    expect(
      screen.queryByRole('button', { name: 'Devolver Olla histórica' }),
    ).not.toBeInTheDocument()
  })
  it('cancelar no devuelve y restaura el foco', async () => {
    const user = await open(`/loans/${loanFixture.id}`)
    const button = await screen.findByRole('button', { name: 'Devolver Olla histórica' })
    await user.click(button)
    await user.click(screen.getByRole('button', { name: 'Cancelar' }))
    await waitFor(() => expect(button).toHaveFocus())
    expect(requests('/return', 'POST')).toHaveLength(0)
  })
  it('impide doble devolución y actualiza tras conflicto 409 sin reintento automático', async () => {
    const pending = deferred<Response>()
    const user = await open(`/loans/${loanFixture.id}`, 'operator', (url, init) =>
      url.pathname.endsWith('/return') && init.method === 'POST' ? pending.promise : undefined,
    )
    await user.click(await screen.findByRole('button', { name: 'Devolver Olla histórica' }))
    const button = screen.getByRole('button', { name: 'Confirmar devolución' })
    fireEvent.click(button)
    fireEvent.click(button)
    expect(requests('/return', 'POST')).toHaveLength(1)
    await act(async () =>
      pending.resolve(failure(409, 'ITEM_ALREADY_RETURNED', 'Esta línea ya fue devuelta.')),
    )
    expect(await screen.findByRole('alert')).toHaveTextContent('ya fue devuelta')
    expect(button).toBeDisabled()
    await user.click(screen.getByRole('button', { name: 'Consultar estado actualizado' }))
    await screen.findByRole('heading', { name: 'Detalle del préstamo' })
    expect(requests('/return', 'POST')).toHaveLength(1)
    expect(requests(`/loans/${loanFixture.id}`).length).toBeGreaterThan(1)
  })
  it('conserva devolución histórica aunque el catálogo responda 404', async () => {
    const user = await open(`/loans/${loanFixture.id}`, 'operator', (url) =>
      url.pathname.endsWith(`/articles/${articleFixture.id}`)
        ? failure(404, 'NOT_FOUND', 'Artículo inactivo.')
        : undefined,
    )
    expect(await screen.findByText(/Artículo no disponible en el catálogo activo/)).toBeVisible()
    await user.click(screen.getByRole('button', { name: 'Devolver Olla histórica' }))
    expect(screen.getByRole('button', { name: 'Confirmar devolución' })).toBeEnabled()
  })
  it('lista vencimientos con días del servidor y enlaza al préstamo', async () => {
    const user = await open('/overdue', 'operator', (url) =>
      url.pathname.endsWith('/loans/overdue') ? response({ items: [overdueFixture] }) : undefined,
    )
    expect(await screen.findByRole('table')).toHaveTextContent('María Gómez')
    expect(screen.getByRole('table')).toHaveTextContent('Olla histórica')
    expect(screen.getByRole('cell', { name: '7' })).toBeVisible()
    await user.click(screen.getByRole('link', { name: 'Ver préstamo y devolver' }))
    expect(await screen.findByRole('heading', { name: 'Detalle del préstamo' })).toBeVisible()
  })
  it.each(['/loans', '/overdue'])('maneja vacío en %s', async (path) => {
    await open(path, 'operator', (url) =>
      url.pathname.endsWith('/loans/overdue')
        ? response({ items: [] })
        : url.pathname.endsWith('/loans')
          ? response(paginated([]))
          : undefined,
    )
    expect(
      await screen.findByRole('heading', {
        name: path === '/loans' ? 'No encontramos préstamos' : 'No hay artículos vencidos',
      }),
    ).toBeVisible()
  })
  it('muestra carga de préstamos', async () => {
    const pending = deferred<Response>()
    await open('/loans', 'operator', (url) =>
      url.pathname.endsWith('/loans') ? pending.promise : undefined,
    )
    expect(await screen.findByText('Cargando préstamos…')).toBeVisible()
    await act(async () => pending.resolve(response(paginated([]))))
    await screen.findByText('No encontramos préstamos')
  })
  it('permite reintentar una consulta fallida sin repetir escrituras', async () => {
    let count = 0
    const user = await open('/overdue', 'operator', (url) =>
      url.pathname.endsWith('/loans/overdue')
        ? ++count === 1
          ? Promise.reject(new TypeError('offline'))
          : response({ items: [] })
        : undefined,
    )
    expect(await screen.findByRole('alert')).toBeVisible()
    await user.click(screen.getByRole('button', { name: 'Reintentar' }))
    expect(await screen.findByText('No hay artículos vencidos')).toBeVisible()
  })
  it.each([404, 403, 401])('gestiona HTTP %s sin inventar permisos', async (status) => {
    await open(`/loans/${loanFixture.id}`, 'operator', (url) =>
      url.pathname.endsWith(`/loans/${loanFixture.id}`)
        ? failure(status, 'ACCESS_ERROR', 'Acceso no permitido.')
        : undefined,
    )
    if (status === 401)
      expect(await screen.findByRole('heading', { name: 'Qué bueno tenerte aquí' })).toBeVisible()
    else {
      expect(await screen.findByRole('alert')).toBeVisible()
      expect(screen.queryByRole('heading', { name: 'Iniciar sesión' })).not.toBeInTheDocument()
    }
  })
})

describe('Contrato del adaptador de préstamos', () => {
  it('rechaza identificadores inválidos sin enviar solicitudes', async () => {
    const api = loansApi(createHttpClient())
    await expect(api.get('../secret')).rejects.toMatchObject({ status: 404 })
    await expect(api.returnItem(loanFixture.id, 'otro')).rejects.toMatchObject({ status: 404 })
    expect(fetchMock).not.toHaveBeenCalled()
  })
  it('rechaza respuestas incompletas', async () => {
    fetchMock.mockResolvedValue(
      response({ ...loanFixture, items: [{ ...loanFixture.items[0], due_at: 'ayer' }] }),
    )
    await expect(loansApi(createHttpClient()).get(loanFixture.id)).rejects.toMatchObject({
      code: 'INVALID_RESPONSE',
    })
  })
  it('presenta fechas UTC sin depender de la zona local', () => {
    expect(utcDate('2026-11-22T12:00:00Z')).toContain('12:00 UTC')
  })
})
