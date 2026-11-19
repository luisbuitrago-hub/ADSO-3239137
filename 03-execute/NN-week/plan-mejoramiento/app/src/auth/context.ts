import { createContext, useContext } from 'react'
import type { HttpClient } from '../services/http'
import type { Credentials, Session, SessionNotice } from '../types/api'

export interface AuthState {
  session: Session | null
  notice: SessionNotice
  login: (credentials: Credentials) => Promise<void>
  logout: () => void
  client: HttpClient
}
export const AuthContext = createContext<AuthState | null>(null)
export function useAuth(): AuthState {
  const value = useContext(AuthContext)
  if (!value) throw new Error('La autenticación requiere AuthProvider.')
  return value
}
