import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { createHttpClient } from '../services/http'
import type { Credentials, Session, SessionNotice } from '../types/api'
import { AuthContext } from './context'
import { sessionFromResponse } from './session'

export function AuthProvider({ children, baseUrl }: { children: ReactNode; baseUrl?: string }) {
  const [session, setSession] = useState<Session | null>(null)
  const [notice, setNotice] = useState<SessionNotice>(null)
  const current = useRef<Session | null>(null)
  const pending = useRef<AbortController | null>(null)
  const generation = useRef(0)
  const clear = useCallback((reason: SessionNotice) => {
    generation.current++
    pending.current?.abort()
    pending.current = null
    current.current = null
    setSession(null)
    setNotice(reason)
  }, [])
  const getToken = useCallback(() => current.current?.accessToken, [])
  const onUnauthorized = useCallback(
    (token: string) => {
      if (current.current?.accessToken === token) clear('invalid')
    },
    [clear],
  )
  const [client] = useState(() => createHttpClient({ baseUrl }))
  useEffect(
    () => client.bindAuthentication({ getToken, onUnauthorized }),
    [client, getToken, onUnauthorized],
  )
  const login = useCallback(
    async (credentials: Credentials) => {
      pending.current?.abort()
      const controller = new AbortController()
      pending.current = controller
      const attempt = ++generation.current
      const result = await client.request<unknown>(
        '/auth/login',
        { method: 'POST', body: JSON.stringify(credentials), signal: controller.signal },
        false,
      )
      if (attempt !== generation.current || controller.signal.aborted)
        throw new DOMException('Solicitud cancelada.', 'AbortError')
      const next = sessionFromResponse(result, credentials.username)
      current.current = next
      pending.current = null
      setNotice(null)
      setSession(next)
    },
    [client],
  )

  useEffect(() => {
    if (!session) return
    const check = () => {
      if (session.expiresAt <= Date.now() && current.current === session) clear('expired')
    }
    const timer = setTimeout(check, Math.max(0, session.expiresAt - Date.now()))
    document.addEventListener('visibilitychange', check)
    window.addEventListener('focus', check)
    return () => {
      clearTimeout(timer)
      document.removeEventListener('visibilitychange', check)
      window.removeEventListener('focus', check)
    }
  }, [session, clear])
  useEffect(
    () => () => {
      pending.current?.abort()
      current.current = null
    },
    [],
  )

  return (
    <AuthContext value={{ session, notice, login, logout: () => clear('signed-out'), client }}>
      {children}
    </AuthContext>
  )
}
