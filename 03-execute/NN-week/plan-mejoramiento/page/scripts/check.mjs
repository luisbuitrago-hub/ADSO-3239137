import { readFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { root, render, publicFiles } from "./content.mjs";
export async function check() {
  const html = await render({
    KITCHENWARE_APP_URL: "https://app.example.invalid/login",
  });
  if (!html.startsWith("<!doctype html>") || !html.includes('<html lang="es">'))
    throw new Error("Falta documento HTML en español.");
  if ((html.match(/<h1\b/g) || []).length !== 1)
    throw new Error("Debe existir un título principal.");
  const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map((match) => match[1]);
  if (new Set(ids).size !== ids.length)
    throw new Error("Hay identificadores repetidos.");
  for (const match of html.matchAll(/(?:href|src)="([^"]+)"/g)) {
    const target = match[1];
    if (target.startsWith("#") && !ids.includes(target.slice(1)))
      throw new Error("Hay un fragmento sin destino.");
    if (target.startsWith("./") && !publicFiles.includes(target.slice(2)))
      throw new Error("Recurso no incluido en el manifiesto público.");
    if (
      !target.startsWith("#") &&
      !target.startsWith("./") &&
      target !== "https://app.example.invalid/login"
    )
      throw new Error("Enlace externo no autorizado en la presentación.");
  }
  for (const file of publicFiles)
    if ((await readFile(path.join(root, "src", file))).length === 0)
      throw new Error("Existe un recurso vacío.");
  for (const file of [
    "src/site.js",
    "scripts/build.mjs",
    "scripts/config.mjs",
    "scripts/content.mjs",
    "scripts/serve.mjs",
  ]) {
    const result = spawnSync(
      process.execPath,
      ["--check", path.join(root, file)],
      { encoding: "utf8" },
    );
    if (result.status !== 0)
      throw new Error(`Sintaxis JavaScript inválida: ${file}`);
  }
  console.log(
    "PASS: estructura básica HTML, enlaces internos, manifiesto público y sintaxis JavaScript.",
  );
}
if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === path.join(root, "scripts", "check.mjs")
)
  await check();
