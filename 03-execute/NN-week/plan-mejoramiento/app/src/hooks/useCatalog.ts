import { useMemo } from 'react'
import { useAuth } from '../auth/context'
import { catalogApi } from '../services/catalog'

export function useCatalog() {
  const { client } = useAuth()
  return useMemo(() => catalogApi(client), [client])
}
