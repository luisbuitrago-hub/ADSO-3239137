import { useRef, useState } from 'react'
import { DataError } from '../components/DataViews'
import { useAdministration } from '../hooks/useAdministration'
import { useMutation } from '../hooks/useMutation'
import { ApiError } from '../services/http'
import { fieldErrors } from '../services/validation'
import type { Operator } from '../services/administration'

export function OperatorsPage() {
  const api = useAdministration()
  const mutation = useMutation()
  const password = useRef<HTMLInputElement>(null)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [created, setCreated] = useState<Operator | null>(null)
  const displayedError =
    mutation.error?.status === 0
      ? new ApiError(
          0,
          mutation.error.code,
          'No podemos confirmar si se registró el operador. Consulta con administración antes de repetir.',
        )
      : mutation.error
  const serverErrors = fieldErrors(mutation.error)
  if (mutation.error?.code === 'USERNAME_TAKEN')
    serverErrors.username = 'El nombre de usuario ya está registrado.'
  const issues = { ...serverErrors, ...errors }
  async function submit(form: HTMLFormElement) {
    const data = new FormData(form)
    const username = String(data.get('username') || '')
      .trim()
      .toLowerCase()
    const secret = String(data.get('password') || '')
    const next: Record<string, string> = {}
    if (!username || [...username].length > 120)
      next.username = 'El nombre de usuario debe contener entre 1 y 120 caracteres.'
    if (!secret.trim()) next.password = 'Introduce una contraseña.'
    else if (new TextEncoder().encode(secret).length > 72)
      next.password = 'La contraseña no puede superar 72 bytes.'
    setErrors(next)
    setCreated(null)
    if (Object.keys(next).length) {
      if (password.current) password.current.value = ''
      return
    }
    const result = await mutation.run((signal) => api.createOperator(username, secret, signal))
    if (password.current) password.current.value = ''
    if (result.ok) {
      form.reset()
      setCreated(result.value)
      mutation.clearError()
    }
  }
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">ACCESO ADMINISTRATIVO</span>
          <h1>Registrar operador</h1>
          <p className="muted">
            Crea un acceso con rol de operador para gestionar el servicio comunitario.
          </p>
        </div>
      </div>
      {created && (
        <p className="notice" role="status">
          Operador {created.username} registrado correctamente.
        </p>
      )}
      {displayedError && <DataError error={displayedError} />}
      <form
        className="editor-panel"
        noValidate
        autoComplete="off"
        aria-busy={mutation.pending}
        onSubmit={(e) => {
          e.preventDefault()
          void submit(e.currentTarget)
        }}
      >
        <div className="form-field">
          <label htmlFor="operator-name">Nombre de usuario del operador</label>
          <input
            id="operator-name"
            name="username"
            autoComplete="off"
            required
            disabled={mutation.pending}
            aria-invalid={!!issues.username}
            aria-describedby="operator-name-hint operator-name-error"
            onChange={() => {
              setErrors({})
              mutation.clearError()
              setCreated(null)
            }}
          />
          <p id="operator-name-hint" className="field-hint">
            De 1 a 120 caracteres. Se guarda en minúsculas y sin espacios exteriores.
          </p>
          <p id="operator-name-error" className="field-error">
            {issues.username}
          </p>
        </div>
        <div className="form-field">
          <label htmlFor="operator-password">Contraseña del operador</label>
          <input
            ref={password}
            id="operator-password"
            name="password"
            type="password"
            autoComplete="new-password"
            required
            disabled={mutation.pending}
            aria-invalid={!!issues.password}
            aria-describedby="operator-password-hint operator-password-error"
            onChange={() => setErrors({})}
          />
          <p id="operator-password-hint" className="field-hint">
            Obligatoria, máximo 72 bytes. Se vacía después de cada intento de registro.
          </p>
          <p id="operator-password-error" className="field-error">
            {issues.password}
          </p>
        </div>
        <p>Rol asignado: Operador.</p>
        <button className="button button-primary" type="submit" disabled={mutation.pending}>
          {mutation.pending ? 'Registrando operador…' : 'Registrar operador'}
        </button>
      </form>
    </>
  )
}
