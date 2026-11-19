import { expect, test, type Page } from '@playwright/test'
import axe, { type AxeResults } from 'axe-core'
import { articleFixture, neighborFixture, paginated } from '../catalog-fixtures'
import { loanFixture, overdueFixture } from '../loan-fixtures'
import { loginPayload } from '../fixtures'

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
for (const role of ['admin', 'operator'] as const)
  test(`${role} registra, consulta, devuelve y navega por vencimientos`, async ({ page }, info) => {
    let created = false
    let returned = false
    let posts = 0
    let returns = 0
    await page.route('**/api/v1/**', async (route) => {
      const url = new URL(route.request().url())
      const path = url.pathname.replace('/api/v1', '')
      const method = route.request().method()
      if (path === '/auth/login') return route.fulfill({ json: loginPayload(role) })
      if (path === '/neighbors') return route.fulfill({ json: paginated([neighborFixture], 1, 10) })
      if (path === `/neighbors/${neighborFixture.id}`)
        return route.fulfill({
          json: { ...neighborFixture, active_loans: created && !returned ? 1 : 0 },
        })
      if (path === '/articles')
        return route.fulfill({
          json: paginated([{ ...articleFixture, available_units: 1 }], 1, 10),
        })
      if (path === `/articles/${articleFixture.id}`)
        return route.fulfill({
          json: { ...articleFixture, total_units: 1, available_units: returned ? 1 : 0 },
        })
      if (path === '/loans/overdue')
        return route.fulfill({
          json: { items: [{ ...overdueFixture, loan_id: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee' }] },
        })
      if (path === '/loans/eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee')
        return route.fulfill({
          json: {
            ...loanFixture,
            id: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
            status: 'overdue',
            items: [{ ...loanFixture.items[0], due_at: overdueFixture.due_at }],
          },
        })
      const loan = {
        ...loanFixture,
        status: returned ? 'closed' : 'open',
        items: [{ ...loanFixture.items[0], returned_at: returned ? '2026-11-20T12:00:00Z' : null }],
      }
      if (path === '/loans' && method === 'POST') {
        posts++
        created = true
        expect(route.request().postDataJSON()).toEqual({
          neighbor_id: neighborFixture.id,
          items: [{ article_id: articleFixture.id }],
        })
        return route.fulfill({ status: 201, json: loan })
      }
      if (path === '/loans')
        return route.fulfill({
          json: paginated(
            url.searchParams.get('status') === 'overdue' ? [] : created ? [loan] : [],
            1,
            Number(url.searchParams.get('size') || 20),
          ),
        })
      if (path.endsWith('/return')) {
        returns++
        returned = true
        expect(route.request().postData()).toBeNull()
        return route.fulfill({
          json: { ...loanFixture.items[0], returned_at: '2026-11-20T12:00:00Z' },
        })
      }
      if (path === `/loans/${loanFixture.id}`) return route.fulfill({ json: loan })
      return route.fulfill({
        status: 404,
        json: { code: 'NOT_FOUND', message: 'No existe.', details: [] },
      })
    })
    await page.goto('/loans/new')
    await page.getByLabel('Nombre de usuario').fill('persona')
    await page.getByLabel('Contraseña', { exact: true }).fill(crypto.randomUUID())
    await page.getByRole('button', { name: 'Iniciar sesión' }).click()
    await expect(page.getByRole('heading', { name: 'Registrar préstamo' })).toBeVisible()
    await page.getByRole('button', { name: 'Seleccionar a María Gómez' }).click()
    await expect(page.getByText(/Puede recibir hasta 3/)).toBeVisible()
    await page.getByRole('button', { name: 'Agregar Olla comunitaria' }).click()
    await accessible(page)
    await page.screenshot({ path: info.outputPath('loan-selection.png'), fullPage: true })
    await page.getByRole('button', { name: 'Revisar préstamo' }).click()
    await expect(page.getByRole('button', { name: 'Confirmar préstamo' })).toBeFocused()
    await accessible(page)
    await page.keyboard.press('Enter')
    await expect(page.getByText(/Préstamo registrado correctamente/)).toBeVisible()
    await expect(page.getByText(/Inventario actual: 0 de 1/)).toBeVisible()
    await accessible(page)
    await page.getByRole('button', { name: 'Devolver Olla histórica' }).click()
    await expect(page.getByRole('button', { name: 'Confirmar devolución' })).toBeFocused()
    await page.getByRole('button', { name: 'Cancelar', exact: true }).click()
    await expect(page.getByRole('button', { name: 'Devolver Olla histórica' })).toBeFocused()
    await page.getByRole('button', { name: 'Devolver Olla histórica' }).click()
    await accessible(page)
    await page.keyboard.press('Enter')
    await expect(page.getByText(/Devolución registrada correctamente/)).toBeVisible()
    await expect(page.getByText('Cerrado', { exact: true })).toBeVisible()
    await expect(page.getByText(/Inventario actual: 1 de 1/)).toBeVisible()
    await expect(page.getByRole('button', { name: 'Devolver Olla histórica' })).toHaveCount(0)
    await page.getByRole('link', { name: '← Volver a préstamos' }).click()
    await expect(page.getByRole('table')).toContainText('Cerrado')
    await accessible(page)
    if (info.project.name === 'mobile')
      await page.getByRole('button', { name: 'Abrir navegación' }).click()
    await page
      .getByRole('navigation', { name: 'Navegación principal' })
      .getByRole('link', { name: 'Préstamos vencidos', exact: true })
      .click()
    await expect(page.getByRole('table')).toContainText('María Gómez')
    await accessible(page)
    await page.getByRole('link', { name: 'Ver préstamo y devolver' }).click()
    await expect(page.getByRole('heading', { name: 'Detalle del préstamo' })).toBeVisible()
    expect(posts).toBe(1)
    expect(returns).toBe(1)
  })
