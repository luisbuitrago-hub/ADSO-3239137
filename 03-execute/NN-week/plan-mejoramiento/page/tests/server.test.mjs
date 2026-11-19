import test from "node:test";
import assert from "node:assert/strict";
import { startServer } from "../scripts/serve.mjs";

test("servidor publica solo la página y recursos, con tipos correctos y sin API", async (t) => {
  const server = await startServer({ env: { KITCHENWARE_APP_URL: "/login" } });
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const base = `http://127.0.0.1:${server.address().port}`;
  for (const [resource, mime] of [
    ["/", "text/html"],
    ["/styles.css", "text/css"],
    ["/site.js", "text/javascript"],
    ["/assets/kitchen.svg", "image/svg+xml"],
    ["/assets/mark.svg", "image/svg+xml"],
  ]) {
    const result = await fetch(base + resource);
    assert.equal(result.status, 200);
    assert.ok(result.headers.get("content-type").includes(mime));
    assert.ok((await result.text()).length > 0);
  }
  for (const resource of [
    "/README.md",
    "/.env",
    "/package.json",
    "/tests/config.test.mjs",
    "/scripts/config.mjs",
    "/api/v1/neighbors",
    "/%2e%2e/app/README.md",
  ])
    assert.equal((await fetch(base + resource)).status, 404);
  assert.equal(
    (await fetch(base + "/", { method: "POST", body: "example" })).status,
    405,
  );
  const head = await fetch(base + "/", { method: "HEAD" });
  assert.equal(head.status, 200);
  assert.equal(await head.text(), "");
  assert.ok(
    head.headers.get("content-security-policy").includes("connect-src 'none'"),
  );
  assert.equal(head.headers.get("x-content-type-options"), "nosniff");
});
test("no reemplaza otro proceso si el puerto está ocupado", async (t) => {
  const server = await startServer({ env: { KITCHENWARE_APP_URL: "/login" } });
  t.after(() => new Promise((resolve) => server.close(resolve)));
  await assert.rejects(
    startServer({
      port: server.address().port,
      env: { KITCHENWARE_APP_URL: "/login" },
    }),
    { code: "EADDRINUSE" },
  );
});
