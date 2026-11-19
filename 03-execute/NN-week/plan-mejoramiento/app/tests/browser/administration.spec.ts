import { expect, test, type Page } from '@playwright/test'
import axe, { type AxeResults } from 'axe-core'
import { articleFixture, categoriesFixture, paginated } from '../catalog-fixtures'
import { loginPayload } from '../fixtures'
import { pngFixture } from './image-fixtures'

async function accessible(page: Page) {
  await page.addScriptTag({ content: axe.source })
  const violations = await page.evaluate(async () => {
    const browser = window as typeof window & {
      axe: { run: (root: Document, options: unknown) => Promise<AxeResults> }
    }
    return (
      await browser.axe.run(document, {
        runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] },
      })
    ).violations
  })
  expect(violations).toEqual([])
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  )
}
async function login(page: Page, path: string) {
  await page.goto(path)
  await page.getByLabel('Nombre de usuario', { exact: true }).fill('persona')
  await page.getByLabel('Contraseña', { exact: true }).fill(crypto.randomUUID())
  await page.getByRole('button', { name: 'Iniciar sesión' }).click()
}
async function mocks(page: Page, role: 'admin' | 'operator') {
  let key: string | null = 'initial'
  await page.route('**/api/v1/**', async (route) => {
    const path = new URL(route.request().url()).pathname.replace('/api/v1', '')
    const method = route.request().method()
    if (path === '/auth/login') return route.fulfill({ json: loginPayload(role) })
    if (path === '/categories') return route.fulfill({ json: categoriesFixture })
    if (path === '/articles')
      return route.fulfill({ json: paginated([{ ...articleFixture, cover_key: key }]) })
    if (path === `/articles/${articleFixture.id}`)
      return route.fulfill({ json: { ...articleFixture, cover_key: key } })
    if (path.endsWith('/cover')) {
      if (method === 'PUT') {
        key = crypto.randomUUID()
        expect(route.request().headers()['content-type']).toMatch(/multipart\/form-data; boundary=/)
        return route.fulfill({ json: { ...articleFixture, cover_key: key } })
      }
      if (method === 'DELETE') {
        key = null
        return route.fulfill({ status: 204 })
      }
      if (key) return route.fulfill({ contentType: 'image/png', body: pngFixture() })
      return route.fulfill({
        status: 404,
        json: { code: 'NOT_FOUND', message: 'Sin imagen.', details: [] },
      })
    }
    if (path === '/reports/most-borrowed')
      return route.fulfill({
        json: {
          from: '2026-11-01',
          to: '2026-11-30',
          rows: [
            {
              article_id: articleFixture.id,
              article_name: 'Olla histórica',
              category_name: 'ollas',
              times_borrowed: 3,
            },
          ],
        },
      })
    if (path === '/users')
      return route.fulfill({
        status: 201,
        json: { id: crypto.randomUUID(), username: 'nuevo_operador', role: 'operator' },
      })
    return route.fulfill({
      status: 404,
      json: { code: 'NOT_FOUND', message: 'No existe.', details: [] },
    })
  })
}
test('administrador gestiona imagen privada, reporte y operador', async ({ page }, info) => {
  await mocks(page, 'admin')
  await login(page, `/articles/${articleFixture.id}`)
  const image = page.getByRole('img', { name: 'Imagen de Olla comunitaria' })
  await expect(image).toBeVisible()
  await expect(image).toHaveAttribute('src', /^blob:/)
  expect(await image.evaluate((img: HTMLImageElement) => img.naturalWidth)).toBe(1)
  await page
    .getByLabel('Seleccionar imagen JPG o PNG')
    .setInputFiles({ name: 'cover.png', mimeType: 'image/png', buffer: pngFixture(120) })
  await accessible(page)
  await page.getByRole('button', { name: 'Reemplazar imagen' }).click()
  await expect(page.getByText('Imagen guardada correctamente.')).toBeVisible()
  await page.getByRole('button', { name: 'Eliminar imagen', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Confirmar eliminación de imagen' })).toBeFocused()
  await accessible(page)
  await page.getByRole('button', { name: 'Confirmar eliminación de imagen' }).click()
  await expect(page.getByText('Imagen eliminada correctamente.')).toBeVisible()
  await expect(page.getByText('Sin imagen disponible')).toBeVisible()
  if (info.project.name === 'mobile')
    await page.getByRole('button', { name: 'Abrir navegación' }).click()
  await page
    .getByRole('navigation', { name: 'Navegación principal' })
    .getByRole('link', { name: 'Reportes', exact: true })
    .click()
  await page.getByLabel('Fecha inicial (UTC)').fill('2026-11-01')
  await page.getByLabel('Fecha final (UTC)').fill('2026-11-30')
  await page.getByRole('button', { name: 'Consultar reporte' }).click()
  await expect(page.getByRole('table')).toContainText('Olla histórica')
  await accessible(page)
  await page.screenshot({ path: info.outputPath('report.png'), fullPage: true })
  if (info.project.name === 'mobile')
    await page.getByRole('button', { name: 'Abrir navegación' }).click()
  await page
    .getByRole('navigation', { name: 'Navegación principal' })
    .getByRole('link', { name: 'Operadores', exact: true })
    .click()
  await page.getByLabel('Nombre de usuario del operador').fill('nuevo_operador')
  await page.getByLabel('Contraseña del operador').fill(crypto.randomUUID())
  await accessible(page)
  await page.getByRole('button', { name: 'Registrar operador', exact: true }).click()
  await expect(page.getByText('Operador nuevo_operador registrado correctamente.')).toBeVisible()
  await expect(page.getByLabel('Contraseña del operador')).toHaveValue('')
})
test('operador ve imágenes y conserva restricciones de administración', async ({ page }, info) => {
  await mocks(page, 'operator')
  await login(page, '/articles')
  await expect(page.getByRole('img', { name: 'Imagen de Olla comunitaria' })).toBeVisible()
  await accessible(page)
  await page.getByRole('link', { name: 'Ver detalle de Olla comunitaria' }).click()
  await expect(page.getByRole('img', { name: 'Imagen de Olla comunitaria' })).toBeVisible()
  await expect(page.getByLabel('Seleccionar imagen JPG o PNG')).toHaveCount(0)
  if (info.project.name === 'mobile')
    await page.getByRole('button', { name: 'Abrir navegación' }).click()
  await expect(
    page
      .getByRole('navigation', { name: 'Navegación principal' })
      .getByRole('link', { name: 'Reportes', exact: true }),
  ).toHaveCount(0)
  await expect(
    page
      .getByRole('navigation', { name: 'Navegación principal' })
      .getByRole('link', { name: 'Operadores', exact: true }),
  ).toHaveCount(0)
})
