import { useMemo } from 'react'
import { useAuth } from '../auth/context'
import { loansApi } from '../services/loans'

export function useLoans() {
  const { client } = useAuth()
  return useMemo(() => loansApi(client), [client])
}
