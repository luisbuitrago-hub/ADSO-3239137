import http from "node:http";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { root, render, publicFiles } from "./content.mjs";
const types = {
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".svg": "image/svg+xml",
};
export async function startServer({
  port = 0,
  env = process.env,
  directory,
} = {}) {
  const html = directory
    ? await readFile(path.join(directory, "index.html"), "utf8")
    : await render(env); // Validar configuración antes de abrir el puerto.
  const server = http.createServer(async (request, response) => {
    const pathname = (request.url || "/").split("?")[0];
    const headers = {
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "no-referrer",
      "Cache-Control": "no-store",
      "Content-Security-Policy":
        "default-src 'self'; img-src 'self'; style-src 'self'; script-src 'self'; connect-src 'none'; object-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'",
    };
    if (!["GET", "HEAD"].includes(request.method)) {
      response.writeHead(405, { ...headers, Allow: "GET, HEAD" });
      response.end();
      return;
    }
    try {
      let data;
      let type;
      if (pathname === "/" || pathname === "/index.html") {
        data = html;
        type = "text/html; charset=utf-8";
      } else {
        const file = pathname.slice(1);
        if (!publicFiles.includes(file)) {
          response.writeHead(404, headers);
          response.end("No encontrado");
          return;
        }
        data = await readFile(
          path.join(directory || path.join(root, "src"), file),
        );
        type = types[path.extname(file)];
      }
      response.writeHead(200, {
        ...headers,
        "Content-Type": type,
        "Content-Length": Buffer.byteLength(data),
      });
      response.end(request.method === "HEAD" ? undefined : data);
    } catch {
      response.writeHead(500, headers);
      response.end("No se pudo servir el recurso.");
    }
  });
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, "127.0.0.1", resolve);
  });
  return server;
}
if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === path.join(root, "scripts", "serve.mjs")
) {
  const value = process.env.PAGE_PORT || "4174";
  if (!/^\d+$/.test(value) || Number(value) < 1 || Number(value) > 65535)
    throw new Error("PAGE_PORT debe ser un puerto válido.");
  const server = await startServer({ port: Number(value) });
  console.log(
    `Kitchenware · Presentación: http://127.0.0.1:${server.address().port}`,
  );
  for (const signal of ["SIGINT", "SIGTERM"])
    process.once(signal, () => server.close(() => process.exit(0)));
}
