export function applicationUrl(env = process.env) {
  const configured = env.KITCHENWARE_APP_URL;
  if (configured) return validateApplicationUrl(configured);
  const port = env.KITCHENWARE_APP_PORT || "5173";
  if (!/^\d+$/.test(port) || Number(port) < 1 || Number(port) > 65535)
    throw new Error("KITCHENWARE_APP_PORT debe ser un puerto válido.");
  // La forma del dominio coincide con app/vite.config.ts. No es una URL de despliegue fija.
  if (env.CODESPACE_NAME) {
    const name = env.CODESPACE_NAME;
    const domain =
      env.GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN || "app.github.dev";
    if (!/^[a-z0-9-]+$/i.test(name) || !/^[a-z0-9.-]+$/i.test(domain))
      throw new Error("La configuración del origen Codespaces no es válida.");
    return validateApplicationUrl(`https://${name}-${port}.${domain}/login`);
  }
  return `http://127.0.0.1:${port}/login`;
}
export function validateApplicationUrl(value) {
  if (
    typeof value !== "string" ||
    value !== value.trim() ||
    /[\u0000-\u0020\u007f\\]/.test(value)
  )
    throw new Error("El destino de la aplicación no es válido.");
  if (value.startsWith("/") && !value.startsWith("//")) {
    const url = new URL(value, "https://relative.invalid");
    if (url.origin !== "https://relative.invalid" || url.search || url.hash)
      throw new Error(
        "El destino relativo no puede contener parámetros ni fragmentos.",
      );
    return url.pathname;
  }
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error(
      "Utiliza una dirección HTTP/HTTPS válida para la aplicación.",
    );
  }
  if (
    !["http:", "https:"].includes(url.protocol) ||
    url.username ||
    url.password ||
    url.search ||
    url.hash
  )
    throw new Error(
      "Utiliza HTTP/HTTPS sin credenciales, parámetros ni fragmentos para la aplicación.",
    );
  return url.href;
}
export function htmlAttribute(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}
