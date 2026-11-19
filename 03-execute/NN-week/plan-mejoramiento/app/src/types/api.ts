export type Role = 'admin' | 'operator'
export interface Credentials {
  username: string
  password: string
}
export interface LoginResponse {
  access_token: string
  token_type: 'Bearer'
  expires_in: 28800
  role: Role
}
export interface ErrorDetail {
  field: string
  issue: string
}
export interface ApiErrorBody {
  code: string
  message: string
  details: ErrorDetail[]
}
export interface Session {
  accessToken: string
  username: string
  role: Role
  expiresAt: number
}
export type SessionNotice = 'expired' | 'invalid' | 'signed-out' | null
