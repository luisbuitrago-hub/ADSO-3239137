import type { Role } from '../src/types/api'

// JWT sintéticos por ejecución: no son secretos ni firmas válidas para Laravel.
export function loginPayload(role: Role = 'admin', exp = Math.floor(Date.now() / 1000) + 28800) {
  const encode = (value: unknown) =>
    btoa(JSON.stringify(value)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_')
  const signature = encode(Array.from(crypto.getRandomValues(new Uint8Array(16))))
  return {
    access_token: `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode({ sub: crypto.randomUUID(), role, exp })}.${signature}`,
    token_type: 'Bearer' as const,
    expires_in: 28800 as const,
    role,
  }
}
export const response = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
export const failure = (
  status: number,
  code: string,
  message: string,
  details: { field: string; issue: string }[] = [],
) => response({ code, message, details }, status)
export function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((done) => {
    resolve = done
  })
  return { promise, resolve }
}
