import { useRef, useState, type FormEvent } from 'react'
import { Navigate, useLocation } from 'react-router'
import { useAuth } from '../auth/context'
import { Icon } from '../components/Icon'
import { ApiError } from '../services/http'
import { safeReturnPath } from '../routes/navigation'

export function LoginPage() {
  const { session, notice, login } = useAuth()
  const location = useLocation()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const busy = useRef(false)
  const userInput = useRef<HTMLInputElement>(null)
  const passwordInput = useRef<HTMLInputElement>(null)
  const errorBox = useRef<HTMLDivElement>(null)
  if (session)
    return (
      <Navigate to={safeReturnPath((location.state as { from?: unknown } | null)?.from)} replace />
    )

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (busy.current) return
    const next: Record<string, string> = {}
    if (!username.trim()) next.username = 'Escribe tu nombre de usuario.'
    else if ([...username.trim()].length > 120)
      next.username = 'El usuario admite hasta 120 caracteres.'
    if (!password) next.password = 'Escribe tu contraseña.'
    setErrors(next)
    setMessage('')
    if (Object.keys(next).length) {
      ;(next.username ? userInput : passwordInput).current?.focus()
      return
    }
    busy.current = true
    setLoading(true)
    try {
      await login({ username: username.trim().toLowerCase(), password })
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return
      if (error instanceof ApiError) {
        setMessage(error.message)
        const fields: Record<string, string> = {}
        for (const detail of error.details)
          if (['username', 'password'].includes(detail.field)) fields[detail.field] = detail.issue
        setErrors(fields)
      } else setMessage('No pudimos iniciar sesión. Inténtalo nuevamente.')
      setPassword('')
      requestAnimationFrame(() => errorBox.current?.focus())
    } finally {
      busy.current = false
      setLoading(false)
    }
  }
  const notices = {
    expired: 'Tu sesión venció. Vuelve a iniciar sesión para continuar.',
    invalid: 'Tu sesión dejó de ser válida. Inicia sesión nuevamente.',
    'signed-out': 'Cerraste sesión correctamente.',
  }
  return (
    <main id="main-content" className="login-page" tabIndex={-1}>
      <section className="login-story" aria-label="Kitchenware, utensilios que nos reúnen">
        <a className="brand brand-light" href="/login">
          <span className="brand-icon">
            <Icon name="kitchen" />
          </span>
          <span>
            kitchenware<span className="brand-subtitle">AL SERVICIO DE LA COMUNIDAD</span>
          </span>
        </a>
        <div className="story-content">
          <span className="eyebrow">COMPARTIR TAMBIÉN ES CUIDAR</span>
          <h1>
            Utensilios que
            <br />
            nos reúnen<span className="accent-dot">.</span>
          </h1>
          <p>
            Un espacio para organizar los préstamos y cuidar lo que compartimos en el salón comunal.
          </p>
          <div className="plate-art" aria-hidden="true">
            <div className="plate-ring">
              <Icon name="kitchen" />
            </div>
            <span className="art-tag">
              De nuestra cocina,
              <br />
              <strong>para todos.</strong>
            </span>
          </div>
        </div>
        <span className="story-footer">
          Kitchenware · Sistema de préstamo de utensilios comunitarios
        </span>
      </section>
      <section className="login-form-panel" aria-labelledby="login-title">
        <div className="login-form-wrap">
          <div className="section-marker">
            <span /> ACCESO AL SISTEMA
          </div>
          <h2 id="login-title">Qué bueno tenerte aquí</h2>
          <p className="muted login-intro">
            Inicia sesión para entrar al espacio de gestión de tu comunidad.
          </p>
          {notice && (
            <p role="status" className="notice">
              {notices[notice]}
            </p>
          )}
          <form onSubmit={submit} noValidate aria-busy={loading}>
            {message && (
              <div className="error-message" role="alert" tabIndex={-1} ref={errorBox}>
                {message}
              </div>
            )}
            <label htmlFor="username">Nombre de usuario</label>
            <input
              ref={userInput}
              id="username"
              name="username"
              autoComplete="username"
              autoCapitalize="none"
              spellCheck={false}
              required
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              aria-invalid={!!errors.username}
              aria-describedby={errors.username ? 'username-error' : undefined}
              disabled={loading}
              placeholder="Tu usuario"
            />
            {errors.username && (
              <span className="field-error" id="username-error">
                {errors.username}
              </span>
            )}
            <label htmlFor="password">Contraseña</label>
            <input
              ref={passwordInput}
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              aria-invalid={!!errors.password}
              aria-describedby={errors.password ? 'password-error' : undefined}
              disabled={loading}
              placeholder="Tu contraseña"
            />
            {errors.password && (
              <span className="field-error" id="password-error">
                {errors.password}
              </span>
            )}
            <button className="button button-primary login-button" type="submit" disabled={loading}>
              {loading ? (
                <>
                  <span className="spinner" aria-hidden="true" /> Iniciando sesión…
                </>
              ) : (
                <>
                  Iniciar sesión <Icon name="arrow" />
                </>
              )}
            </button>
            <span className="sr-only" role="status">
              {loading ? 'Comprobando tus credenciales.' : ''}
            </span>
          </form>
          <div className="session-note">
            <Icon name="lock" />
            <p>
              <strong>Tu sesión permanece solo en esta pestaña.</strong>
              <br />
              Al recargar o cerrar la página tendrás que volver a ingresar. La sesión dura hasta
              ocho horas.
            </p>
          </div>
          <p className="login-help">
            ¿Necesitas acceso? Solicítalo al administrador del salón comunal.
          </p>
        </div>
        <footer className="login-footer">Organizamos lo que compartimos.</footer>
      </section>
    </main>
  )
}
