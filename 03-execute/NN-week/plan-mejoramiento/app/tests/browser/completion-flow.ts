import { expect, type APIRequestContext, type Page } from '@playwright/test'
import { pngFixture, jpegFixture } from './image-fixtures'

export async function completionFlow(page: Page, request: APIRequestContext) {
  const username = process.env.KITCHENWARE_TEST_USERNAME
  const password = process.env.KITCHENWARE_TEST_PASSWORD
  if (!username || !password || !process.env.KITCHENWARE_TEST_URL)
    throw new Error('Ejecutar solo mediante los verificadores aislados.')
  const login = await request.post('/api/v1/auth/login', { data: { username, password } })
  expect(login.status()).toBe(200)
  const headers = {
    Authorization: `Bearer ${((await login.json()) as { access_token: string }).access_token}`,
  }
  const categories = (await (await request.get('/api/v1/categories', { headers })).json()) as {
    id: string
    name: string
  }[]
  const suffix = crypto.randomUUID().slice(0, 8)
  const articleResponse = await request.post('/api/v1/articles', {
    headers,
    data: {
      name: 'Artículo con imagen 84',
      reference: `IMG84-${suffix}`,
      description: 'Fixture aislada para portada privada',
      category_id: categories[0].id,
      total_units: 1,
    },
  })
  expect(articleResponse.status()).toBe(201)
  const article = (await articleResponse.json()) as { id: string }
  // Fixture histórica construida solamente por API HTTP dentro del proyecto aislado.
  const historicalResponse = await request.post('/api/v1/articles', {
    headers,
    data: {
      name: 'Histórico original 84',
      reference: `HIS84-${suffix}`,
      description: 'Historial aislado',
      category_id: categories[0].id,
      total_units: 1,
    },
  })
  expect(historicalResponse.status()).toBe(201)
  const historical = (await historicalResponse.json()) as { id: string }
  const neighborResponse = await request.post('/api/v1/neighbors', {
    headers,
    data: { full_name: 'Vecino reporte 84', document_number: `REP84-${suffix}` },
  })
  expect(neighborResponse.status()).toBe(201)
  const neighbor = (await neighborResponse.json()) as { id: string }
  const loanResponse = await request.post('/api/v1/loans', {
    headers,
    data: { neighbor_id: neighbor.id, items: [{ article_id: historical.id }] },
  })
  expect(loanResponse.status()).toBe(201)
  const loan = (await loanResponse.json()) as {
    id: string
    loaned_at: string
    items: { id: string }[]
  }
  expect(
    (
      await request.put(`/api/v1/articles/${historical.id}`, {
        headers,
        data: {
          name: 'Catálogo cambiado 84',
          description: 'Nombre actualizado',
          category_id: categories[1].id,
          total_units: 1,
        },
      })
    ).status(),
  ).toBe(200)
  expect(
    (
      await request.post(`/api/v1/loans/${loan.id}/items/${loan.items[0].id}/return`, { headers })
    ).status(),
  ).toBe(200)
  expect((await request.delete(`/api/v1/articles/${historical.id}`, { headers })).status()).toBe(
    204,
  )
  await page.goto(`/articles/${article.id}`)
  await page.getByLabel('Nombre de usuario', { exact: true }).fill(username)
  await page.getByLabel('Contraseña', { exact: true }).fill(password)
  await page.getByRole('button', { name: 'Iniciar sesión' }).click()
  await expect(page.getByText('Sin imagen disponible')).toBeVisible()
  await page
    .getByLabel('Seleccionar imagen JPG o PNG')
    .setInputFiles({ name: 'original.png', mimeType: 'image/png', buffer: pngFixture() })
  await page.getByRole('button', { name: 'Subir imagen', exact: true }).click()
  await expect(page.getByText('Imagen guardada correctamente.')).toBeVisible()
  const image = page.getByRole('img', { name: 'Imagen de Artículo con imagen 84' })
  await expect(image).toBeVisible()
  await expect(image).toHaveAttribute('src', /^blob:/)
  await expect.poll(() => image.evaluate((el: HTMLImageElement) => el.naturalWidth)).toBe(1)
  const firstCover = (await (
    await request.get(`/api/v1/articles/${article.id}`, { headers })
  ).json()) as { cover_key: string }
  await page
    .getByLabel('Seleccionar imagen JPG o PNG')
    .setInputFiles({ name: 'replacement.jpg', mimeType: 'image/jpeg', buffer: jpegFixture() })
  await page.getByRole('button', { name: 'Reemplazar imagen', exact: true }).click()
  await expect(page.getByText('Imagen guardada correctamente.')).toBeVisible()
  const secondCover = (await (
    await request.get(`/api/v1/articles/${article.id}`, { headers })
  ).json()) as { cover_key: string }
  expect(secondCover.cover_key).not.toBe(firstCover.cover_key)
  const jpeg = await request.get(`/api/v1/articles/${article.id}/cover`, { headers })
  expect(jpeg.status()).toBe(200)
  expect(jpeg.headers()['content-type']).toContain('image/jpeg')
  const invalid = await request.put(`/api/v1/articles/${article.id}/cover`, {
    headers,
    multipart: {
      file: { name: 'fake.png', mimeType: 'image/png', buffer: Buffer.from('no es una imagen') },
    },
  })
  expect(invalid.status()).toBe(422)
  expect((await request.get(`/api/v1/articles/${article.id}/cover`)).status()).toBe(401)
  await page.getByRole('button', { name: 'Eliminar imagen', exact: true }).click()
  await page.getByRole('button', { name: 'Confirmar eliminación de imagen' }).click()
  await expect(page.getByText('Imagen eliminada correctamente.')).toBeVisible()
  expect((await request.get(`/api/v1/articles/${article.id}/cover`, { headers })).status()).toBe(
    404,
  )
  // Conservar una imagen para comprobar lectura de operador después del cambio de sesión.
  await page
    .getByLabel('Seleccionar imagen JPG o PNG')
    .setInputFiles({ name: 'operator.png', mimeType: 'image/png', buffer: pngFixture(60) })
  await page.getByRole('button', { name: 'Subir imagen', exact: true }).click()
  await expect(page.getByRole('img', { name: 'Imagen de Artículo con imagen 84' })).toBeVisible()
  await page
    .getByRole('navigation', { name: 'Navegación principal' })
    .getByRole('link', { name: 'Reportes', exact: true })
    .click()
  const day = loan.loaned_at.slice(0, 10)
  await page.getByLabel('Fecha inicial (UTC)').fill(day)
  await page.getByLabel('Fecha final (UTC)').fill(day)
  await page.getByRole('button', { name: 'Consultar reporte' }).click()
  const row = page
    .getByRole('row')
    .filter({ has: page.getByRole('rowheader', { name: 'Histórico original 84', exact: true }) })
  await expect(row).toContainText(categories[0].name)
  await expect(row.getByRole('cell').last()).toHaveText('1')
  await expect(page.getByRole('table')).not.toContainText('Catálogo cambiado 84')
  await page
    .getByRole('navigation', { name: 'Navegación principal' })
    .getByRole('link', { name: 'Operadores', exact: true })
    .click()
  const operatorName = `ui84_${suffix}`
  const operatorPassword = crypto.randomUUID()
  await page.getByLabel('Nombre de usuario del operador').fill(operatorName)
  await page.getByLabel('Contraseña del operador').fill(operatorPassword)
  await page.getByRole('button', { name: 'Registrar operador', exact: true }).click()
  await expect(page.getByText(`Operador ${operatorName} registrado correctamente.`)).toBeVisible()
  await expect(page.getByLabel('Contraseña del operador')).toHaveValue('')
  await page.getByLabel('Nombre de usuario del operador').fill(operatorName)
  await page.getByLabel('Contraseña del operador').fill(crypto.randomUUID())
  await page.getByRole('button', { name: 'Registrar operador', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('ya está registrado')
  await expect(page.getByLabel('Contraseña del operador')).toHaveValue('')
  await page.getByRole('button', { name: 'Cerrar sesión' }).click()
  await page.getByLabel('Nombre de usuario', { exact: true }).fill(operatorName)
  await page.getByLabel('Contraseña', { exact: true }).fill(operatorPassword)
  const authentication = page.waitForResponse(
    (r) => r.url().endsWith('/auth/login') && r.request().method() === 'POST',
  )
  await page.getByRole('button', { name: 'Iniciar sesión' }).click()
  const opHeaders = {
    Authorization: `Bearer ${((await (await authentication).json()) as { access_token: string }).access_token}`,
  }
  // Navegación SPA, conservando el JWT solo en memoria.
  await page
    .getByRole('navigation', { name: 'Navegación principal' })
    .getByRole('link', { name: 'Artículos', exact: true })
    .click()
  await page.getByRole('link', { name: 'Ver detalle de Artículo con imagen 84' }).click()
  await expect(page.getByRole('img', { name: 'Imagen de Artículo con imagen 84' })).toBeVisible()
  await expect(page.getByLabel('Seleccionar imagen JPG o PNG')).toHaveCount(0)
  expect(
    (await request.delete(`/api/v1/articles/${article.id}/cover`, { headers: opHeaders })).status(),
  ).toBe(403)
  expect(
    (
      await request.get(`/api/v1/reports/most-borrowed?from=${day}&to=${day}`, {
        headers: opHeaders,
      })
    ).status(),
  ).toBe(403)
  expect(
    (
      await request.post('/api/v1/users', {
        headers: opHeaders,
        data: { username: 'forbidden', password: crypto.randomUUID(), role: 'operator' },
      })
    ).status(),
  ).toBe(403)
}
