import type { ApiError } from './http'
export const lengthOf = (value: string) => [...value].length
export function fieldErrors(error: ApiError | null): Record<string, string> {
  const result: Record<string, string> = {}
  for (const detail of error?.details || []) result[detail.field] = detail.issue
  if (error?.code === 'REFERENCE_TAKEN')
    result.reference = 'La referencia ya pertenece a un artículo activo.'
  if (error?.code === 'DOCUMENT_TAKEN') result.document_number = 'El documento ya está registrado.'
  return result
}
export function textError(value: string, max: number): string | undefined {
  if (!value.trim()) return 'Este campo es obligatorio.'
  if (lengthOf(value.trim()) > max) return `Admite hasta ${max} caracteres.`
}
