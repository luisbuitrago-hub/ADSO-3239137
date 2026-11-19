import { ApiError } from '../services/http'
import type { LoginResponse, Session } from '../types/api'

export function sessionFromResponse(value: unknown, username: string, now = Date.now()): Session {
  try {
    const data = value as LoginResponse
    if (
      !data ||
      typeof data.access_token !== 'string' ||
      data.token_type !== 'Bearer' ||
      data.expires_in !== 28800 ||
      !['admin', 'operator'].includes(data.role)
    )
      throw new Error()
    const parts = data.access_token.split('.')
    if (parts.length !== 3 || parts.some((part) => !/^[A-Za-z0-9_-]+$/.test(part)))
      throw new Error()
    const encoded = parts[1].replace(/-/g, '+').replace(/_/g, '/')
    const payload: unknown = JSON.parse(
      atob(encoded.padEnd(Math.ceil(encoded.length / 4) * 4, '=')),
    )
    if (
      !payload ||
      typeof payload !== 'object' ||
      !('exp' in payload) ||
      !('role' in payload) ||
      typeof payload.exp !== 'number' ||
      !Number.isFinite(payload.exp) ||
      payload.role !== data.role
    )
      throw new Error()
    const expiresAt = Math.min(payload.exp * 1000, now + data.expires_in * 1000)
    if (expiresAt <= now) throw new Error()
    // Leer exp sirve para la UX; la firma y el rol vigente solo los autoriza Laravel.
    return {
      accessToken: data.access_token,
      role: data.role,
      username: username.trim().toLowerCase(),
      expiresAt,
    }
  } catch {
    throw new ApiError(
      0,
      'INVALID_SESSION',
      'La sesión recibida no es válida o ya venció. Vuelve a iniciar sesión.',
    )
  }
}
