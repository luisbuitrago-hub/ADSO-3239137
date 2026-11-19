import type { PageResult } from './catalog'

export type LoanStatus = 'open' | 'overdue' | 'closed'
export interface LoanItem {
  id: string
  article_id: string
  article_name: string
  article_reference: string
  category_name: string
  due_at: string
  returned_at: string | null
}
export interface Loan {
  id: string
  neighbor_id: string
  loaned_at: string
  status: LoanStatus
  items: LoanItem[]
}
export interface LoanInput {
  neighbor_id: string
  items: { article_id: string }[]
}
export interface LoanFilters {
  neighbor_id?: string
  status?: string
  from?: string
  to?: string
  page: number
  size: number
}
export interface OverdueItem {
  loan_id: string
  item_id: string
  article_name: string
  neighbor_name: string
  due_at: string
  days_late: number
}
export type LoanPage = PageResult<Loan>
