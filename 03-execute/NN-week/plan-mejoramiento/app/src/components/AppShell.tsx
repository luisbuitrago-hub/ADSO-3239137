import { useRef, useState } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router'
import { useAuth } from '../auth/context'
import { modules, roleName } from '../routes/navigation'
import { Icon } from './Icon'

export function AppShell() {
  const { session, logout } = useAuth()
  const [menuOpen, setMenuOpen] = useState(false)
  const navigation = useRef<HTMLElement>(null)
  const menuButton = useRef<HTMLButtonElement>(null)
  const location = useLocation()
  if (!session) return null
  const visible = modules.filter((module) => !module.adminOnly || session.role === 'admin')
  const title =
    modules.find(
      (module) =>
        module.path === location.pathname || location.pathname.startsWith(module.path + '/'),
    )?.title || 'Inicio'
  return (
    <div className="app-shell">
      <aside
        className={`sidebar ${menuOpen ? 'is-open' : ''}`}
        id="sidebar"
        onKeyDown={(event) => {
          if (event.key === 'Escape' && menuOpen) {
            setMenuOpen(false)
            menuButton.current?.focus()
          }
        }}
      >
        <Link to="/home" className="brand brand-light" onClick={() => setMenuOpen(false)}>
          <span className="brand-icon">
            <Icon name="kitchen" />
          </span>
          <span>
            kitchenware<span className="brand-subtitle">GESTIÓN COMUNITARIA</span>
          </span>
        </Link>
        <nav aria-label="Navegación principal" ref={navigation}>
          <span className="nav-caption">TU ESPACIO</span>
          <NavLink to="/home" onClick={() => setMenuOpen(false)}>
            <Icon name="home" />
            Inicio
          </NavLink>
          <span className="nav-caption">GESTIÓN</span>
          {visible
            .filter((module) => !module.adminOnly)
            .map((module) => (
              <NavLink to={module.path} key={module.path} onClick={() => setMenuOpen(false)}>
                <Icon name={module.icon} />
                {module.title}
              </NavLink>
            ))}
          {session.role === 'admin' && (
            <>
              <span className="nav-caption">ADMINISTRACIÓN</span>
              {visible
                .filter((module) => module.adminOnly)
                .map((module) => (
                  <NavLink to={module.path} key={module.path} onClick={() => setMenuOpen(false)}>
                    <Icon name={module.icon} />
                    {module.title}
                  </NavLink>
                ))}
            </>
          )}
        </nav>
        <div className="sidebar-note">
          <Icon name="kitchen" />
          <p>
            Compartimos utensilios.
            <br />
            <strong>Cuidamos nuestra comunidad.</strong>
          </p>
        </div>
      </aside>
      <div className="workspace">
        <header className="topbar">
          <button
            ref={menuButton}
            className="menu-button icon-button"
            type="button"
            aria-label={menuOpen ? 'Cerrar navegación' : 'Abrir navegación'}
            aria-expanded={menuOpen}
            aria-controls="sidebar"
            onClick={() => {
              setMenuOpen(!menuOpen)
              if (!menuOpen)
                requestAnimationFrame(() => navigation.current?.querySelector('a')?.focus())
            }}
          >
            <Icon name="menu" />
          </button>
          <span className="breadcrumb">
            Espacio de gestión <span aria-hidden="true">/</span> <strong>{title}</strong>
          </span>
          <div className="user-area">
            <span className="avatar" aria-hidden="true">
              {session.username.slice(0, 2).toUpperCase()}
            </span>
            <div className="user-identity">
              <strong>{session.username}</strong>
              <span className="role-label">{roleName[session.role]}</span>
            </div>
            <button type="button" className="logout-button" onClick={logout}>
              <Icon name="logout" />
              <span>Cerrar sesión</span>
            </button>
          </div>
        </header>
        <main id="main-content" className="main-content" tabIndex={-1}>
          <Outlet />
        </main>
        <footer className="workspace-footer">
          Kitchenware <span>Hecho para compartir, pensado para cuidar.</span>
        </footer>
      </div>
    </div>
  )
}
