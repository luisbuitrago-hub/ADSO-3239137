import { useMemo } from 'react'
import { useAuth } from '../auth/context'
import { administrationApi } from '../services/administration'
export function useAdministration() {
  const { client } = useAuth()
  return useMemo(() => administrationApi(client), [client])
}
