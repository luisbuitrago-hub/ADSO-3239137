import { useEffect } from 'react'
import { Navigate, Outlet, Route, Routes, useLocation } from 'react-router'
import { useAuth } from './auth/context'
import { AppShell } from './components/AppShell'
import { HomePage } from './pages/HomePage'
import { LoginPage } from './pages/LoginPage'
import { NotFoundPage } from './pages/ModulePage'
import { modules } from './routes/navigation'
import { AccessDenied } from './components/DataViews'
import { CategoriesPage } from './pages/CategoriesPage'
import { ArticlesPage } from './pages/ArticlesPage'
import { ArticleDetailPage } from './pages/ArticleDetailPage'
import { ArticleFormPage } from './pages/ArticleFormPage'
import { NeighborsPage } from './pages/NeighborsPage'
import { NeighborDetailPage } from './pages/NeighborDetailPage'
import { NeighborFormPage } from './pages/NeighborFormPage'

import { LoansPage } from './pages/LoansPage'
import { LoanFormPage } from './pages/LoanFormPage'
import { LoanDetailPage } from './pages/LoanDetailPage'
import { OverduePage } from './pages/OverduePage'

import { ReportsPage } from './pages/ReportsPage'
import { OperatorsPage } from './pages/OperatorsPage'

function RequireAuth() {
  const { session } = useAuth()
  const location = useLocation()
  return session ? <Outlet /> : <Navigate to="/login" state={{ from: location.pathname }} replace />
}
function RequireAdmin() {
  const { session } = useAuth()
  return session?.role === 'admin' ? <Outlet /> : <AccessDenied />
}
function RouteFocus() {
  const { pathname } = useLocation()
  useEffect(() => {
    const title =
      pathname === '/login'
        ? 'Iniciar sesión'
        : pathname === '/home'
          ? 'Inicio'
          : modules.find(
              (module) => module.path === pathname || pathname.startsWith(module.path + '/'),
            )?.title || 'Página no encontrada'
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
            <Route path="/categories" element={<CategoriesPage />} />
            <Route path="/articles" element={<ArticlesPage />} />
            <Route path="/articles/:id" element={<ArticleDetailPage />} />
            <Route path="/loans" element={<LoansPage />} />
            <Route path="/loans/new" element={<LoanFormPage />} />
            <Route path="/loans/:id" element={<LoanDetailPage />} />
            <Route path="/overdue" element={<OverduePage />} />
            <Route path="/neighbors" element={<NeighborsPage />} />
            <Route path="/neighbors/new" element={<NeighborFormPage />} />
            <Route path="/neighbors/:id" element={<NeighborDetailPage />} />
            <Route element={<RequireAdmin />}>
              <Route path="/reports" element={<ReportsPage />} />
              <Route path="/users" element={<OperatorsPage />} />
              <Route path="/articles/new" element={<ArticleFormPage />} />
              <Route path="/articles/:id/edit" element={<ArticleFormPage />} />
            </Route>
          </Route>
        </Route>
        <Route path="/" element={<Navigate to="/home" replace />} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </>
  )
}
