import { test, expect } from "@playwright/test";
import axe from "axe-core";

test("presentación independiente, navegación, recursos y accesibilidad", async ({
  page,
}, info) => {
  const failures = [];
  const requests = [];
  const consoleErrors = [];
  page.on("requestfailed", (request) => failures.push(request.url()));
  page.on("request", (request) => requests.push(request.url()));
  page.on("pageerror", (error) => consoleErrors.push(error.message));
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Compartir empiezaen la cocina.",
  );
  await expect(
    page.getByRole("heading", { name: "Un lugar para cada utensilio" }),
  ).toBeVisible();
  const application = page.getByRole("link", {
    name: "Acceder a la aplicación",
    exact: true,
    includeHidden: true,
  });
  await expect(application).toHaveCount(3);
  for (const link of await application.all())
    await expect(link).toHaveAttribute("href", "http://127.0.0.1:5173/login");
  expect(
    requests.every((url) => url.startsWith("http://127.0.0.1:4174/")),
  ).toBe(true);
  expect(requests.some((url) => url.includes("/api/"))).toBe(false);
  expect(failures).toEqual([]);
  expect(consoleErrors).toEqual([]);
  await expect(page.locator("img")).toHaveCount(3);
  for (const image of await page.locator("img").all())
    expect(
      await image.evaluate((img) => img.complete && img.naturalWidth > 0),
    ).toBe(true);
  // Evaluación de QA por DevTools; sin insertar scripts remotos ni alterar la CSP.
  await page.evaluate(axe.source);
  const violations = await page.evaluate(
    async () =>
      (
        await window.axe.run(document, {
          runOnly: {
            type: "tag",
            values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"],
          },
        })
      ).violations,
  );
  expect(violations).toEqual([]);
  await page.screenshot({
    path: info.outputPath("presentation.png"),
    fullPage: true,
  });
  if (info.project.name === "mobile")
    await page.getByRole("button", { name: "Menú", exact: true }).click();
  await page
    .getByRole("navigation", { name: "Navegación principal" })
    .getByRole("link", { name: "Cómo funciona" })
    .click();
  await expect(page).toHaveURL(/#how-it-works$/);
  await expect(page.locator("#how-it-works")).toBeFocused();
  await page
    .getByText("¿Quién utiliza la aplicación?", { exact: true })
    .click();
  await expect(
    page.getByText("Administradores y operadores autenticados.", {
      exact: false,
    }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  expect(
    await page.evaluate(() => ({
      local: localStorage.length,
      session: sessionStorage.length,
    })),
  ).toEqual({ local: 0, session: 0 });
});
test("teclado, foco y menú móvil", async ({ page }, info) => {
  await page.goto("/");
  await page.keyboard.press("Tab");
  await expect(
    page.getByRole("link", { name: "Saltar al contenido" }),
  ).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.locator("#main")).toBeFocused();
  if (info.project.name === "mobile") {
    const toggle = page.getByRole("button", { name: "Menú", exact: true });
    await toggle.focus();
    await page.keyboard.press("Enter");
    await expect(toggle).toHaveAttribute("aria-expanded", "true");
    await page.keyboard.press("Tab");
    await expect(
      page.getByRole("link", { name: "El proyecto", exact: true }),
    ).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(toggle).toBeFocused();
    await expect(toggle).toHaveAttribute("aria-expanded", "false");
    await expect(
      page.getByRole("navigation", { name: "Navegación principal" }),
    ).toBeHidden();
  }
});
test("movimiento reducido y ancho estrecho sin desbordamientos", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 320, height: 800 });
  await page.goto("/");
  expect(
    await page
      .locator(".hero-art > img")
      .evaluate((element) => getComputedStyle(element).animationName),
  ).toBe("none");
  expect(
    await page.evaluate(
      () => getComputedStyle(document.documentElement).scrollBehavior,
    ),
  ).toBe("auto");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});
test("contenido y navegación disponibles sin JavaScript", async ({
  browser,
}) => {
  const context = await browser.newContext({
    javaScriptEnabled: false,
    viewport: { width: 390, height: 844 },
  });
  const page = await context.newPage();
  await page.goto("http://127.0.0.1:4174/");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(
    page.getByRole("navigation", { name: "Navegación principal" }),
  ).toBeVisible();
  await page.getByRole("link", { name: "El proyecto", exact: true }).click();
  await expect(page).toHaveURL(/#project$/);
  await expect(
    page
      .getByRole("link", { name: "Acceder a la aplicación", exact: true })
      .first(),
  ).toHaveAttribute("href", "http://127.0.0.1:5173/login");
  await context.close();
});
