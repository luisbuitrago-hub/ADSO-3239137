import { expect, test } from '@playwright/test'

test('React y proxy Vite consumen Laravel real en un stack aislado', async ({ page, request }) => {
  const username = process.env.KITCHENWARE_TEST_USERNAME
  const password = process.env.KITCHENWARE_TEST_PASSWORD
  if (!username || !password || !process.env.KITCHENWARE_TEST_URL)
    throw new Error('Ejecutar mediante npm run test:api, no contra desarrollo.')
  const health = await request.get('/api/v1/health')
  expect(health.status()).toBe(200)
  expect(await health.json()).toEqual({ status: 'ok' })
  const preflight = await request.fetch('/api/v1/auth/login', {
    method: 'OPTIONS',
    headers: {
      Origin: 'http://localhost:5173',
      'Access-Control-Request-Method': 'POST',
      'Access-Control-Request-Headers': 'content-type',
    },
  })
  expect(preflight.status()).toBe(204)
  expect(preflight.headers()['access-control-allow-origin']).toBe('http://localhost:5173')
  const unauthorized = await request.get('/api/v1/categories')
  expect(unauthorized.status()).toBe(401)
  const invalid = await request.post('/api/v1/auth/login', { data: {} })
  expect(invalid.status()).toBe(422)
  await page.goto('/login')
  await page.getByLabel('Nombre de usuario').fill(username)
  await page.getByLabel('Contraseña', { exact: true }).fill(password)
  const result = page.waitForResponse(
    (response) =>
      response.url().endsWith('/api/v1/auth/login') && response.request().method() === 'POST',
  )
  await page.getByRole('button', { name: 'Iniciar sesión' }).click()
  const login = await result
  expect(login.status()).toBe(200)
  await expect(page.getByRole('heading', { name: 'Tu comunidad, en buenas manos.' })).toBeVisible()
  const payload = (await login.json()) as { access_token: string }
  // Usar el cliente real del frontend y el Bearer real, sin imprimirlos ni persistirlos.
  const count = await page.evaluate(async (token) => {
    const modulePath = '/src/services/http.ts'
    const { createHttpClient } = await import(/* @vite-ignore */ modulePath)
    const categories = (await createHttpClient({ getToken: () => token }).request(
      '/categories',
    )) as unknown[]
    return categories.length
  }, payload.access_token)
  expect(count).toBe(5)
  const operatorPassword = crypto.randomUUID()
  const created = await request.post('/api/v1/users', {
    headers: { Authorization: `Bearer ${payload.access_token}` },
    data: { username: 'frontend_operator', password: operatorPassword, role: 'operator' },
  })
  expect(created.status()).toBe(201)
  const operatorLogin = await request.post('/api/v1/auth/login', {
    data: { username: 'frontend_operator', password: operatorPassword },
  })
  expect(operatorLogin.status()).toBe(200)
  const operator = (await operatorLogin.json()) as { access_token: string }
  const denied = await page.evaluate(async (token) => {
    const modulePath = '/src/services/http.ts'
    const { createHttpClient } = await import(/* @vite-ignore */ modulePath)
    let cleared = false
    try {
      await createHttpClient({
        getToken: () => token,
        onUnauthorized: () => {
          cleared = true
        },
      }).request('/reports/most-borrowed?from=2026-01-01&to=2026-12-31')
      return { status: 200, code: '', cleared }
    } catch (error) {
      const failure = error as { status: number; code: string }
      return { status: failure.status, code: failure.code, cleared }
    }
  }, operator.access_token)
  expect(denied).toEqual({ status: 403, code: 'FORBIDDEN_ROLE', cleared: false })
  await page.getByRole('button', { name: 'Cerrar sesión' }).click()
  await expect(page.getByText('Cerraste sesión correctamente.')).toBeVisible()
})
