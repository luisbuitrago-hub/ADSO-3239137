import { expect, test } from '@playwright/test'
import { completionFlow } from './completion-flow'
test('React compilado y proxy Nginx integran Laravel/PostgreSQL sin Vite', async ({
  page,
  request,
}) => {
  const deep = await request.get('/loans/new')
  expect(deep.status()).toBe(200)
  expect(deep.headers()['content-type']).toContain('text/html')
  const health = await request.get('/api/v1/health')
  expect(health.status()).toBe(200)
  expect(await health.json()).toEqual({ status: 'ok' })
  const denied = await request.get('/api/v1/articles')
  expect(denied.status()).toBe(401)
  expect(denied.headers()['content-type']).toContain('application/json')
  for (const path of ['/api/v1', '/api/v1/not-existing']) {
    const missing = await request.get(path)
    expect(missing.status()).toBe(404)
    expect(missing.headers()['content-type']).toContain('application/json')
  }
  const missingAsset = await request.get('/assets/not-existing.js')
  expect(missingAsset.status()).toBe(404)
  await completionFlow(page, request)
})
