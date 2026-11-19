import { expect, test } from '@playwright/test'

test('operador presta y devuelve con inventario, historial y JWT reales en PostgreSQL aislado', async ({
  page,
  request,
}) => {
  const username = process.env.KITCHENWARE_TEST_USERNAME
  const password = process.env.KITCHENWARE_TEST_PASSWORD
  if (!username || !password || !process.env.KITCHENWARE_TEST_URL)
    throw new Error('Ejecutar exclusivamente mediante npm run test:api.')
  const login = await request.post('/api/v1/auth/login', { data: { username, password } })
  expect(login.status()).toBe(200)
  const admin = {
    Authorization: `Bearer ${((await login.json()) as { access_token: string }).access_token}`,
  }
  const suffix = crypto.randomUUID().slice(0, 8)
  const categories = await request.get('/api/v1/categories', { headers: admin })
  const category = ((await categories.json()) as { id: string }[])[0].id
  const articleResponse = await request.post('/api/v1/articles', {
    headers: admin,
    data: {
      name: 'Utensilio de integración 83',
      reference: `APP83-${suffix}`,
      description: 'Fixture exclusiva del stack temporal',
      category_id: category,
      total_units: 1,
    },
  })
  expect(articleResponse.status()).toBe(201)
  const article = (await articleResponse.json()) as { id: string }
  const neighborResponse = await request.post('/api/v1/neighbors', {
    headers: admin,
    data: { full_name: 'Vecino de integración 83', document_number: `APP83-${suffix}` },
  })
  expect(neighborResponse.status()).toBe(201)
  const neighbor = (await neighborResponse.json()) as { id: string }
  const operatorName = `loans_${suffix}`
  const operatorPassword = crypto.randomUUID()
  expect(
    (
      await request.post('/api/v1/users', {
        headers: admin,
        data: { username: operatorName, password: operatorPassword, role: 'operator' },
      })
    ).status(),
  ).toBe(201)
  await page.goto('/loans/new')
  await page.getByLabel('Nombre de usuario').fill(operatorName)
  await page.getByLabel('Contraseña', { exact: true }).fill(operatorPassword)
  const authentication = page.waitForResponse(
    (r) => r.url().endsWith('/auth/login') && r.request().method() === 'POST',
  )
  await page.getByRole('button', { name: 'Iniciar sesión' }).click()
  const operator = {
    Authorization: `Bearer ${((await (await authentication).json()) as { access_token: string }).access_token}`,
  }
  await page.getByLabel('Buscar vecino por nombre o documento').fill(`APP83-${suffix}`)
  await page.getByRole('button', { name: 'Buscar vecino', exact: true }).click()
  await page.getByRole('button', { name: 'Seleccionar a Vecino de integración 83' }).click()
  await expect(page.getByText(/Puede recibir hasta 3/)).toBeVisible()
  await page.getByRole('button', { name: 'Agregar Utensilio de integración 83' }).click()
  await page.getByRole('button', { name: 'Revisar préstamo' }).click()
  const creation = page.waitForResponse(
    (r) => new URL(r.url()).pathname === '/api/v1/loans' && r.request().method() === 'POST',
  )
  await page.getByRole('button', { name: 'Confirmar préstamo' }).click()
  const created = await creation
  expect(created.status()).toBe(201)
  const loan = (await created.json()) as {
    id: string
    loaned_at: string
    items: { id: string; due_at: string; article_name: string }[]
  }
  expect(Date.parse(loan.items[0].due_at) - Date.parse(loan.loaned_at)).toBe(3 * 86400000)
  await expect(page.getByText(/Inventario actual: 0 de 1/)).toBeVisible()
  await expect(page.getByText(/Artículos pendientes: 1/)).toBeVisible()
  const conflict = await request.post('/api/v1/loans', {
    headers: operator,
    data: { neighbor_id: neighbor.id, items: [{ article_id: article.id }] },
  })
  expect(conflict.status()).toBe(409)
  expect((await conflict.json()).code).toBe('ARTICLE_NOT_AVAILABLE')
  expect(
    (
      await request.put(`/api/v1/articles/${article.id}`, {
        headers: admin,
        data: {
          name: 'Nombre actual distinto 83',
          description: 'Cambio de catálogo aislado',
          category_id: category,
          total_units: 1,
        },
      })
    ).status(),
  ).toBe(200)
  await page.getByRole('button', { name: 'Actualizar préstamo e inventario' }).click()
  await expect(page.getByRole('heading', { name: 'Utensilio de integración 83' })).toBeVisible()
  await page.getByRole('button', { name: 'Devolver Utensilio de integración 83' }).click()
  await page.getByRole('button', { name: 'Confirmar devolución', exact: true }).click()
  await expect(page.getByText(/Devolución registrada correctamente/)).toBeVisible()
  await expect(page.getByText('Cerrado', { exact: true })).toBeVisible()
  await expect(page.getByText(/Inventario actual: 1 de 1/)).toBeVisible()
  await expect(page.getByText(/Artículos pendientes: 0/)).toBeVisible()
  const duplicate = await request.post(
    `/api/v1/loans/${loan.id}/items/${loan.items[0].id}/return`,
    { headers: operator },
  )
  expect(duplicate.status()).toBe(409)
  expect((await duplicate.json()).code).toBe('ITEM_ALREADY_RETURNED')
  const stock = await request.get(`/api/v1/articles/${article.id}`, { headers: operator })
  expect((await stock.json()).available_units).toBe(1)
  await page.getByRole('link', { name: '← Volver a préstamos' }).click()
  await expect(page.getByRole('table')).toContainText('Utensilio de integración 83')
  await expect(page.getByRole('table')).toContainText('Cerrado')
  const day = loan.loaned_at.slice(0, 10)
  const fromResult = page.waitForResponse(
    (r) =>
      new URL(r.url()).pathname === '/api/v1/loans' &&
      new URL(r.url()).searchParams.get('from') === day,
  )
  await page.getByLabel('Desde (UTC)').fill(day)
  await fromResult
  const inclusiveResult = page.waitForResponse(
    (r) =>
      new URL(r.url()).pathname === '/api/v1/loans' &&
      new URL(r.url()).searchParams.get('from') === day &&
      new URL(r.url()).searchParams.get('to') === day,
  )
  await page.getByLabel('Hasta (UTC)').fill(day)
  const filtered = (await (await inclusiveResult).json()) as { items: { id: string }[] }
  expect(filtered.items.some((item) => item.id === loan.id)).toBe(true)
  await expect(page.getByRole('table')).toContainText('Utensilio de integración 83')
  await page
    .getByRole('navigation', { name: 'Navegación principal' })
    .getByRole('link', { name: 'Préstamos vencidos', exact: true })
    .click()
  await expect(page.getByText('No hay artículos vencidos')).toBeVisible()
})
