import { expect, test, type Page } from '@playwright/test'
import axe, { type AxeResults } from 'axe-core'
import { loginPayload } from '../fixtures'

async function accessibility(page: Page) {
  await page.addScriptTag({ content: axe.source })
  const results = await page.evaluate(async () => {
    const browser = window as typeof window & {
      axe: { run: (root: Document, options: unknown) => Promise<AxeResults> }
    }
    return browser.axe.run(document, {
      runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] },
    })
  })
  expect(results.violations).toEqual([])
}
let browserErrors: string[] = []
let resourceErrors: string[] = []
test.beforeEach(async ({ page }) => {
  browserErrors = []
  resourceErrors = []
  page.on('pageerror', (error) => browserErrors.push(error.message))
  page.on('console', (message) => {
    if (message.type() === 'error') resourceErrors.push(message.text())
  })
  page.on('response', (response) => {
    if (response.status() >= 400)
      resourceErrors.push(`${response.status()} ${new URL(response.url()).pathname}`)
  })
  await page.route('**/api/v1/auth/login', (route) => route.fulfill({ json: loginPayload() }))
})
test.afterEach(async ({ page }, info) => {
  if (info.status !== info.expectedStatus) {
    await info.attach('browser-startup', {
      body: JSON.stringify({
        browserErrors,
        resourceErrors,
        url: page.url(),
        body: await page.locator('body').innerText(),
      }),
      contentType: 'application/json',
    })
  }
  expect(browserErrors).toEqual([])
})
async function login(page: Page) {
  await page.getByLabel('Nombre de usuario').fill('admin')
  await page.getByLabel('Contraseña', { exact: true }).fill(crypto.randomUUID())
  await page.getByRole('button', { name: 'Iniciar sesión' }).click()
}

test('login accesible, responsive y operable con teclado', async ({ page }, info) => {
  await page.goto('/login')
  await expect(page.getByRole('heading', { name: 'Qué bueno tenerte aquí' })).toBeVisible()
  await accessibility(page)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  )
  await page.screenshot({ path: info.outputPath('login.png'), fullPage: true })
  await page.getByLabel('Nombre de usuario').focus()
  await page.keyboard.type('admin')
  await page.keyboard.press('Tab')
  await expect(page.getByLabel('Contraseña', { exact: true })).toBeFocused()
  await page.keyboard.type(crypto.randomUUID())
  await page.keyboard.press('Tab')
  await expect(page.getByRole('button', { name: 'Iniciar sesión' })).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(page.getByRole('heading', { name: 'Tu comunidad, en buenas manos.' })).toBeVisible()
})
test('administrador navega, cierra sesión y no persiste JWT', async ({ page }, info) => {
  await page.goto('/login')
  await login(page)
  await expect(page.getByRole('heading', { name: 'Tu comunidad, en buenas manos.' })).toBeVisible()
  await accessibility(page)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  )
  await page.screenshot({ path: info.outputPath('inicio.png'), fullPage: true })
  if (info.project.name === 'mobile') {
    await page.getByRole('button', { name: 'Abrir navegación' }).click()
    await expect(
      page.getByRole('navigation').getByRole('link', { name: 'Inicio', exact: true }),
    ).toBeFocused()
    await page.keyboard.press('Escape')
    await expect(page.getByRole('button', { name: 'Abrir navegación' })).toBeFocused()
    await page.getByRole('button', { name: 'Abrir navegación' }).click()
  }
  await page.getByRole('navigation').getByRole('link', { name: 'Reportes' }).click()
  await expect(page.getByRole('heading', { name: 'Reportes' })).toBeVisible()
  await expect(page.getByText('La navegación está lista.', { exact: false })).toBeVisible()
  await page.getByRole('button', { name: 'Cerrar sesión' }).click()
  await expect(page.getByRole('heading', { name: 'Qué bueno tenerte aquí' })).toBeVisible()
  expect(
    await page.evaluate(() => ({ local: localStorage.length, session: sessionStorage.length })),
  ).toEqual({ local: 0, session: 0 })
})
test('operador no accede por URL a administración y recargar elimina sesión', async ({ page }) => {
  await page.route('**/api/v1/auth/login', (route) =>
    route.fulfill({ json: loginPayload('operator') }),
  )
  await page.goto('/reports')
  await login(page)
  await expect(
    page.getByRole('heading', { name: 'Esta sección es para administradores' }),
  ).toBeVisible()
  await page.getByRole('link', { name: 'Volver al inicio' }).click()
  await expect(page.getByRole('heading', { name: 'Tu comunidad, en buenas manos.' })).toBeVisible()
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Qué bueno tenerte aquí' })).toBeVisible()
  await expect(page.getByLabel('Contraseña', { exact: true })).toHaveValue('')
})
