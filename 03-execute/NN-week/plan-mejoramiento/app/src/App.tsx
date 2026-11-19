import { useEffect } from 'react'
import { Navigate, Outlet, Route, Routes, useLocation } from 'react-router'
import { useAuth } from './auth/context'
import { AppShell } from './components/AppShell'
import { HomePage } from './pages/HomePage'
import { LoginPage } from './pages/LoginPage'
import { ModulePage, NotFoundPage } from './pages/ModulePage'
import { modules } from './routes/navigation'

function RequireAuth() {
  const { session } = useAuth()
  const location = useLocation()
  return session ? <Outlet /> : <Navigate to="/login" state={{ from: location.pathname }} replace />
}
function RouteFocus() {
  const { pathname } = useLocation()
  useEffect(() => {
    const title =
      pathname === '/login'
        ? 'Iniciar sesión'
        : pathname === '/home'
          ? 'Inicio'
          : modules.find((module) => module.path === pathname)?.title || 'Página no encontrada'
    document.title = `${title} · Kitchenware`
    document.getElementById('main-content')?.focus()
  }, [pathname])
  return null
}
export function App() {
  return (
    <>
      <a className="skip-link" href="#main-content">
        Saltar al contenido
      </a>
      <RouteFocus />
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route element={<RequireAuth />}>
          <Route element={<AppShell />}>
            <Route path="/home" element={<HomePage />} />
            {modules.map((module) => (
              <Route path={module.path} element={<ModulePage />} key={module.path} />
            ))}
          </Route>
        </Route>
        <Route path="/" element={<Navigate to="/home" replace />} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </>
  )
}
