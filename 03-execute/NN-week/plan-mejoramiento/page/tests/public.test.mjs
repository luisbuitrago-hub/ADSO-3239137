import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, readdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { build } from "../scripts/build.mjs";
import { render } from "../scripts/content.mjs";
import { check } from "../scripts/check.mjs";

test("documento cumple estructura, enlaces y sintaxis local sin backend", async () => {
  await check();
});
test("contenido público procede de requisitos, sin datos personales ni información académica", async () => {
  const html = await render({ KITCHENWARE_APP_URL: "/login" });
  for (const text of [
    "Kitchenware",
    "Inventario claro",
    "Vecinos identificados",
    "Entregas y devoluciones",
    "3 días",
    "Hasta 3 artículos",
    "React",
    "Laravel",
    "PostgreSQL 16",
    "Docker Compose",
  ])
    assert.ok(html.includes(text), text);
  assert.doesNotMatch(
    html,
    /ADSO|3239137|A16\b|plan de mejoramiento|prueba técnica|testimonial|testimonio|Bearer|JWT_SECRET|ADMIN_PASSWORD|document_number|full_name|access_token/i,
  );
  assert.doesNotMatch(html, /<form\b|<iframe\b|<input\b/);
  assert.doesNotMatch(html, /https?:\/\//);
});
test("build produce solo archivos públicos y codifica el destino configurado", async () => {
  const destination = await mkdtemp(
    path.join(tmpdir(), "kitchenware-page-build-"),
  );
  await build(
    { KITCHENWARE_APP_URL: "https://app.example.invalid/login" },
    destination,
  );
  assert.deepEqual((await readdir(destination)).sort(), [
    "assets",
    "index.html",
    "site.js",
    "styles.css",
  ]);
  assert.deepEqual((await readdir(path.join(destination, "assets"))).sort(), [
    "kitchen.svg",
    "mark.svg",
  ]);
  const html = await readFile(path.join(destination, "index.html"), "utf8");
  assert.equal(
    (html.match(/href="https:\/\/app.example.invalid\/login"/g) || []).length,
    3,
  );
  assert.doesNotMatch(html, /\{\{APP_URL\}\}/);
});
test("el cliente no captura información ni consulta API o almacenamiento del navegador", async () => {
  const script = await readFile(
    new URL("../src/site.js", import.meta.url),
    "utf8",
  );
  assert.doesNotMatch(
    script,
    /\bfetch\s*\(|XMLHttpRequest|WebSocket|sendBeacon|localStorage|sessionStorage|document\.cookie|innerHTML/,
  );
});
