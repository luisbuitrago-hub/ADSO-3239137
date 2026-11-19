import type { IconName } from '../components/Icon'
import type { Role } from '../types/api'

export const modules: {
  path: string
  title: string
  description: string
  icon: IconName
  adminOnly?: boolean
}[] = [
  {
    path: '/articles',
    title: 'Artículos',
    description: 'Consulta el catálogo y conoce los utensilios de la comunidad.',
    icon: 'articles',
  },
  {
    path: '/neighbors',
    title: 'Vecinos',
    description: 'Encuentra a las personas que hacen parte de la comunidad.',
    icon: 'neighbors',
  },
  {
    path: '/loans',
    title: 'Préstamos y devoluciones',
    description: 'Gestiona la entrega y el regreso de cada utensilio.',
    icon: 'loans',
  },
  {
    path: '/overdue',
    title: 'Préstamos vencidos',
    description: 'Consulta los artículos pendientes de devolución.',
    icon: 'overdue',
  },
  {
    path: '/reports',
    title: 'Reportes',
    description: 'Consulta el historial de los artículos más solicitados.',
    icon: 'reports',
    adminOnly: true,
  },
  {
    path: '/users',
    title: 'Operadores',
    description: 'Administra el acceso de quienes gestionan los préstamos.',
    icon: 'users',
    adminOnly: true,
  },
]
export const roleName: Record<Role, string> = { admin: 'Administrador', operator: 'Operador' }
export const safeReturnPath = (value: unknown) =>
  typeof value === 'string' && ['/home', ...modules.map((module) => module.path)].includes(value)
    ? value
    : '/home'
