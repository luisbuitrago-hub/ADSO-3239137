import test from "node:test";
import assert from "node:assert/strict";
import {
  applicationUrl,
  validateApplicationUrl,
  htmlAttribute,
} from "../scripts/config.mjs";

test("destino local corresponde al puerto y ruta de app revisados", () => {
  assert.equal(applicationUrl({}), "http://127.0.0.1:5173/login");
  assert.equal(
    applicationUrl({ KITCHENWARE_APP_PORT: "6123" }),
    "http://127.0.0.1:6123/login",
  );
});
test("Codespaces deriva el origen de su entorno sin dominio de despliegue fijo", () => {
  assert.equal(
    applicationUrl({
      CODESPACE_NAME: "example-space",
      GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN: "app.github.dev",
    }),
    "https://example-space-5173.app.github.dev/login",
  );
  assert.equal(
    applicationUrl({
      CODESPACE_NAME: "example-space",
      KITCHENWARE_APP_PORT: "6001",
      GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN: "forward.example.invalid",
    }),
    "https://example-space-6001.forward.example.invalid/login",
  );
});
test("destino explícito prevalece y admite ruta del mismo origen", () => {
  assert.equal(
    applicationUrl({
      KITCHENWARE_APP_URL: "https://app.example.invalid/login",
      CODESPACE_NAME: "ignored",
    }),
    "https://app.example.invalid/login",
  );
  assert.equal(validateApplicationUrl("/login"), "/login");
});
test("rechaza esquemas ejecutables, credenciales y parámetros que podrían publicar tokens", () => {
  for (const value of [
    "javascript:alert(1)",
    "data:text/html,example",
    "//example.invalid/login",
    "https://user:example@example.invalid",
    "https://example.invalid/login?token=example",
    "https://example.invalid/#example",
    " /login",
    "/\\example.invalid",
    "/login?secret=example",
    "not-a-url",
  ])
    assert.throws(() => validateApplicationUrl(value));
});
test("configuración inválida no revela el valor recibido en el error", () => {
  const marker = "example-sensitive-marker";
  assert.throws(
    () => validateApplicationUrl(marker),
    (error) => !error.message.includes(marker),
  );
  for (const port of ["0", "65536", "5173/path", "-1"])
    assert.throws(() => applicationUrl({ KITCHENWARE_APP_PORT: port }));
  assert.throws(() => applicationUrl({ CODESPACE_NAME: "bad/name" }));
});
test("codifica caracteres especiales al insertar atributos HTML", () => {
  assert.equal(htmlAttribute("\"<&'"), "&quot;&lt;&amp;&#39;");
});
