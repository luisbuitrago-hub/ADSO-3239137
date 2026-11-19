export type IconName =
  | 'kitchen'
  | 'home'
  | 'articles'
  | 'neighbors'
  | 'loans'
  | 'overdue'
  | 'reports'
  | 'users'
  | 'logout'
  | 'arrow'
  | 'lock'
  | 'menu'
const paths: Record<IconName, string> = {
  kitchen: 'M4 3v5a3 3 0 0 0 6 0V3M7 3v18M16 3v7a3 3 0 0 0 4 3V3h-4Zm4 10v8',
  home: 'm3 10 9-7 9 7M5 9v12h14V9M9 21v-8h6v8',
  articles: 'M3 10h18M5 10l2 10h10l2-10M8 6h8M10 3h4M2 10h20',
  neighbors:
    'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M16 4a4 4 0 0 1 0 8M22 21v-2a4 4 0 0 0-3-3.8M13 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0',
  loans: 'M8 3H5v18h14V3h-3M8 2h8v4H8zM8 11h8M8 15h5',
  overdue: 'M12 8v5l3 2M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0',
  reports: 'M4 3v18h17M9 17v-5M14 17V7M19 17v-8',
  users: 'M12 3 3 7v6c0 5 9 9 9 9s9-4 9-9V7l-9-4ZM8 12l3 3 5-6',
  logout: 'M9 3H4v18h5M9 12h12m-5-5 5 5-5 5',
  arrow: 'M4 12h16m-6-6 6 6-6 6',
  lock: 'M6 10h12v11H6zM8 10V6a4 4 0 0 1 8 0v4M12 14v3',
  menu: 'M4 6h16M4 12h16M4 18h16',
}
export function Icon({ name, className = '' }: { name: IconName; className?: string }) {
  return (
    <svg
      aria-hidden="true"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d={paths[name]} />
    </svg>
  )
}
