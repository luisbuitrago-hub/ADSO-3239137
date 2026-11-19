import { expect, test } from '@playwright/test'

test('catálogo y vecinos funcionan por UI con Laravel y PostgreSQL aislados', async ({
  page,
  request,
}) => {
  const username = process.env.KITCHENWARE_TEST_USERNAME
  const password = process.env.KITCHENWARE_TEST_PASSWORD
  if (!username || !password || !process.env.KITCHENWARE_TEST_URL)
    throw new Error('Ejecutar solo con npm run test:api.')
  await page.goto('/articles')
  await page.getByLabel('Nombre de usuario').fill(username)
  await page.getByLabel('Contraseña', { exact: true }).fill(password)
  const authentication = page.waitForResponse(
    (result) => result.url().endsWith('/auth/login') && result.request().method() === 'POST',
  )
  await page.getByRole('button', { name: 'Iniciar sesión' }).click()
  const token = ((await (await authentication).json()) as { access_token: string }).access_token
  await expect(page.getByText('No encontramos artículos')).toBeVisible()
  await page.getByRole('link', { name: 'Registrar artículo', exact: true }).click()
  await page.getByLabel('Nombre', { exact: true }).fill('Olla de integración 82')
  await page.getByLabel('Referencia').fill(`APP82-${crypto.randomUUID().slice(0, 8)}`)
  await page.getByLabel('Categoría', { exact: true }).selectOption({ label: 'ollas' })
  await page.getByLabel('Unidades totales').fill('4')
  await page.getByLabel('Descripción').fill('Prueba aislada desde React')
  await page.getByRole('button', { name: 'Registrar artículo', exact: true }).click()
  await expect(page.getByText('Artículo registrado correctamente.')).toBeVisible()
  const id = page.url().split('/').at(-1)!
  await page.getByRole('link', { name: 'Editar artículo' }).click()
  await page.getByLabel('Nombre', { exact: true }).fill('Olla actualizada 82')
  await page.getByLabel('Unidades totales').fill('5')
  await page.getByRole('button', { name: 'Guardar cambios' }).click()
  await expect(page.getByRole('heading', { name: 'Olla actualizada 82' })).toBeVisible()
  await expect(
    page
      .locator('dl div')
      .filter({ has: page.getByText('Unidades disponibles', { exact: true }) })
      .locator('dd'),
  ).toHaveText('5')
  await page.getByRole('link', { name: '← Volver al catálogo' }).click()
  await page.getByLabel('Buscar por nombre o descripción').fill('Olla actualizada 82')
  await page.getByRole('button', { name: 'Buscar', exact: true }).click()
  await expect(page.getByRole('table')).toContainText('Olla actualizada 82')
  await page.getByRole('link', { name: 'Ver detalle de Olla actualizada 82' }).click()
  await page.getByRole('button', { name: 'Desactivar artículo' }).click()
  await page.getByRole('button', { name: 'Confirmar desactivación' }).click()
  await expect(
    page.getByText('Artículo desactivado correctamente. Su historial se conserva.'),
  ).toBeVisible()
  expect(
    (
      await request.get(`/api/v1/articles/${id}`, { headers: { Authorization: `Bearer ${token}` } })
    ).status(),
  ).toBe(404)
  const operatorPassword = crypto.randomUUID()
  expect(
    (
      await request.post('/api/v1/users', {
        headers: { Authorization: `Bearer ${token}` },
        data: { username: 'catalog_operator', password: operatorPassword, role: 'operator' },
      })
    ).status(),
  ).toBe(201)
  await page.getByRole('button', { name: 'Cerrar sesión' }).click()
  await page.getByLabel('Nombre de usuario').fill('catalog_operator')
  await page.getByLabel('Contraseña', { exact: true }).fill(operatorPassword)
  await page.getByRole('button', { name: 'Iniciar sesión' }).click()
  await page
    .getByRole('navigation', { name: 'Navegación principal' })
    .getByRole('link', { name: 'Vecinos', exact: true })
    .click()
  await page.getByRole('link', { name: 'Registrar vecino' }).click()
  const document = `00-APP82-${crypto.randomUUID().slice(0, 8)}`
  await page.getByLabel('Nombre completo').fill('Vecina de integración 82')
  await page.getByLabel('Documento de identidad').fill(document)
  await page.getByRole('button', { name: 'Registrar vecino' }).click()
  await expect(page.getByText('Vecino registrado correctamente.')).toBeVisible()
  await expect(
    page
      .locator('dl div')
      .filter({ has: page.getByText('Artículos pendientes de devolución', { exact: true }) })
      .locator('dd'),
  ).toHaveText('0')
  await page.getByRole('link', { name: '← Volver a vecinos' }).click()
  await page.getByLabel('Buscar por nombre o documento').fill(document)
  await page.getByRole('button', { name: 'Buscar', exact: true }).click()
  await expect(page.getByRole('table')).toContainText(document)
})
