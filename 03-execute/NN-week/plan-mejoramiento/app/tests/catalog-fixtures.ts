import type { Article, Category, NeighborDetail } from '../src/types/catalog'

export const categoriesFixture: Category[] = [
  { id: '33333333-3333-4333-8333-333333333333', name: 'cubiertos' },
  { id: '44444444-4444-4444-8444-444444444444', name: 'hornillas' },
  { id: '55555555-5555-4555-8555-555555555555', name: 'manteles' },
  { id: '11111111-1111-4111-8111-111111111111', name: 'ollas' },
  { id: '22222222-2222-4222-8222-222222222222', name: 'vajilla' },
]
export const articleFixture: Article = {
  id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  name: 'Olla comunitaria',
  description: 'Para preparar alimentos en el salón',
  reference: 'OLL-001',
  category: categoriesFixture[3],
  total_units: 5,
  available_units: 3,
  cover_key: null,
}
export const neighborFixture: NeighborDetail = {
  id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  full_name: 'María Gómez',
  document_number: '001-AB',
  active_loans: 2,
}
export const paginated = <T>(items: T[], page = 1, size = 20, total = items.length) => ({
  items,
  page,
  size,
  total,
})
