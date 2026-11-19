import { useSearchParams } from 'react-router'

export function useListParams() {
  const [params, setParams] = useSearchParams()
  const number = (name: string, fallback: number, max: number) => {
    const value = params.get(name) || String(fallback)
    return /^\d+$/.test(value) && Number(value) >= 1 && Number(value) <= max
      ? Number(value)
      : fallback
  }
  function update(changes: Record<string, string | number | undefined>) {
    const next = new URLSearchParams(params)
    for (const [key, value] of Object.entries(changes))
      if (value === undefined || value === '') next.delete(key)
      else next.set(key, String(value))
    setParams(next)
  }
  return {
    q: params.get('q') || '',
    categoryId: params.get('category_id') || '',
    page: number('page', 1, 2147483647),
    size: number('size', 20, 50),
    update,
  }
}
