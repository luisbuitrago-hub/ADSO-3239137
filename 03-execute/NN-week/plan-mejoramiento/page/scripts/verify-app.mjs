import { spawn } from "node:child_process";
import {
  mkdtemp,
  cp,
  mkdir,
  writeFile,
  access,
  symlink,
} from "node:fs/promises";
import path from "node:path";
import { tmpdir } from "node:os";
import http from "node:http";
import { setTimeout as pause } from "node:timers/promises";
import { root } from "./content.mjs";
import { build } from "./build.mjs";
import { startServer } from "./serve.mjs";

const app = path.resolve(root, "../app");
try {
  await access(path.join(app, "node_modules/vite/bin/vite.js"));
} catch {
  throw new Error(
    "Instala las herramientas existentes con npm ci dentro de app/ para esta comprobación opcional.",
  );
}
const directory = await mkdtemp(path.join(tmpdir(), "kitchenware-page-app-"));
const snapshot = path.join(directory, "app");
await mkdir(snapshot);
// Solo fuentes públicas: nunca se copian .env ni datos de ejecución.
for (const file of ["src", "index.html", "package.json"])
  await cp(path.join(app, file), path.join(snapshot, file), {
    recursive: true,
  });
await symlink(
  path.join(app, "node_modules"),
  path.join(snapshot, "node_modules"),
  "dir",
);
const reservation = http.createServer();
await new Promise((resolve) => reservation.listen(0, "127.0.0.1", resolve));
const appPort = reservation.address().port;
await new Promise((resolve) => reservation.close(resolve));
await writeFile(
  path.join(snapshot, "vite.config.mjs"),
  `import { defineConfig } from 'vite'; import react from '@vitejs/plugin-react'; export default defineConfig({plugins:[react()],cacheDir:${JSON.stringify(path.join(directory, "vite-cache"))},server:{host:'127.0.0.1',port:${appPort},strictPort:true}})`,
);
const child = spawn(
  process.execPath,
  [
    path.join(app, "node_modules/vite/bin/vite.js"),
    "--config",
    path.join(snapshot, "vite.config.mjs"),
    "--configLoader",
    "runner",
  ],
  {
    cwd: snapshot,
    env: {
      PATH: process.env.PATH,
      LANG: "C.UTF-8",
      NODE_ENV: "development",
      VITE_API_BASE_URL: "/api/v1",
    },
    stdio: "ignore",
    detached: true,
  },
);
let server;
try {
  const destination = `http://127.0.0.1:${appPort}/login`;
  let ready = false;
  for (let attempt = 0; attempt < 80; attempt++) {
    if (child.exitCode !== null)
      throw new Error(
        "La copia aislada de React no pudo iniciarse; no se reutilizan puertos ocupados.",
      );
    try {
      if ((await fetch(destination, { signal: AbortSignal.timeout(500) })).ok) {
        ready = true;
        break;
      }
    } catch {}
    await pause(200);
  }
  if (!ready) throw new Error("React no alcanzó el estado disponible.");
  const output = await build(
    { KITCHENWARE_APP_URL: destination },
    path.join(directory, "public"),
  );
  server = await startServer({ directory: output });
  const env = {
    ...process.env,
    PAGE_TEST_URL: `http://127.0.0.1:${server.address().port}`,
    PAGE_TEST_APP_URL: destination,
  };
  const result = spawn(
    process.execPath,
    [
      path.join(root, "node_modules/@playwright/test/cli.js"),
      "test",
      "--config",
      "playwright.integration.config.mjs",
    ],
    { cwd: root, env, stdio: "inherit" },
  );
  const code = await new Promise((resolve) => result.once("exit", resolve));
  if (code !== 0)
    throw new Error(
      "Falló el enlace de la presentación compilada con la aplicación React.",
    );
  console.log(
    "PASS: enlace real desde la página compilada a /login de React, sin API ni PostgreSQL.",
  );
} finally {
  if (server) await new Promise((resolve) => server.close(resolve));
  if (child.exitCode === null) {
    const closed = new Promise((resolve) => child.once("exit", resolve));
    child.kill("SIGTERM");
    await closed;
  }
}
