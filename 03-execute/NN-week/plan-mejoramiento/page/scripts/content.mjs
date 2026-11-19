import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { applicationUrl, htmlAttribute } from "./config.mjs";
export const root = fileURLToPath(new URL("../", import.meta.url));
export const publicFiles = [
  "styles.css",
  "site.js",
  "assets/mark.svg",
  "assets/kitchen.svg",
];
export async function render(env = process.env) {
  const template = await readFile(
    new URL("../src/index.html", import.meta.url),
    "utf8",
  );
  return template.replaceAll("{{APP_URL}}", htmlAttribute(applicationUrl(env)));
}
