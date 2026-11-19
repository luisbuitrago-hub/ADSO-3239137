import { test, expect } from "@playwright/test";

test("el acceso abre el login real de React sin consumir la API", async ({
  page,
}, info) => {
  if (!process.env.PAGE_TEST_URL || !process.env.PAGE_TEST_APP_URL)
    throw new Error(
      "Ejecutar mediante npm run test:integration, con servidores aislados.",
    );
  const apiRequests = [];
  await page.route("**/api/v1/**", (route) => {
    apiRequests.push(route.request().url());
    return route.abort();
  });
  await page.goto("/");
  if (info.project.name === "mobile")
    await page.getByRole("button", { name: "Menú", exact: true }).click();
  await page
    .getByRole("navigation", { name: "Navegación principal" })
    .getByRole("link", { name: "Acceder a la aplicación", exact: true })
    .click();
  await expect(page).toHaveURL(process.env.PAGE_TEST_APP_URL);
  await expect(
    page.getByRole("heading", { name: "Qué bueno tenerte aquí" }),
  ).toBeVisible();
  await expect(
    page.getByLabel("Nombre de usuario", { exact: true }),
  ).toBeVisible();
  await expect(page.getByLabel("Contraseña", { exact: true })).toBeVisible();
  expect(apiRequests).toEqual([]);
  expect(
    await page.evaluate(() => ({
      local: localStorage.length,
      session: sessionStorage.length,
    })),
  ).toEqual({ local: 0, session: 0 });
});
