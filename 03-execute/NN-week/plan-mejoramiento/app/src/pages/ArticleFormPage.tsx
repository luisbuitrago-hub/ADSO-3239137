import { useCallback, useRef, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { DataError, FormField, Loading } from '../components/DataViews'
import { useCatalog } from '../hooks/useCatalog'
import { useRemote } from '../hooks/useRemote'
import { useMutation } from '../hooks/useMutation'
import { fieldErrors, textError } from '../services/validation'
import type { Article, Category } from '../types/catalog'

export function ArticleFormPage() {
  const { id } = useParams()
  const api = useCatalog()
  const categories = useRemote(
    'categories',
    useCallback((signal: AbortSignal) => api.categories(signal), [api]),
  )
  const item = useRemote(
    `edit:${id || 'new'}`,
    useCallback(
      (signal: AbortSignal) => (id ? api.article(id, signal) : Promise.resolve(null)),
      [api, id],
    ),
  )
  return (
    <>
      <Link className="back-link" to={id ? `/articles/${id}` : '/articles'}>
        ← Volver {id ? 'al detalle' : 'al catálogo'}
      </Link>
      <div className="page-heading">
        <div>
          <span className="eyebrow">ADMINISTRACIÓN DEL CATÁLOGO</span>
          <h1>{id ? 'Editar artículo' : 'Registrar artículo'}</h1>
          <p className="muted">
            {id
              ? 'Actualiza la información sin alterar las unidades prestadas.'
              : 'La disponibilidad inicial será igual al total de unidades.'}
          </p>
        </div>
      </div>
      {categories.loading || item.loading ? (
        <Loading />
      ) : categories.error ? (
        <DataError error={categories.error} retry={categories.reload} />
      ) : item.error ? (
        <DataError error={item.error} retry={item.reload} />
      ) : (
        categories.data && (
          <ArticleForm key={id || 'new'} categories={categories.data} article={item.data} />
        )
      )}
    </>
  )
}
function ArticleForm({ categories, article }: { categories: Category[]; article: Article | null }) {
  const api = useCatalog()
  const navigate = useNavigate()
  const mutation = useMutation()
  const [values, setValues] = useState({
    name: article?.name || '',
    description: article?.description || '',
    reference: article?.reference || '',
    category_id: article?.category.id || '',
    total_units: String(article?.total_units || ''),
  })
  const [localErrors, setLocalErrors] = useState<Record<string, string>>({})
  const form = useRef<HTMLFormElement>(null)
  const errors = { ...fieldErrors(mutation.error), ...localErrors }
  function update(field: keyof typeof values, value: string) {
    setValues((old) => ({ ...old, [field]: value }))
  }
  async function submit(event: FormEvent) {
    event.preventDefault()
    if (mutation.pending) return
    mutation.clearError()
    const next: Record<string, string> = {}
    for (const [key, max] of [
      ['name', 250],
      ['description', 200],
      ['reference', 50],
    ] as const) {
      const error = textError(values[key], max)
      if (error) next[key] = error
    }
    if (!categories.some((category) => category.id === values.category_id))
      next.category_id = 'Selecciona una categoría disponible.'
    const total = Number(values.total_units)
    if (
      !/^\d+$/.test(values.total_units) ||
      !Number.isSafeInteger(total) ||
      total < 1 ||
      total > 2147483647
    )
      next.total_units = 'Escribe un entero entre 1 y 2147483647.'
    else if (article && total < article.total_units - article.available_units)
      next.total_units = 'El total no puede ser menor que las unidades pendientes de devolución.'
    setLocalErrors(next)
    if (Object.keys(next).length) {
      requestAnimationFrame(() =>
        form.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus(),
      )
      return
    }
    const input = {
      name: values.name.trim(),
      description: values.description.trim(),
      category_id: values.category_id,
      total_units: total,
    }
    const result = await mutation.run((signal) =>
      article
        ? api.updateArticle(article.id, input, signal)
        : api.createArticle({ ...input, reference: values.reference.trim() }, signal),
    )
    if (result.ok)
      navigate(`/articles/${result.value.id}`, {
        replace: true,
        state: {
          flash: article
            ? 'Artículo actualizado correctamente.'
            : 'Artículo registrado correctamente.',
        },
      })
  }
  return (
    <form
      className="editor-panel"
      noValidate
      onSubmit={submit}
      ref={form}
      aria-busy={mutation.pending}
    >
      {mutation.error && <DataError error={mutation.error} />}
      {categories.length === 0 && (
        <p role="status" className="notice">
          No hay categorías disponibles. No es posible guardar el artículo.
        </p>
      )}
      <fieldset disabled={mutation.pending}>
        <legend className="sr-only">Datos del artículo</legend>
        <div className="form-grid">
          <FormField
            id="article-name"
            label="Nombre"
            value={values.name}
            onChange={(value) => update('name', value)}
            error={errors.name}
            hint="Obligatorio, hasta 250 caracteres."
          />
          <FormField
            id="article-reference"
            label="Referencia"
            value={values.reference}
            onChange={(value) => update('reference', value)}
            error={errors.reference}
            readOnly={!!article}
            hint={
              article
                ? 'La referencia no puede modificarse.'
                : 'Obligatoria y única entre artículos activos, hasta 50 caracteres.'
            }
          />
          <FormField
            id="article-category-id"
            label="Categoría"
            as="select"
            value={values.category_id}
            onChange={(value) => update('category_id', value)}
            error={errors.category_id}
          >
            <option value="">Selecciona una categoría</option>
            {categories.map((category) => (
              <option value={category.id} key={category.id}>
                {category.name}
              </option>
            ))}
          </FormField>
          <FormField
            id="article-total-units"
            label="Unidades totales"
            value={values.total_units}
            inputMode="numeric"
            onChange={(value) => update('total_units', value)}
            error={errors.total_units}
            hint={
              article
                ? `Actualmente disponibles: ${article.available_units}. La disponibilidad se ajusta por la diferencia del total.`
                : 'Como mínimo una unidad. La disponibilidad se asigna automáticamente.'
            }
          />
          <div className="full-field">
            <FormField
              id="article-description"
              label="Descripción"
              as="textarea"
              value={values.description}
              onChange={(value) => update('description', value)}
              error={errors.description}
              hint="Obligatoria, hasta 200 caracteres."
            />
          </div>
        </div>
      </fieldset>
      <div className="form-actions">
        <button
          className="button button-primary"
          type="submit"
          disabled={mutation.pending || categories.length === 0}
        >
          {mutation.pending ? 'Guardando…' : article ? 'Guardar cambios' : 'Registrar artículo'}
        </button>
        <Link
          className="button button-secondary"
          to={article ? `/articles/${article.id}` : '/articles'}
        >
          Cancelar
        </Link>
      </div>
    </form>
  )
}
