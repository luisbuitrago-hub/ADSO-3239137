import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'
import { App } from '../src/App'
import { AuthProvider } from '../src/auth/AuthProvider'
import type { Role } from '../src/types/api'
import { articleFixture, categoriesFixture, neighborFixture, paginated } from './catalog-fixtures'
import { deferred, failure, loginPayload, response } from './fixtures'

const fetchMock = vi.fn<typeof fetch>()
type Handler = (url: URL, init: RequestInit) => Response | Promise<Response> | undefined
function mockApi(role: Role = 'admin', handler?: Handler) {
  fetchMock.mockImplementation(async (input, init = {}) => {
    const url = new URL(String(input))
    const overridden = handler?.(url, init)
    if (overridden !== undefined) return overridden
    if (url.pathname.endsWith('/auth/login')) return response(loginPayload(role))
    if (url.pathname.endsWith('/categories')) return response(categoriesFixture)
    if (url.pathname.endsWith('/articles'))
      return response(
        paginated(
          [articleFixture],
          Number(url.searchParams.get('page') || 1),
          Number(url.searchParams.get('size') || 20),
        ),
      )
    if (url.pathname.endsWith(`/articles/${articleFixture.id}`)) return response(articleFixture)
    if (url.pathname.endsWith('/neighbors'))
      return response(
        paginated(
          [neighborFixture],
          Number(url.searchParams.get('page') || 1),
          Number(url.searchParams.get('size') || 20),
        ),
      )
    if (url.pathname.endsWith(`/neighbors/${neighborFixture.id}`)) return response(neighborFixture)
    return failure(404, 'NOT_FOUND', 'El registro solicitado no existe.')
  })
}
async function open(path: string, role: Role = 'admin', handler?: Handler) {
  mockApi(role, handler)
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
  return { user, ...view }
}
const requests = (suffix: string, method = 'GET') =>
  fetchMock.mock.calls.filter(
    ([url, init]) =>
      new URL(String(url)).pathname.endsWith(suffix) && (init?.method || 'GET') === method,
  )
async function fillArticle(user: ReturnType<typeof userEvent.setup>) {
  await user.type(await screen.findByLabelText('Nombre', { exact: true }), 'Olla comunitaria')
  await user.type(screen.getByLabelText('Referencia'), 'OLL-001')
  await user.selectOptions(
    screen.getByLabelText('Categoría', { exact: true }),
    articleFixture.category.id,
  )
  await user.type(screen.getByLabelText('Unidades totales'), '5')
  await user.type(screen.getByLabelText('Descripción'), 'Para preparar alimentos en el salón')
}
beforeEach(() => {
  fetchMock.mockReset()
  vi.stubGlobal('fetch', fetchMock)
})
afterEach(() => {
  vi.unstubAllGlobals()
})

describe('Categorías y catálogo', () => {
  it('consulta las cinco categorías y filtra artículos desde su enlace', async () => {
    const { user } = await open('/categories')
    expect(await screen.findByRole('heading', { name: 'ollas' })).toBeVisible()
    expect(
      categoriesFixture.every((category) => screen.getByRole('heading', { name: category.name })),
    ).toBe(true)
    await user.click(screen.getByRole('link', { name: /ollas Consultar artículos/ }))
    await screen.findByRole('table')
    expect(new URL(String(requests('/articles').at(-1)![0])).searchParams.get('category_id')).toBe(
      articleFixture.category.id,
    )
    expect(screen.getByLabelText('Categoría')).toHaveValue(articleFixture.category.id)
  })
  it('muestra categorías vacías sin inventar registros', async () => {
    await open('/categories', 'operator', (url) =>
      url.pathname.endsWith('/categories') ? response([]) : undefined,
    )
    expect(await screen.findByText('No hay categorías disponibles')).toBeVisible()
  })
  it('muestra carga de categorías y después los datos', async () => {
    const pending = deferred<Response>()
    await open('/categories', 'admin', (url) =>
      url.pathname.endsWith('/categories') ? pending.promise : undefined,
    )
    expect(await screen.findByText('Cargando categorías…')).toBeVisible()
    await act(async () => {
      pending.resolve(response(categoriesFixture))
    })
    expect(await screen.findByRole('heading', { name: 'ollas' })).toBeVisible()
  })
  it('permite reintentar categorías tras error', async () => {
    let count = 0
    const { user } = await open('/categories', 'admin', (url) =>
      url.pathname.endsWith('/categories')
        ? ++count === 1
          ? failure(503, 'INTERNAL_ERROR', 'Error')
          : response(categoriesFixture)
        : undefined,
    )
    await screen.findByRole('alert')
    await user.click(screen.getByRole('button', { name: 'Reintentar' }))
    expect(await screen.findByRole('heading', { name: 'ollas' })).toBeVisible()
  })
  it('lista inventario, busca texto literal y reinicia la página', async () => {
    const { user } = await open('/articles')
    expect(await screen.findByRole('table')).toHaveTextContent('3 / 5')
    await user.type(
      screen.getByLabelText('Buscar por nombre o descripción'),
      'olla grande .. + %_!',
    )
    await user.click(screen.getByRole('button', { name: 'Buscar' }))
    await waitFor(() =>
      expect(new URL(String(requests('/articles').at(-1)![0])).searchParams.get('q')).toBe(
        'olla grande .. + %_!',
      ),
    )
    expect(new URL(String(requests('/articles').at(-1)![0])).searchParams.get('page')).toBe('1')
  })
  it('filtra por categoría y cambia tamaño sin superar 50', async () => {
    const { user } = await open('/articles')
    await screen.findByRole('table')
    await user.selectOptions(screen.getByLabelText('Categoría'), articleFixture.category.id)
    await waitFor(() =>
      expect(
        new URL(String(requests('/articles').at(-1)![0])).searchParams.get('category_id'),
      ).toBe(articleFixture.category.id),
    )
    await screen.findByRole('table')
    await user.selectOptions(screen.getByLabelText('Por página'), '50')
    await waitFor(() =>
      expect(new URL(String(requests('/articles').at(-1)![0])).searchParams.get('size')).toBe('50'),
    )
    expect(screen.queryByRole('option', { name: '100' })).not.toBeInTheDocument()
  })
  it('pagina conservando la búsqueda', async () => {
    const { user } = await open('/articles', 'admin', (url) =>
      url.pathname.endsWith('/articles')
        ? response(paginated([articleFixture], Number(url.searchParams.get('page') || 1), 20, 21))
        : undefined,
    )
    await screen.findByRole('table')
    await user.type(screen.getByLabelText('Buscar por nombre o descripción'), 'olla')
    await user.click(screen.getByRole('button', { name: 'Buscar' }))
    await screen.findByRole('table')
    await user.click(screen.getByRole('button', { name: 'Siguiente' }))
    await waitFor(() =>
      expect(new URL(String(requests('/articles').at(-1)![0])).searchParams.get('page')).toBe('2'),
    )
    expect(new URL(String(requests('/articles').at(-1)![0])).searchParams.get('q')).toBe('olla')
  })
  it('una búsqueda anterior tardía no reemplaza resultados más recientes', async () => {
    const old = deferred<Response>()
    const { user } = await open('/articles', 'admin', (url) => {
      if (url.pathname.endsWith('/articles') && url.searchParams.get('q') === 'anterior')
        return old.promise
      if (url.pathname.endsWith('/articles') && url.searchParams.get('q') === 'reciente')
        return response(paginated([{ ...articleFixture, name: 'Resultado reciente' }]))
    })
    await screen.findByRole('table')
    const search = screen.getByLabelText('Buscar por nombre o descripción')
    await user.type(search, 'anterior')
    await user.click(screen.getByRole('button', { name: 'Buscar' }))
    await waitFor(() => expect(requests('/articles').length).toBe(2))
    await user.clear(screen.getByLabelText('Buscar por nombre o descripción'))
    await user.type(screen.getByLabelText('Buscar por nombre o descripción'), 'reciente')
    await user.click(screen.getByRole('button', { name: 'Buscar' }))
    expect(
      await screen.findByRole('link', { name: 'Ver detalle de Resultado reciente' }),
    ).toBeVisible()
    await act(async () => {
      old.resolve(response(paginated([{ ...articleFixture, name: 'Resultado obsoleto' }])))
    })
    expect(screen.queryByText('Resultado obsoleto')).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Ver detalle de Resultado reciente' })).toBeVisible()
  })
  it('muestra lista vacía y permite limpiar filtros', async () => {
    const { user } = await open('/articles', 'admin', (url) =>
      url.pathname.endsWith('/articles') ? response(paginated([])) : undefined,
    )
    expect(await screen.findByText('No encontramos artículos')).toBeVisible()
    await user.click(screen.getByRole('button', { name: 'Limpiar filtros' }))
    expect(screen.getByLabelText('Buscar por nombre o descripción')).toHaveValue('')
  })
  it('abre detalle con inventario sin consumir portadas', async () => {
    const { user } = await open('/articles')
    await user.click(await screen.findByRole('link', { name: 'Ver detalle de Olla comunitaria' }))
    expect(await screen.findByRole('heading', { name: 'Olla comunitaria' })).toBeVisible()
    expect(screen.getByText('Unidades disponibles')).toBeVisible()
    expect(screen.getByText('Para preparar alimentos en el salón')).toBeVisible()
    expect(fetchMock.mock.calls.some(([url]) => String(url).includes('/cover'))).toBe(false)
  })
  it.each([403, 404])('presenta el error HTTP %s de un detalle', async (status) => {
    await open(`/articles/${articleFixture.id}`, 'admin', (url) =>
      url.pathname.endsWith(articleFixture.id)
        ? failure(
            status,
            status === 404 ? 'NOT_FOUND' : 'FORBIDDEN_ROLE',
            'El artículo no está disponible.',
          )
        : undefined,
    )
    expect(await screen.findByRole('alert')).toHaveTextContent(
      status === 404 ? 'No encontramos este registro' : 'No tienes acceso',
    )
  })
  it('un 401 de catálogo devuelve al login', async () => {
    await open('/articles', 'admin', (url) =>
      url.pathname.endsWith('/articles')
        ? failure(401, 'INVALID_CREDENTIALS', 'Token inválido.')
        : undefined,
    )
    expect(
      await screen.findByText('Tu sesión dejó de ser válida. Inicia sesión nuevamente.'),
    ).toBeVisible()
  })
  it('operador no ve acciones administrativas en lista ni detalle', async () => {
    const { user } = await open('/articles', 'operator')
    await screen.findByRole('table')
    expect(screen.queryByRole('link', { name: 'Registrar artículo' })).not.toBeInTheDocument()
    await user.click(screen.getByRole('link', { name: 'Ver detalle de Olla comunitaria' }))
    await screen.findByRole('heading', { name: 'Olla comunitaria' })
    expect(screen.queryByRole('link', { name: 'Editar artículo' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Desactivar artículo' })).not.toBeInTheDocument()
  })
  it.each(['/articles/new', `/articles/${articleFixture.id}/edit`])(
    'operador no accede directamente a %s',
    async (path) => {
      await open(path, 'operator')
      expect(
        await screen.findByRole('heading', { name: 'Esta sección es para administradores' }),
      ).toBeVisible()
      expect(requests('/categories')).toHaveLength(0)
    },
  )
})

describe('Registro, edición y baja de artículos', () => {
  it('valida campos obligatorios sin enviar POST', async () => {
    const { user } = await open('/articles/new')
    await user.click(await screen.findByRole('button', { name: 'Registrar artículo' }))
    expect(screen.getAllByText('Este campo es obligatorio.')).toHaveLength(3)
    expect(screen.getByLabelText('Unidades totales')).toHaveAccessibleDescription(
      expect.stringContaining('Escribe un entero'),
    )
    expect(requests('/articles', 'POST')).toHaveLength(0)
  })
  it('crea artículo con solo los campos del contrato y actualiza el detalle', async () => {
    const { user } = await open('/articles/new', 'admin', (url, init) =>
      url.pathname.endsWith('/articles') && init.method === 'POST'
        ? response(articleFixture, 201)
        : undefined,
    )
    await fillArticle(user)
    await user.click(screen.getByRole('button', { name: 'Registrar artículo' }))
    expect(await screen.findByText('Artículo registrado correctamente.')).toBeVisible()
    expect(JSON.parse(requests('/articles', 'POST')[0][1]!.body as string)).toEqual({
      name: articleFixture.name,
      description: articleFixture.description,
      reference: 'OLL-001',
      category_id: articleFixture.category.id,
      total_units: 5,
    })
    expect(requests(`/articles/${articleFixture.id}`)).toHaveLength(1)
  })
  it('edita sin enviar referencia ni disponibilidad y consulta el nuevo detalle', async () => {
    let updated = false
    const { user } = await open(`/articles/${articleFixture.id}/edit`, 'admin', (url, init) => {
      if (!url.pathname.endsWith(articleFixture.id)) return undefined
      if (init.method === 'PUT') {
        updated = true
        return response({
          ...articleFixture,
          name: 'Olla actualizada',
          total_units: 6,
          available_units: 4,
        })
      }
      if (updated)
        return response({
          ...articleFixture,
          name: 'Olla actualizada',
          total_units: 6,
          available_units: 4,
        })
    })
    const name = await screen.findByLabelText('Nombre', { exact: true })
    expect(screen.getByLabelText('Referencia')).toHaveAttribute('readonly')
    await user.clear(name)
    await user.type(name, 'Olla actualizada')
    await user.clear(screen.getByLabelText('Unidades totales'))
    await user.type(screen.getByLabelText('Unidades totales'), '6')
    await user.click(screen.getByRole('button', { name: 'Guardar cambios' }))
    expect(await screen.findByRole('heading', { name: 'Olla actualizada' })).toBeVisible()
    const body = JSON.parse(requests(`/articles/${articleFixture.id}`, 'PUT')[0][1]!.body as string)
    expect(Object.keys(body).sort()).toEqual(['category_id', 'description', 'name', 'total_units'])
  })
  it.each(['0', '-1', '1.5', '2147483648'])('rechaza cantidad inválida %s', async (total) => {
    const { user } = await open(`/articles/${articleFixture.id}/edit`)
    const quantity = await screen.findByLabelText('Unidades totales')
    await user.clear(quantity)
    await user.type(quantity, total)
    await user.click(screen.getByRole('button', { name: 'Guardar cambios' }))
    expect(quantity).toHaveAttribute('aria-invalid', 'true')
    expect(requests(`/articles/${articleFixture.id}`, 'PUT')).toHaveLength(0)
  })
  it('protege el mínimo conocido por unidades pendientes', async () => {
    const { user } = await open(`/articles/${articleFixture.id}/edit`)
    const quantity = await screen.findByLabelText('Unidades totales')
    await user.clear(quantity)
    await user.type(quantity, '1')
    await user.click(screen.getByRole('button', { name: 'Guardar cambios' }))
    expect(
      screen.getByText('El total no puede ser menor que las unidades pendientes de devolución.'),
    ).toBeVisible()
    expect(requests(`/articles/${articleFixture.id}`, 'PUT')).toHaveLength(0)
  })
  it('no confirma una escritura cuando falla la conexión y no reintenta automáticamente', async () => {
    const { user } = await open('/articles/new', 'admin', (url, init) => {
      if (url.pathname.endsWith('/articles') && init.method === 'POST')
        return Promise.reject(new TypeError('Offline'))
    })
    await fillArticle(user)
    await user.click(screen.getByRole('button', { name: 'Registrar artículo' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('No podemos confirmar si se guardó')
    expect(requests('/articles', 'POST')).toHaveLength(1)
    expect(screen.getByRole('button', { name: 'Registrar artículo' })).toBeEnabled()
    expect(screen.getByLabelText('Nombre')).toHaveValue('Olla comunitaria')
  })
  it('muestra referencia duplicada 409 sin perder el formulario', async () => {
    const { user } = await open('/articles/new', 'admin', (url, init) =>
      url.pathname.endsWith('/articles') && init.method === 'POST'
        ? failure(409, 'REFERENCE_TAKEN', 'La referencia ya pertenece a un artículo activo.')
        : undefined,
    )
    await fillArticle(user)
    await user.click(screen.getByRole('button', { name: 'Registrar artículo' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('La referencia ya pertenece')
    expect(screen.getByLabelText('Referencia')).toHaveAttribute('aria-invalid', 'true')
    expect(screen.getByLabelText('Nombre', { exact: true })).toHaveValue('Olla comunitaria')
  })
  it('muestra 422 del servidor tras un cambio concurrente de inventario', async () => {
    const { user } = await open(`/articles/${articleFixture.id}/edit`, 'admin', (url, init) =>
      init.method === 'PUT' && url.pathname.endsWith(articleFixture.id)
        ? failure(422, 'VALIDATION_ERROR', 'El total no respalda las unidades prestadas.', [
            { field: 'total_units', issue: 'Hay más unidades prestadas.' },
          ])
        : undefined,
    )
    await user.click(await screen.findByRole('button', { name: 'Guardar cambios' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('El total no respalda')
    expect(screen.getByLabelText('Unidades totales')).toHaveAttribute('aria-invalid', 'true')
  })
  it('exige confirmación, permite cancelar y realiza baja lógica con 204', async () => {
    let removed = false
    const { user } = await open(`/articles/${articleFixture.id}`, 'admin', (url, init) => {
      if (init.method === 'DELETE') {
        removed = true
        return new Response(null, { status: 204 })
      }
      if (removed && url.pathname.endsWith('/articles')) return response(paginated([]))
    })
    await user.click(await screen.findByRole('button', { name: 'Desactivar artículo' }))
    expect(requests(`/articles/${articleFixture.id}`, 'DELETE')).toHaveLength(0)
    await user.click(screen.getByRole('button', { name: 'Cancelar' }))
    expect(
      screen.queryByRole('button', { name: 'Confirmar desactivación' }),
    ).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Desactivar artículo' }))
    await user.click(screen.getByRole('button', { name: 'Confirmar desactivación' }))
    expect(
      await screen.findByText('Artículo desactivado correctamente. Su historial se conserva.'),
    ).toBeVisible()
    expect(await screen.findByText('No encontramos artículos')).toBeVisible()
  })
  it('conserva el detalle si el servidor rechaza baja con préstamos abiertos', async () => {
    const { user } = await open(`/articles/${articleFixture.id}`, 'admin', (_url, init) =>
      init.method === 'DELETE'
        ? failure(409, 'ARTICLE_HAS_OPEN_LOANS', 'El artículo tiene préstamos pendientes.')
        : undefined,
    )
    await user.click(await screen.findByRole('button', { name: 'Desactivar artículo' }))
    await user.click(screen.getByRole('button', { name: 'Confirmar desactivación' }))
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'El artículo tiene préstamos pendientes.',
    )
    expect(screen.getByRole('heading', { name: 'Olla comunitaria' })).toBeVisible()
  })
})

describe('Vecinos', () => {
  it('lista y busca por documento preservando ceros y separadores', async () => {
    const { user } = await open('/neighbors', 'operator')
    expect(await screen.findByRole('table')).toHaveTextContent('001-AB')
    await user.type(screen.getByLabelText('Buscar por nombre o documento'), '001-AB')
    await user.click(screen.getByRole('button', { name: 'Buscar' }))
    await waitFor(() =>
      expect(new URL(String(requests('/neighbors').at(-1)![0])).searchParams.get('q')).toBe(
        '001-AB',
      ),
    )
  })
  it('muestra pendientes como artículos, sin inventar edición o eliminación', async () => {
    const { user } = await open('/neighbors', 'operator')
    await user.click(await screen.findByRole('link', { name: 'Ver detalle de María Gómez' }))
    expect(await screen.findByRole('heading', { name: 'María Gómez' })).toBeVisible()
    expect(screen.getByText('Artículos pendientes de devolución')).toBeVisible()
    expect(screen.getByText('2', { exact: true })).toBeVisible()
    expect(screen.queryByRole('button', { name: /Eliminar|Editar/ })).not.toBeInTheDocument()
  })
  it.each(['admin', 'operator'] as const)(
    'registra como %s y obtiene el detalle actualizado',
    async (role) => {
      const { user } = await open('/neighbors/new', role, (url, init) =>
        url.pathname.endsWith('/neighbors') && init.method === 'POST'
          ? response(neighborFixture, 201)
          : undefined,
      )
      await user.type(await screen.findByLabelText('Nombre completo'), ' María Gómez ')
      await user.type(screen.getByLabelText('Documento de identidad'), ' 001-AB ')
      await user.click(screen.getByRole('button', { name: 'Registrar vecino' }))
      expect(await screen.findByText('Vecino registrado correctamente.')).toBeVisible()
      expect(JSON.parse(requests('/neighbors', 'POST')[0][1]!.body as string)).toEqual({
        full_name: 'María Gómez',
        document_number: '001-AB',
      })
      expect(requests(`/neighbors/${neighborFixture.id}`)).toHaveLength(1)
    },
  )
  it('valida documentos obligatorios y de hasta treinta caracteres', async () => {
    const { user } = await open('/neighbors/new')
    await user.click(await screen.findByRole('button', { name: 'Registrar vecino' }))
    expect(screen.getAllByText('Este campo es obligatorio.')).toHaveLength(2)
    await user.type(screen.getByLabelText('Nombre completo'), 'María')
    await user.type(screen.getByLabelText('Documento de identidad'), 'x'.repeat(31))
    await user.click(screen.getByRole('button', { name: 'Registrar vecino' }))
    expect(screen.getByText('Admite hasta 30 caracteres.')).toBeVisible()
    expect(requests('/neighbors', 'POST')).toHaveLength(0)
  })
  it('muestra documento duplicado 409', async () => {
    const { user } = await open('/neighbors/new', 'admin', (url, init) =>
      url.pathname.endsWith('/neighbors') && init.method === 'POST'
        ? failure(409, 'DOCUMENT_TAKEN', 'El documento ya está registrado.')
        : undefined,
    )
    await user.type(await screen.findByLabelText('Nombre completo'), 'María')
    await user.type(screen.getByLabelText('Documento de identidad'), '001-AB')
    await user.click(screen.getByRole('button', { name: 'Registrar vecino' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('El documento ya está registrado.')
    expect(screen.getByLabelText('Documento de identidad')).toHaveAttribute('aria-invalid', 'true')
  })
  it('previene envíos duplicados y muestra carga mientras registra', async () => {
    const pending = deferred<Response>()
    await open('/neighbors/new', 'operator', (url, init) =>
      url.pathname.endsWith('/neighbors') && init.method === 'POST' ? pending.promise : undefined,
    )
    fireEvent.change(await screen.findByLabelText('Nombre completo'), {
      target: { value: 'María' },
    })
    fireEvent.change(screen.getByLabelText('Documento de identidad'), {
      target: { value: '001-AB' },
    })
    const form = screen.getByLabelText('Nombre completo').closest('form')!
    fireEvent.submit(form)
    fireEvent.submit(form)
    expect(screen.getByRole('button', { name: 'Guardando…' })).toBeDisabled()
    expect(requests('/neighbors', 'POST')).toHaveLength(1)
    await act(async () => {
      pending.resolve(response(neighborFixture, 201))
    })
    expect(await screen.findByText('Vecino registrado correctamente.')).toBeVisible()
  })
  it('muestra vecinos vacíos', async () => {
    await open('/neighbors', 'operator', (url) =>
      url.pathname.endsWith('/neighbors') ? response(paginated([])) : undefined,
    )
    expect(await screen.findByText('No encontramos vecinos')).toBeVisible()
  })
  it('muestra vecino inexistente', async () => {
    await open(`/neighbors/${neighborFixture.id}`, 'operator', (url) =>
      url.pathname.endsWith(neighborFixture.id)
        ? failure(404, 'NOT_FOUND', 'El vecino solicitado no existe.')
        : undefined,
    )
    expect(await screen.findByRole('alert')).toHaveTextContent('No encontramos este registro')
  })
})
