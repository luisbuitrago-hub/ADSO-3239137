import { useRef, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router'
import { DataError, FormField } from '../components/DataViews'
import { useCatalog } from '../hooks/useCatalog'
import { useMutation } from '../hooks/useMutation'
import { fieldErrors, textError } from '../services/validation'

export function NeighborFormPage() {
  const api = useCatalog()
  const navigate = useNavigate()
  const mutation = useMutation()
  const [values, setValues] = useState({ full_name: '', document_number: '' })
  const [localErrors, setLocalErrors] = useState<Record<string, string>>({})
  const form = useRef<HTMLFormElement>(null)
  const errors = { ...fieldErrors(mutation.error), ...localErrors }
  async function submit(event: FormEvent) {
    event.preventDefault()
    if (mutation.pending) return
    mutation.clearError()
    const next: Record<string, string> = {}
    for (const [field, max] of [
      ['full_name', 200],
      ['document_number', 30],
    ] as const) {
      const error = textError(values[field], max)
      if (error) next[field] = error
    }
    setLocalErrors(next)
    if (Object.keys(next).length) {
      requestAnimationFrame(() =>
        form.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus(),
      )
      return
    }
    const result = await mutation.run((signal) =>
      api.createNeighbor(
        { full_name: values.full_name.trim(), document_number: values.document_number.trim() },
        signal,
      ),
    )
    if (result.ok)
      navigate(`/neighbors/${result.value.id}`, {
        replace: true,
        state: { flash: 'Vecino registrado correctamente.' },
      })
  }
  return (
    <>
      <Link className="back-link" to="/neighbors">
        ← Volver a vecinos
      </Link>
      <div className="page-heading">
        <div>
          <span className="eyebrow">NUESTRA COMUNIDAD</span>
          <h1>Registrar vecino</h1>
          <p className="muted">El vecino no recibe una cuenta de acceso al sistema.</p>
        </div>
      </div>
      <form
        className="editor-panel"
        noValidate
        ref={form}
        onSubmit={submit}
        aria-busy={mutation.pending}
      >
        {mutation.error && <DataError error={mutation.error} />}
        <fieldset disabled={mutation.pending}>
          <legend className="sr-only">Datos del vecino</legend>
          <div className="form-grid">
            <FormField
              id="neighbor-full-name"
              label="Nombre completo"
              value={values.full_name}
              onChange={(value) => setValues((old) => ({ ...old, full_name: value }))}
              error={errors.full_name}
              hint="Obligatorio, hasta 200 caracteres."
            />
            <FormField
              id="neighbor-document-number"
              label="Documento de identidad"
              value={values.document_number}
              onChange={(value) => setValues((old) => ({ ...old, document_number: value }))}
              error={errors.document_number}
              hint="Único, de 1 a 30 caracteres. Admite letras, ceros iniciales y separadores. Solo se recortan espacios exteriores."
            />
          </div>
        </fieldset>
        <div className="form-actions">
          <button type="submit" className="button button-primary" disabled={mutation.pending}>
            {mutation.pending ? 'Guardando…' : 'Registrar vecino'}
          </button>
          <Link className="button button-secondary" to="/neighbors">
            Cancelar
          </Link>
        </div>
      </form>
    </>
  )
}
