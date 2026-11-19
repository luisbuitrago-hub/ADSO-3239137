import type { Loan } from '../src/types/loans'
import { articleFixture, neighborFixture } from './catalog-fixtures'

export const loanFixture: Loan = {
  id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
  neighbor_id: neighborFixture.id,
  loaned_at: '2026-11-19T12:00:00Z',
  status: 'open',
  items: [
    {
      id: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
      article_id: articleFixture.id,
      article_name: 'Olla histórica',
      article_reference: 'HIST-001',
      category_name: 'ollas históricas',
      due_at: '2026-11-22T12:00:00Z',
      returned_at: null,
    },
  ],
}
export const overdueFixture = {
  loan_id: loanFixture.id,
  item_id: loanFixture.items[0].id,
  article_name: loanFixture.items[0].article_name,
  neighbor_name: neighborFixture.full_name,
  due_at: '2026-11-12T12:00:00Z',
  days_late: 7,
}
