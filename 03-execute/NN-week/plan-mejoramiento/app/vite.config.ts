import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const port = Number(env.DEV_PORT || 5173)
  const target = new URL(env.API_PROXY_TARGET || 'http://127.0.0.1:8080')
  if (
    !['http:', 'https:'].includes(target.protocol) ||
    target.username ||
    target.password ||
    target.search ||
    target.hash ||
    target.pathname !== '/'
  ) {
    throw new Error(
      'API_PROXY_TARGET debe ser un origen HTTP/HTTPS sin credenciales, ruta ni parámetros.',
    )
  }
  const domain = process.env.GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN || 'app.github.dev'
  const allowedHosts = process.env.CODESPACE_NAME
    ? [port, 4173].map((value) => `${process.env.CODESPACE_NAME}-${value}.${domain}`)
    : []
  const proxy = { '/api/v1': { target: target.origin, changeOrigin: true } }
  return {
    cacheDir: `node_modules/.vite/${mode}-${port}`,
    plugins: [react()],
    server: { host: '127.0.0.1', port, strictPort: true, allowedHosts, proxy },
    preview: { host: '127.0.0.1', port: 4173, strictPort: true, allowedHosts, proxy },
  }
})
