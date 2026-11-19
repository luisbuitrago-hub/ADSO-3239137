import { Link, useLocation } from 'react-router'
import { useAuth } from '../auth/context'
import { Icon } from '../components/Icon'
import { modules } from '../routes/navigation'

export function ModulePage() {
  const { session } = useAuth()
  const location = useLocation()
  const module = modules.find((item) => item.path === location.pathname)
  if (!module) return <NotFoundPage />
  if (module.adminOnly && session?.role !== 'admin')
    return (
      <section className="empty-state">
        <span className="large-icon">
          <Icon name="lock" />
        </span>
        <span className="eyebrow">ACCESO RESTRINGIDO</span>
        <h1>Esta sección es para administradores</h1>
        <p>
          Tu sesión de operador sigue activa. Puedes volver a las secciones autorizadas de tu
          espacio.
        </p>
        <Link className="button button-primary" to="/home">
          Volver al inicio <Icon name="arrow" />
        </Link>
      </section>
    )
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">ESPACIO DE GESTIÓN</span>
          <h1>{module.title}</h1>
          <p className="muted">{module.description}</p>
        </div>
      </div>
      <section className="empty-state">
        <span className="large-icon">
          <Icon name={module.icon} />
        </span>
        <span className="status-tag">EN PREPARACIÓN</span>
        <h2>Este módulo está en preparación</h2>
        <p>
          La navegación está lista. Esta sección todavía no permite consultar ni registrar
          información.
        </p>
        <Link className="button button-secondary" to="/home">
          Volver al inicio <Icon name="arrow" />
        </Link>
      </section>
    </>
  )
}

export function NotFoundPage() {
  return (
    <main id="main-content" className="empty-state" tabIndex={-1}>
      <span className="eyebrow">PÁGINA NO ENCONTRADA</span>
      <h1>No encontramos esta página</h1>
      <p>Revisa la dirección o regresa al inicio de Kitchenware.</p>
      <Link className="button button-primary" to="/home">
        Ir al inicio <Icon name="arrow" />
      </Link>
    </main>
  )
}
