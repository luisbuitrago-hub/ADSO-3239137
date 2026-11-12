# ADR-003 — Conservación de datos históricos de préstamos

**Estado:** Aceptado  
**Fecha:** 2026-11-12  
**Proyecto:** Kitchenware  
**Decisión:** Conservar una copia histórica del nombre, la referencia y la categoría de cada artículo al registrar un préstamo.

## 1. Contexto

Kitchenware administra artículos de menaje que pueden prestarse a los vecinos de un salón comunal.

Durante el funcionamiento del sistema, un administrador puede modificar la información del catálogo, por ejemplo, el nombre o la categoría de un artículo.

Sin embargo, los préstamos anteriores deben conservar la información correspondiente al momento en que fueron registrados.

Por ejemplo:

1. El artículo `OLL-001` se llama inicialmente "Olla grande".
2. Un vecino recibe una unidad de ese artículo.
3. Posteriormente, el administrador cambia su nombre a "Olla de aluminio grande".
4. Al consultar el préstamo original, debe seguir apareciendo "Olla grande".

Si las consultas históricas obtuvieran siempre el nombre actual del catálogo, el registro del préstamo cambiaría indirectamente después de su creación.

Esto afectaría la trazabilidad de los préstamos y la consistencia de los reportes.

## 2. Decisión

Kitchenware utilizará una estrategia de **datos históricos congelados**, también conocida como *snapshot*.

Al registrar cada línea de préstamo, el sistema copiará los siguientes valores desde el catálogo:

- `article_name`: nombre del artículo en el momento del préstamo.
- `article_reference`: referencia del artículo en el momento del préstamo.
- `category_name`: nombre de la categoría en el momento del préstamo.

Estos datos se almacenarán en la tabla `loan_item`.

También se conservará `article_id` como referencia al artículo original.

El modelo de la línea será:

| Campo | Propósito |
|---|---|
| `id` | Identificador único de la línea |
| `loan_id` | Préstamo al que pertenece |
| `article_id` | Artículo asociado |
| `article_name` | Nombre histórico |
| `article_reference` | Referencia histórica |
| `category_name` | Categoría histórica |
| `due_at` | Fecha límite de devolución |
| `returned_at` | Fecha real de devolución, si existe |

Los valores históricos se asignarán cuando se cree el préstamo y no se actualizarán posteriormente.

La única modificación de negocio permitida sobre una línea será registrar `returned_at` cuando se devuelva el artículo.

No se permitirá eliminar ni reemplazar una línea histórica mediante la API.

## 3. Funcionamiento

### 3.1. Registro de un préstamo

Cuando se registra un préstamo, `LendArticlesService` obtendrá los datos vigentes del artículo.

El sistema deberá:

1. Verificar que el artículo exista y esté activo.
2. Comprobar su disponibilidad.
3. Obtener el nombre, la referencia y la categoría.
4. Crear la línea del préstamo.
5. Copiar los valores históricos en `loan_item`.
6. Guardar la línea y descontar una unidad dentro de la misma transacción.

Ejemplo de línea registrada:

```json
{
  "article_id": "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  "article_name": "Olla grande",
  "article_reference": "OLL-001",
  "category_name": "ollas",
  "due_at": "2026-11-15T14:00:00Z",
  "returned_at": null
}
```

### 3.2. Modificación posterior del catálogo

Supongamos que el administrador cambia el nombre del artículo:

| Dato | Valor anterior | Valor nuevo |
|---|---|---|
| `article.name` | Olla grande | Olla de aluminio grande |
| `article.reference` | OLL-001 | OLL-001 |
| `article.category` | ollas | ollas |

El catálogo mostrará el nombre actualizado.

Sin embargo, la línea histórica mantendrá:

```json
{
  "article_name": "Olla grande",
  "article_reference": "OLL-001",
  "category_name": "ollas"
}
```

Esto permite consultar correctamente la información de préstamos anteriores.

### 3.3. Baja lógica

Los artículos utilizarán el campo `deleted_at` para indicar una baja lógica.

El sistema no eliminará físicamente los registros de artículos que estén relacionados con préstamos.

La referencia `loan_item.article_id` conservará su integridad mediante una clave foránea restrictiva.

Las líneas históricas continuarán disponibles para consultas y reportes.

## 4. Alternativas consideradas

### Alternativa A: Consultar siempre los datos actuales del catálogo

Se descartó porque modificar el catálogo alteraría indirectamente la información mostrada en préstamos anteriores.

### Alternativa B: Crear versiones completas de los artículos

Se consideró mantener una tabla adicional de versiones del catálogo.

Se descartó porque agregaría complejidad innecesaria para las necesidades actuales de Kitchenware.

### Alternativa C: Copiar los datos al registrar cada préstamo

Se seleccionó porque conserva la información histórica sin crear nuevas tablas ni requerir un sistema de versionamiento completo.

## 5. Consecuencias

### Positivas

- Los préstamos mantienen los datos originales de los artículos.
- Los cambios del catálogo no modifican el historial.
- Los reportes pueden consultar información histórica coherente.
- La baja lógica no destruye la información de préstamos anteriores.
- El funcionamiento puede verificarse mediante pruebas automatizadas.

### Negativas

- Algunos datos se almacenan de forma repetida.
- Se requiere copiar correctamente los valores al crear cada línea.
- Las consultas históricas deben utilizar las columnas congeladas y no los nombres actuales del catálogo.

Esta duplicación de datos es intencional y se justifica por la necesidad de conservar el historial.

## 6. Reporte de artículos más solicitados

El endpoint:

`GET /api/v1/reports/most-borrowed`

Utilizará los valores históricos de `loan_item` para construir el reporte.

Cada fila se agrupará por:

- `article_id`
- `article_name`
- `category_name`

La cantidad de préstamos se calculará mediante el número de líneas correspondientes a cada grupo durante el periodo consultado.

Si un artículo tuvo dos nombres diferentes durante el periodo, podrán aparecer filas separadas, ya que cada una representa un valor histórico distinto.

El reporte se ordenará por:

1. `times_borrowed`, de mayor a menor.
2. `article_name`, alfabéticamente.

El reporte no incluirá información personal de vecinos ni de operadores.

## 7. Reglas de consistencia

La implementación deberá cumplir lo siguiente:

1. Toda línea de préstamo tendrá un `article_id` válido.
2. Los campos `article_name`, `article_reference` y `category_name` serán obligatorios.
3. Los datos históricos se copiarán durante la creación de la línea.
4. La edición posterior del catálogo no modificará los valores históricos.
5. La devolución solo actualizará `returned_at`.
6. Los préstamos y sus líneas no podrán eliminarse mediante la API.
7. Las consultas del historial utilizarán los datos congelados.
8. Los reportes utilizarán los nombres y categorías históricas.
9. Los identificadores de artículo mantendrán su integridad referencial.
10. Las fechas se almacenarán en UTC.

## 8. Verificación

La decisión se comprobará mediante pruebas automatizadas.

### Prueba 1. Conservar nombre histórico

1. Crear un artículo llamado "Olla grande".
2. Registrar un préstamo de ese artículo.
3. Cambiar su nombre a "Olla de aluminio grande".
4. Consultar el préstamo.
5. Verificar que la línea siga mostrando "Olla grande".

### Prueba 2. Conservar categoría histórica

1. Crear un artículo asociado a la categoría `ollas`.
2. Registrar un préstamo.
3. Cambiar la categoría del artículo a `vajilla`.
4. Consultar el préstamo original.
5. Verificar que `category_name` permanezca como `ollas`.

### Prueba 3. Conservar historial después de una baja lógica

1. Registrar un préstamo.
2. Devolver todas sus líneas.
3. Desactivar el artículo.
4. Consultar el préstamo histórico.
5. Verificar que la información continúe disponible.

### Prueba 4. Reporte con cambios de nombre

1. Registrar un préstamo de "Olla grande".
2. Devolver el artículo.
3. Cambiar su nombre a "Olla de aluminio grande".
4. Registrar un nuevo préstamo del mismo artículo.
5. Consultar el reporte del periodo.
6. Verificar que existan filas correspondientes a cada nombre histórico.

## 9. Relación con el proyecto

Este ADR complementa:

- `docs/constitution.md`: conservación de la información histórica.
- `docs/spec.md`: reglas funcionales de los préstamos.
- `docs/architecture.md`: entidades `Loan` y `LoanItem`.
- `docs/data-model.md`: columnas congeladas de `loan_item`.
- `docs/api-contract.md`: respuestas de préstamos y reportes.
- `docs/tasks.md`: tareas `T-05`, `T-09`, `T-11` y `T-13`.

La implementación de esta decisión corresponde principalmente a `T-05`, `T-09` y `T-11`.

**Este ADR documenta cómo Kitchenware conservará la información histórica de sus préstamos. Su cumplimiento deberá verificarse mediante pruebas automatizadas y la ejecución del sistema durante la sustentación individual.**
