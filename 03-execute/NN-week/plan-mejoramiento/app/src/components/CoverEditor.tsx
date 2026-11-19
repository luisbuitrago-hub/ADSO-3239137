import { useRef, useState } from 'react'
import { useAdministration } from '../hooks/useAdministration'
import { useMutation } from '../hooks/useMutation'
import { coverError } from '../services/administration'
import { DataError } from './DataViews'

export function CoverEditor({
  id,
  hasCover,
  onSaved,
  onEditing,
}: {
  id: string
  hasCover: boolean
  onEditing: () => void
  onSaved: (message?: string) => void
}) {
  const api = useAdministration()
  const mutation = useMutation()
  const [file, setFile] = useState<File | null>(null)
  const [error, setError] = useState<string>()
  const [confirm, setConfirm] = useState(false)
  const input = useRef<HTMLInputElement>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  const confirmation = useRef<HTMLButtonElement>(null)
  async function upload() {
    onEditing()
    const issue = coverError(file)
    setError(issue)
    if (issue || !file) return
    const result = await mutation.run((signal) => api.uploadCover(id, file, signal))
    if (result.ok) {
      setFile(null)
      if (input.current) input.current.value = ''
      onSaved('Imagen guardada correctamente.')
    }
  }
  async function remove() {
    onEditing()
    const result = await mutation.run((signal) => api.deleteCover(id, signal))
    if (result.ok) {
      setConfirm(false)
      onSaved('Imagen eliminada correctamente.')
    }
  }
  return (
    <section className="editor-panel" aria-label="Administrar imagen">
      <h2>Imagen del artículo</h2>
      <p>JPG o PNG de hasta 2 MB (2.097.152 bytes). El archivo se valida al guardarlo.</p>
      {mutation.error && (
        <>
          <DataError error={mutation.error} />
          {mutation.error.details.map((detail, index) => (
            <p className="field-error" key={index}>
              Imagen: {detail.issue}
            </p>
          ))}
          <button className="button button-secondary" type="button" onClick={() => onSaved()}>
            Consultar artículo actualizado
          </button>
        </>
      )}
      <form
        onSubmit={(e) => {
          e.preventDefault()
          void upload()
        }}
      >
        <div className="form-field">
          <label htmlFor="cover-file">Seleccionar imagen JPG o PNG</label>
          <input
            ref={input}
            id="cover-file"
            type="file"
            accept="image/jpeg,image/png"
            disabled={mutation.pending || confirm}
            aria-invalid={!!error}
            aria-describedby={error ? 'cover-error' : undefined}
            onChange={(e) => {
              onEditing()
              const next = e.target.files?.[0] || null
              setFile(next)
              setError(coverError(next))
              mutation.clearError()
            }}
          />
          {error && (
            <p id="cover-error" className="field-error" role="alert">
              {error}
            </p>
          )}
        </div>
        <button
          className="button button-primary"
          type="submit"
          disabled={mutation.pending || confirm}
        >
          {mutation.pending ? 'Guardando imagen…' : hasCover ? 'Reemplazar imagen' : 'Subir imagen'}
        </button>
      </form>
      {hasCover && !confirm && (
        <button
          ref={trigger}
          className="button button-danger"
          type="button"
          disabled={mutation.pending}
          onClick={() => {
            mutation.clearError()
            setConfirm(true)
            requestAnimationFrame(() => confirmation.current?.focus())
          }}
        >
          Eliminar imagen
        </button>
      )}
      {confirm && (
        <div className="confirm-panel">
          <h3>¿Eliminar la imagen del artículo?</h3>
          <p>El artículo y su historial se conservarán.</p>
          <div className="page-actions">
            <button
              ref={confirmation}
              className="button button-danger"
              type="button"
              disabled={mutation.pending}
              onClick={() => void remove()}
            >
              Confirmar eliminación de imagen
            </button>
            <button
              className="button button-secondary"
              type="button"
              disabled={mutation.pending}
              onClick={() => {
                setConfirm(false)
                mutation.clearError()
                requestAnimationFrame(() => trigger.current?.focus())
              }}
            >
              Cancelar eliminación
            </button>
          </div>
        </div>
      )}
    </section>
  )
}
