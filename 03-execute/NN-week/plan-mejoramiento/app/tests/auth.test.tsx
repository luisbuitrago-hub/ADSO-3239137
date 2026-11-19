import { useState } from 'react'
import { act, fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { App } from '../src/App'
import { AuthProvider } from '../src/auth/AuthProvider'
import { useAuth } from '../src/auth/context'
import { deferred, failure, loginPayload, response } from './fixtures'

const fetchMock = vi.fn<typeof fetch>()
beforeEach(() => {
  fetchMock.mockReset()
  vi.stubGlobal('fetch', fetchMock)
  localStorage.clear()
  sessionStorage.clear()
})
afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})
function RequestProbe() {
  const { client } = useAuth()
  const [error, setError] = useState('')
  return (
    <>
      <button
        onClick={() => {
          void client.request('/categories').catch((reason: Error) => setError(reason.message))
        }}
      >
        Probar solicitud protegida
      </button>
      {error && <p role="alert">{error}</p>}
    </>
  )
}
function mount(path = '/login', probe = false) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <AuthProvider>
        <App />
        {probe && <RequestProbe />}
      </AuthProvider>
    </MemoryRouter>,
  )
}
async function signIn(username = 'admin', password = 'contraseña de prueba') {
  const user = userEvent.setup()
  await user.type(screen.getByLabelText('Nombre de usuario'), username)
  await user.type(screen.getByLabelText('Contraseña'), password)
  await user.click(screen.getByRole('button', { name: 'Iniciar sesión' }))
  return user
}

describe('Inicio de sesión y navegación', () => {
  it('renderiza etiquetas, contraseña oculta y aviso de recarga', () => {
    mount()
    expect(screen.getByRole('heading', { name: 'Qué bueno tenerte aquí' })).toBeVisible()
    expect(screen.getByLabelText('Contraseña')).toHaveAttribute('type', 'password')
    expect(screen.getByLabelText('Nombre de usuario')).toHaveAttribute('autocomplete', 'username')
    expect(screen.getByText(/Al recargar o cerrar/)).toBeVisible()
  })
  it('valida campos obligatorios sin solicitudes y enfoca el primer error', async () => {
    mount()
    await userEvent.click(screen.getByRole('button', { name: 'Iniciar sesión' }))
    expect(screen.getByText('Escribe tu nombre de usuario.')).toBeVisible()
    expect(screen.getByText('Escribe tu contraseña.')).toBeVisible()
    expect(screen.getByLabelText('Nombre de usuario')).toHaveFocus()
    expect(fetchMock).not.toHaveBeenCalled()
  })
  it('normaliza el usuario, conserva espacios de contraseña y usa el contrato real', async () => {
    fetchMock.mockResolvedValueOnce(response(loginPayload()))
    mount()
    await signIn('  AdMiN  ', ' con espacios ')
    expect(
      await screen.findByRole('heading', { name: 'Tu comunidad, en buenas manos.' }),
    ).toBeVisible()
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toContain('/api/v1/auth/login')
    expect(JSON.parse(init!.body as string)).toEqual({
      username: 'admin',
      password: ' con espacios ',
    })
    expect(new Headers(init!.headers).get('Authorization')).toBeNull()
    expect(init!.credentials).toBe('omit')
    expect(localStorage.length).toBe(0)
    expect(sessionStorage.length).toBe(0)
    expect(document.cookie).toBe('')
  })
  it('muestra credenciales incorrectas y limpia la contraseña', async () => {
    fetchMock.mockResolvedValueOnce(
      failure(401, 'INVALID_CREDENTIALS', 'Credenciales incorrectas.'),
    )
    mount()
    await signIn()
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'El usuario o la contraseña no son correctos.',
    )
    expect(screen.getByLabelText('Contraseña')).toHaveValue('')
  })
  it('explica el error de red y permite volver a intentar', async () => {
    fetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch'))
    mount()
    await signIn()
    expect(await screen.findByRole('alert')).toHaveTextContent('No pudimos conectar')
    expect(screen.getByRole('button', { name: 'Iniciar sesión' })).toBeEnabled()
  })
  it('presenta errores 422 por campo', async () => {
    fetchMock.mockResolvedValueOnce(
      failure(422, 'VALIDATION_ERROR', 'Los datos enviados no son válidos.', [
        { field: 'username', issue: 'El campo supera la longitud permitida.' },
      ]),
    )
    mount()
    await signIn()
    expect(await screen.findByRole('alert')).toHaveTextContent('Los datos enviados no son válidos.')
    expect(screen.getByLabelText('Nombre de usuario')).toHaveAccessibleDescription(
      'El campo supera la longitud permitida.',
    )
  })
  it('no presenta trazas ni mensajes internos de un error 500', async () => {
    fetchMock.mockResolvedValueOnce(
      failure(500, 'INTERNAL_ERROR', 'SQLSTATE detalles internos', [
        { field: 'password', issue: 'SQLSTATE detalles internos' },
      ]),
    )
    mount()
    await signIn()
    expect(await screen.findByRole('alert')).toHaveTextContent('El servicio no está disponible')
    expect(screen.queryByText(/SQLSTATE/)).not.toBeInTheDocument()
  })
  it('muestra carga y bloquea solicitudes duplicadas', async () => {
    const pending = deferred<Response>()
    fetchMock.mockReturnValueOnce(pending.promise)
    mount()
    fireEvent.change(screen.getByLabelText('Nombre de usuario'), { target: { value: 'admin' } })
    fireEvent.change(screen.getByLabelText('Contraseña'), { target: { value: 'contraseña' } })
    const form = screen.getByLabelText('Contraseña').closest('form')!
    fireEvent.submit(form)
    fireEvent.submit(form)
    expect(screen.getByRole('button', { name: 'Iniciando sesión…' })).toBeDisabled()
    expect(screen.getByLabelText('Contraseña')).toBeDisabled()
    expect(fetchMock).toHaveBeenCalledTimes(1)
    await act(async () => {
      pending.resolve(response(loginPayload()))
    })
    expect(
      await screen.findByRole('heading', { name: 'Tu comunidad, en buenas manos.' }),
    ).toBeVisible()
  })
  it.each(['/home', '/articles', '/neighbors', '/loans', '/overdue', '/reports', '/users'])(
    'protege la ruta %s sin sesión',
    async (path) => {
      mount(path)
      expect(await screen.findByRole('heading', { name: 'Qué bueno tenerte aquí' })).toBeVisible()
      expect(fetchMock).not.toHaveBeenCalled()
    },
  )
  it('permite al administrador navegar a reportes sin inventar datos', async () => {
    fetchMock.mockResolvedValueOnce(response(loginPayload()))
    mount()
    const user = await signIn()
    await screen.findByRole('navigation')
    await user.click(within(screen.getByRole('navigation')).getByRole('link', { name: 'Reportes' }))
    expect(await screen.findByRole('heading', { name: 'Reportes' })).toBeVisible()
    expect(
      screen.getByText('Esta sección todavía no permite consultar ni registrar información.', {
        exact: false,
      }),
    ).toBeVisible()
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
  it('oculta administración al operador y permite navegar a vecinos', async () => {
    fetchMock.mockResolvedValueOnce(response(loginPayload('operator')))
    mount()
    const user = await signIn('operador')
    const nav = await screen.findByRole('navigation')
    expect(within(nav).queryByRole('link', { name: 'Reportes' })).not.toBeInTheDocument()
    expect(within(nav).queryByRole('link', { name: 'Operadores' })).not.toBeInTheDocument()
    await user.click(within(nav).getByRole('link', { name: 'Vecinos' }))
    expect(await screen.findByRole('heading', { name: 'Vecinos' })).toBeVisible()
  })
  it('bloquea también el acceso directo del operador a reportes', async () => {
    fetchMock.mockResolvedValueOnce(response(loginPayload('operator')))
    mount('/reports')
    await signIn('operador')
    expect(
      await screen.findByRole('heading', { name: 'Esta sección es para administradores' }),
    ).toBeVisible()
    expect(screen.getByRole('button', { name: 'Cerrar sesión' })).toBeVisible()
  })
  it('cierra sesión, vuelve al login y no llama endpoints adicionales', async () => {
    fetchMock.mockResolvedValueOnce(response(loginPayload()))
    mount()
    const user = await signIn()
    await user.click(await screen.findByRole('button', { name: 'Cerrar sesión' }))
    expect(await screen.findByRole('heading', { name: 'Qué bueno tenerte aquí' })).toBeVisible()
    expect(screen.getByText('Cerraste sesión correctamente.')).toBeVisible()
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument()
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
  it('una recarga crea un contexto sin sesión ni credenciales persistidas', async () => {
    fetchMock.mockResolvedValueOnce(response(loginPayload()))
    const first = mount()
    await signIn()
    await screen.findByRole('navigation')
    first.unmount()
    mount('/home')
    expect(await screen.findByRole('heading', { name: 'Qué bueno tenerte aquí' })).toBeVisible()
    expect(screen.getByLabelText('Contraseña')).toHaveValue('')
    expect(localStorage.length + sessionStorage.length).toBe(0)
  })
  it('rechaza un token malformado recibido con HTTP 200', async () => {
    fetchMock.mockResolvedValueOnce(response({ ...loginPayload(), access_token: 'malformado' }))
    mount()
    await signIn()
    expect(await screen.findByRole('alert')).toHaveTextContent('La sesión recibida no es válida')
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument()
  })
  it('al vencer exp retira las rutas privadas y explica cómo reingresar', async () => {
    vi.useFakeTimers()
    fetchMock.mockResolvedValueOnce(
      response(loginPayload('admin', Math.floor(Date.now() / 1000) + 2)),
    )
    mount()
    fireEvent.change(screen.getByLabelText('Nombre de usuario'), { target: { value: 'admin' } })
    fireEvent.change(screen.getByLabelText('Contraseña'), { target: { value: 'contraseña' } })
    await act(async () => {
      fireEvent.submit(screen.getByLabelText('Contraseña').closest('form')!)
    })
    expect(screen.getByRole('navigation')).toBeVisible()
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2100)
    })
    expect(
      screen.getByText('Tu sesión venció. Vuelve a iniciar sesión para continuar.'),
    ).toBeVisible()
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument()
  })
  it('envía Bearer y abandona la sesión cuando Laravel responde 401', async () => {
    const payload = loginPayload()
    fetchMock
      .mockResolvedValueOnce(response(payload))
      .mockResolvedValueOnce(
        failure(401, 'INVALID_CREDENTIALS', 'Autenticación requerida o token inválido.'),
      )
    mount('/login', true)
    const user = await signIn()
    await screen.findByRole('navigation')
    await user.click(screen.getByRole('button', { name: 'Probar solicitud protegida' }))
    expect(
      await screen.findByText('Tu sesión dejó de ser válida. Inicia sesión nuevamente.'),
    ).toBeVisible()
    expect(new Headers(fetchMock.mock.calls[1][1]!.headers).get('Authorization')).toBe(
      `Bearer ${payload.access_token}`,
    )
  })
  it('un 401 tardío de otra sesión no cierra un login posterior', async () => {
    const oldRequest = deferred<Response>()
    fetchMock
      .mockResolvedValueOnce(response(loginPayload()))
      .mockReturnValueOnce(oldRequest.promise)
      .mockResolvedValueOnce(response(loginPayload()))
    mount('/login', true)
    const user = await signIn()
    await screen.findByRole('navigation')
    await user.click(screen.getByRole('button', { name: 'Probar solicitud protegida' }))
    await user.click(screen.getByRole('button', { name: 'Cerrar sesión' }))
    await screen.findByRole('heading', { name: 'Qué bueno tenerte aquí' })
    await signIn()
    await screen.findByRole('navigation')
    await act(async () => {
      oldRequest.resolve(failure(401, 'INVALID_CREDENTIALS', 'Token inválido.'))
    })
    expect(screen.getByRole('navigation')).toBeVisible()
    expect(
      screen.queryByText('Tu sesión dejó de ser válida. Inicia sesión nuevamente.'),
    ).not.toBeInTheDocument()
  })
  it('un 403 no cierra una sesión válida y conserva el error de permisos', async () => {
    fetchMock
      .mockResolvedValueOnce(response(loginPayload('operator')))
      .mockResolvedValueOnce(
        failure(403, 'FORBIDDEN_ROLE', 'No tienes permisos para realizar esta operación.'),
      )
    mount('/login', true)
    const user = await signIn('operador')
    await screen.findByRole('navigation')
    await user.click(screen.getByRole('button', { name: 'Probar solicitud protegida' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('No tienes permisos')
    expect(screen.getByRole('navigation')).toBeVisible()
  })
})
