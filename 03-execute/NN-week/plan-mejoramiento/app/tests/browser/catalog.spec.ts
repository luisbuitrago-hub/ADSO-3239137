import { expect, test, type Page } from '@playwright/test'
import axe, { type AxeResults } from 'axe-core'
import { articleFixture, categoriesFixture, neighborFixture, paginated } from '../catalog-fixtures'
import { loginPayload } from '../fixtures'
import type { Article, ArticleInput, NeighborDetail } from '../../src/types/catalog'

async function checkAccessibility(page: Page) {
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
async function mocks(page: Page, role: 'admin' | 'operator') {
  let articles: Article[] = [{ ...articleFixture }]
  const neighbors: NeighborDetail[] = [{ ...neighborFixture }]
  await page.route('**/api/v1/**', async (route) => {
    const url = new URL(route.request().url())
    const path = url.pathname.replace('/api/v1', '')
    const method = route.request().method()
    if (path === '/auth/login') return route.fulfill({ json: loginPayload(role) })
    if (path === '/categories') return route.fulfill({ json: categoriesFixture })
    if (path === '/articles' && method === 'POST') {
      const input = route.request().postDataJSON() as ArticleInput
      const created = {
        id: crypto.randomUUID(),
        ...input,
        category: categoriesFixture.find((category) => category.id === input.category_id)!,
        available_units: input.total_units,
        cover_key: null,
      }
      articles.push(created)
      return route.fulfill({ status: 201, json: created })
    }
    if (path === '/articles') {
      const query = (url.searchParams.get('q') || '').toLowerCase()
      const items = articles.filter(
        (article) =>
          (article.name + article.description).toLowerCase().includes(query) &&
          (!url.searchParams.get('category_id') ||
            article.category.id === url.searchParams.get('category_id')),
      )
      return route.fulfill({
        json: paginated(items, 1, Number(url.searchParams.get('size') || 20)),
      })
    }
    if (path.startsWith('/articles/')) {
      const item = articles.find((article) => path === `/articles/${article.id}`)
      if (item && method === 'DELETE') {
        articles = articles.filter((article) => article.id !== item.id)
        return route.fulfill({ status: 204 })
      }
      if (item && method === 'PUT') {
        const input = route.request().postDataJSON() as Omit<ArticleInput, 'reference'>
        const borrowed = item.total_units - item.available_units
        Object.assign(item, input, {
          category: categoriesFixture.find((category) => category.id === input.category_id),
          available_units: input.total_units - borrowed,
        })
      }
      if (item) return route.fulfill({ json: item })
    }
    if (path === '/neighbors' && method === 'POST') {
      const input = route.request().postDataJSON() as { full_name: string; document_number: string }
      if (neighbors.some((neighbor) => neighbor.document_number === input.document_number.trim()))
        return route.fulfill({
          status: 409,
          json: {
            code: 'DOCUMENT_TAKEN',
            message: 'El documento ya está registrado.',
            details: [],
          },
        })
      const created = { id: crypto.randomUUID(), ...input, active_loans: 0 }
      neighbors.push(created)
      return route.fulfill({
        status: 201,
        json: {
          id: created.id,
          full_name: created.full_name,
          document_number: created.document_number,
        },
      })
    }
    if (path === '/neighbors') {
      const query = (url.searchParams.get('q') || '').toLowerCase()
      const items = neighbors
        .filter((neighbor) =>
          (neighbor.full_name + neighbor.document_number).toLowerCase().includes(query),
        )
        .map(({ id, full_name, document_number }) => ({ id, full_name, document_number }))
      return route.fulfill({ json: paginated(items) })
    }
    const neighbor = neighbors.find((neighbor) => path === `/neighbors/${neighbor.id}`)
    if (neighbor) return route.fulfill({ json: neighbor })
    return route.fulfill({
      status: 404,
      json: { code: 'NOT_FOUND', message: 'El registro no existe.', details: [] },
    })
  })
}
async function login(page: Page, path: string) {
  await page.goto(path)
  await page.getByLabel('Nombre de usuario').fill('persona')
  await page.getByLabel('Contraseña', { exact: true }).fill(crypto.randomUUID())
  await page.getByRole('button', { name: 'Iniciar sesión' }).click()
}

test('administrador consulta categorías y realiza el ciclo de catálogo', async ({ page }, info) => {
  await mocks(page, 'admin')
  await login(page, '/categories')
  await expect(page.getByRole('heading', { name: 'ollas' })).toBeVisible()
  await checkAccessibility(page)
  await page.getByRole('link', { name: /ollas Consultar artículos/ }).click()
  await expect(page.getByRole('table')).toContainText('Olla comunitaria')
  await checkAccessibility(page)
  await page.screenshot({ path: info.outputPath('catalog.png'), fullPage: true })
  await page.getByLabel('Buscar por nombre o descripción').fill('sin coincidencias')
  await page.getByRole('button', { name: 'Buscar', exact: true }).click()
  await expect(page.getByText('No encontramos artículos')).toBeVisible()
  await page.getByRole('button', { name: 'Limpiar filtros' }).click()
  await page.getByRole('link', { name: 'Registrar artículo', exact: true }).click()
  await page.getByLabel('Nombre', { exact: true }).fill('Termo de pruebas')
  await page.getByLabel('Referencia').fill('TER-82')
  await page.getByLabel('Categoría', { exact: true }).selectOption(articleFixture.category.id)
  await page.getByLabel('Unidades totales').fill('4')
  await page.getByLabel('Descripción').fill('Termo comunitario de pruebas')
  await checkAccessibility(page)
  await page.getByRole('button', { name: 'Registrar artículo', exact: true }).click()
  await expect(page.getByText('Artículo registrado correctamente.')).toBeVisible()
  await page.getByRole('link', { name: 'Editar artículo' }).click()
  await expect(page.getByLabel('Referencia')).toHaveAttribute('readonly', '')
  await page.getByLabel('Nombre', { exact: true }).fill('Termo actualizado')
  await page.getByLabel('Unidades totales').fill('5')
  await page.getByRole('button', { name: 'Guardar cambios' }).click()
  await expect(page.getByRole('heading', { name: 'Termo actualizado' })).toBeVisible()
  await page.getByRole('button', { name: 'Desactivar artículo' }).click()
  await expect(page.getByRole('button', { name: 'Confirmar desactivación' })).toBeFocused()
  await page.getByRole('button', { name: 'Cancelar', exact: true }).click()
  await page.getByRole('button', { name: 'Desactivar artículo' }).click()
  await page.getByRole('button', { name: 'Confirmar desactivación' }).click()
  await expect(
    page.getByText('Artículo desactivado correctamente. Su historial se conserva.'),
  ).toBeVisible()
  await expect(page.getByRole('table')).not.toContainText('Termo actualizado')
})
test('operador busca, consulta y registra vecinos sin acciones de administración', async ({
  page,
}, info) => {
  await mocks(page, 'operator')
  await login(page, '/articles')
  await expect(page.getByRole('table')).toBeVisible()
  await expect(page.getByRole('link', { name: 'Registrar artículo' })).toHaveCount(0)
  await page.getByRole('link', { name: 'Ver detalle de Olla comunitaria' }).click()
  await expect(page.getByRole('button', { name: 'Desactivar artículo' })).toHaveCount(0)
  await page
    .getByRole('link', { name: 'Editar artículo' })
    .count()
    .then((count) => expect(count).toBe(0))
  await page.getByRole('link', { name: '← Volver al catálogo' }).click()
  await page.getByRole('link', { name: 'Categorías', exact: true }).last().click()
  await expect(page.getByRole('heading', { name: 'Categorías' })).toBeVisible()
  if (info.project.name === 'mobile')
    await page.getByRole('button', { name: 'Abrir navegación' }).click()
  await page
    .getByRole('navigation', { name: 'Navegación principal' })
    .getByRole('link', { name: 'Vecinos', exact: true })
    .click()
  await page.getByLabel('Buscar por nombre o documento').fill('001-AB')
  await page.getByRole('button', { name: 'Buscar', exact: true }).click()
  await expect(page.getByRole('table')).toContainText('001-AB')
  await page.getByRole('link', { name: 'Ver detalle de María Gómez' }).click()
  await expect(page.getByText('Artículos pendientes de devolución')).toBeVisible()
  await page.getByRole('link', { name: '← Volver a vecinos' }).click()
  await page.getByRole('link', { name: 'Registrar vecino' }).click()
  await page.getByLabel('Nombre completo').fill('Ana de pruebas')
  await page.getByLabel('Documento de identidad').fill('001-AB')
  await page.getByRole('button', { name: 'Registrar vecino' }).click()
  await expect(page.getByRole('alert')).toContainText('El documento ya está registrado.')
  await page.getByLabel('Documento de identidad').fill('00-NUEVO')
  await checkAccessibility(page)
  await page.getByRole('button', { name: 'Registrar vecino' }).click()
  await expect(page.getByText('Vecino registrado correctamente.')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Ana de pruebas' })).toBeVisible()
  await checkAccessibility(page)
})
