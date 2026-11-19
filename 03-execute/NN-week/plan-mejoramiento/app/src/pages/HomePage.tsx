import { Link } from 'react-router'
import { useAuth } from '../auth/context'
import { Icon } from '../components/Icon'
import { modules, roleName } from '../routes/navigation'

export function HomePage() {
  const { session } = useAuth()
  if (!session) return null
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">SALÓN COMUNAL</span>
          <h1>Tu comunidad, en buenas manos.</h1>
          <p className="muted">Bienvenido, {session.username}. Este es tu espacio de gestión.</p>
        </div>
        <span className="role-badge">
          <Icon name="users" />
          {roleName[session.role]}
        </span>
      </div>
      <section className="welcome-card" aria-labelledby="welcome-title">
        <div>
          <span className="eyebrow">UN LUGAR PARA COMPARTIR</span>
          <h2 id="welcome-title">
            Cuidemos lo que
            <br />
            nos pertenece a todos.
          </h2>
          <p>
            Un préstamo bien organizado hace que los utensilios sigan llegando a quienes los
            necesitan.
          </p>
        </div>
        <div className="welcome-art" aria-hidden="true">
          <span />
          <Icon name="articles" />
          <span />
        </div>
      </section>
      <div className="home-columns">
        <section aria-labelledby="modules-title">
          <div className="section-heading">
            <h2 id="modules-title">Explora el espacio</h2>
            <span>Secciones del sistema</span>
          </div>
          <div className="module-grid">
            {modules
              .filter((module) => !module.adminOnly || session.role === 'admin')
              .map((module) => (
                <Link className="module-card" to={module.path} key={module.path}>
                  <span className="module-icon">
                    <Icon name={module.icon} />
                  </span>
                  <span className="module-status">
                    {module.available ? 'Disponible' : 'Próximamente'}
                  </span>
                  <h3>{module.title}</h3>
                  <p>{module.description}</p>
                  <span className="module-link">
                    {module.available ? 'Abrir módulo' : 'Ver estado del módulo'}{' '}
                    <Icon name="arrow" />
                  </span>
                </Link>
              ))}
          </div>
        </section>
        <aside className="session-card" aria-labelledby="session-title">
          <span className="module-icon">
            <Icon name="lock" />
          </span>
          <h2 id="session-title">Tu sesión</h2>
          <p className="muted">Un acceso personal para cuidar un espacio de todos.</p>
          <dl>
            <dt>Usuario</dt>
            <dd>{session.username}</dd>
            <dt>Permisos</dt>
            <dd>{roleName[session.role]}</dd>
            <dt>Vencimiento</dt>
            <dd>
              {new Intl.DateTimeFormat('es-CO', {
                hour: '2-digit',
                minute: '2-digit',
                timeZone: 'UTC',
              }).format(session.expiresAt)}{' '}
              UTC
            </dd>
          </dl>
          <div className="small-note">
            Si recargas la página, volverás al inicio de sesión. Al terminar, recuerda cerrar tu
            sesión.
          </div>
        </aside>
      </div>
    </>
  )
}
