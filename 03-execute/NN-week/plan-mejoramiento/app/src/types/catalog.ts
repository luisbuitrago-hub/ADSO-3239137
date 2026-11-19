export interface Category {
  id: string
  name: string
}
export interface Article {
  id: string
  name: string
  description: string
  reference: string
  category: Category
  total_units: number
  available_units: number
  cover_key: string | null
}
export interface ArticleInput {
  name: string
  description: string
  reference: string
  category_id: string
  total_units: number
}
export type ArticleUpdate = Omit<ArticleInput, 'reference'>
export interface Neighbor {
  id: string
  full_name: string
  document_number: string
}
export interface NeighborDetail extends Neighbor {
  active_loans: number
}
export interface NeighborInput {
  full_name: string
  document_number: string
}
export interface PageResult<T> {
  items: T[]
  page: number
  size: number
  total: number
}
