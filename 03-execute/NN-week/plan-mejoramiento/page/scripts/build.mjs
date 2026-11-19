import { mkdir, writeFile, copyFile } from "node:fs/promises";
import path from "node:path";
import { root, render, publicFiles } from "./content.mjs";
export async function build(
  env = process.env,
  destination = path.join(root, "dist"),
) {
  const html = await render(env);
  await mkdir(path.join(destination, "assets"), { recursive: true });
  await writeFile(path.join(destination, "index.html"), html);
  for (const file of publicFiles)
    await copyFile(path.join(root, "src", file), path.join(destination, file));
  return destination;
}
if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === path.join(root, "scripts", "build.mjs")
) {
  await build();
  console.log(
    "Página estática generada en page/dist/. Sin dependencias de ejecución ni acceso a la API.",
  );
}
