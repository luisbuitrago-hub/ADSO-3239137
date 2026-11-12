# Contrato de la API — Kitchenware

**Proyecto:** Sistema de Préstamo de Menaje de un Salón Comunal  
**Identificador:** kitchenware  
**Ficha:** ADSO 3239137  
**Aprendiz:** A16  
**Backend:** PHP con Laravel  
**Frontend:** React  
**Base de datos:** PostgreSQL 16

## Propósito

Definir el contrato HTTP de Kitchenware, incluyendo endpoints, métodos, autenticación, autorización, parámetros, estructuras de respuesta y códigos de error.

Este contrato será implementado en Laravel y consumido por la aplicación React.

Las funcionalidades están definidas en `spec.md`, mientras que la persistencia se describe en `data-model.md`.

---

## 1. Convenciones

| Elemento | Convención |
|---|---|
| Prefijo de la API | `/api/v1` |
| Formato | JSON, UTF-8 |
| Campos | Inglés y `snake_case` |
| Identificadores | UUID v4 como texto |
| Fechas | ISO 8601 en UTC, terminadas en `Z` |
| Autenticación | Token Bearer |
| Paginación | `page` y `size` |
| Tamaño máximo de página | 50 registros |
| Mensajes al usuario | Español |
| Códigos de error | Inglés |
| Operaciones monetarias | No se implementan |

### 1.1. Autenticación

Todos los endpoints requieren autenticación, excepto:

- `POST /api/v1/auth/login`
- `GET /api/v1/health`

Las solicitudes autenticadas enviarán:

```http
Authorization: Bearer <token>
```

### 1.2. Paginación

Las operaciones de listado paginado utilizarán los parámetros:

```http
?page=1&size=20
```

La respuesta tendrá la siguiente estructura:

```json
{
  "items": [],
  "page": 1,
  "size": 20,
  "total": 0
}
```

El valor máximo de `size` será 50.

### 1.3. Estructura uniforme de errores

Todos los errores HTTP se representarán mediante:

```json
{
  "code": "ARTICLE_NOT_AVAILABLE",
  "message": "No hay unidades disponibles del artículo solicitado.",
  "details": [
    {
      "field": "items[0].article_id",
      "issue": "Sin unidades disponibles"
    }
  ]
}
```

`details` podrá ser un arreglo vacío.

Las respuestas no mostrarán contraseñas, consultas SQL, trazas internas, rutas del servidor ni información sensible.

### 1.4. Códigos de estado HTTP

| Estado | Significado |
|---|---|
| 200 | Operación exitosa |
| 201 | Recurso creado |
| 204 | Operación exitosa sin contenido |
| 401 | Autenticación inválida o ausente |
| 403 | Rol insuficiente |
| 404 | Recurso inexistente o desactivado |
| 409 | Conflicto de negocio |
| 422 | Error de validación |

---

## 2. Códigos de error de negocio

| Código | HTTP | Descripción |
|---|---|---|
| `INVALID_CREDENTIALS` | 401 | Credenciales incorrectas |
| `FORBIDDEN_ROLE` | 403 | Rol sin autorización |
| `NOT_FOUND` | 404 | Recurso inexistente |
| `USERNAME_TAKEN` | 409 | Nombre de usuario duplicado |
| `REFERENCE_TAKEN` | 409 | Referencia de artículo duplicada |
| `DOCUMENT_TAKEN` | 409 | Documento de vecino duplicado |
| `ARTICLE_HAS_OPEN_LOANS` | 409 | Artículo con préstamos pendientes |
| `ARTICLE_NOT_AVAILABLE` | 409 | Artículo sin unidades disponibles |
| `NEIGHBOR_HAS_OVERDUE` | 409 | Vecino con artículos vencidos |
| `ITEM_ALREADY_RETURNED` | 409 | Línea de préstamo ya devuelta |
| `NEIGHBOR_LIMIT_EXCEEDED` | 422 | Vecino supera el máximo de tres artículos |
| `DUPLICATE_ARTICLE_IN_LOAN` | 422 | Artículo repetido en el mismo préstamo |
| `VALIDATION_ERROR` | 422 | Datos inválidos |
| `INVALID_DATE_RANGE` | 422 | Rango de fechas incorrecto |

Los códigos se utilizarán de forma consistente en los controladores y pruebas automatizadas.

---

## 3. Endpoints

Todas las rutas descritas en esta sección utilizan el prefijo `/api/v1`.

### 3.1. Autenticación y salud

| Método | Ruta | Rol | Función |
|---|---|---|---|
| POST | `/auth/login` | Público | Iniciar sesión |
| GET | `/health` | Público | Comprobar estado de la API |

#### POST `/auth/login`

Petición:

```json
{
  "username": "operator1",
  "password": "example_password"
}
```

Respuesta HTTP 200:

```json
{
  "access_token": "eyJ...",
  "token_type": "Bearer",
  "expires_in": 28800,
  "role": "operator"
}
```

El token tendrá una duración de ocho horas.

Las credenciales inválidas generarán HTTP 401.

#### GET `/health`

Respuesta HTTP 200:

```json
{
  "status": "ok"
}
```

### 3.2. Usuarios

| Método | Ruta | Rol | Función |
|---|---|---|---|
| POST | `/users` | `admin` | Registrar un operador |

#### POST `/users`

Petición:

```json
{
  "username": "operator2",
  "password": "example_password",
  "role": "operator"
}
```

Respuesta HTTP 201:

```json
{
  "id": "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  "username": "operator2",
  "role": "operator"
}
```

Reglas:

- Solamente el administrador puede crear operadores.
- El nombre de usuario debe ser único.
- El nombre se normaliza a minúsculas y sin espacios exteriores.
- La API no permite crear usuarios con rol `admin`.
- Las contraseñas nunca se devuelven en las respuestas.

### 3.3. Categorías

| Método | Ruta | Rol | Función |
|---|---|---|---|
| GET | `/categories` | Autenticado | Consultar categorías |

#### GET `/categories`

Respuesta HTTP 200:

```json
[
  {
    "id": "11111111-1111-4111-8111-111111111111",
    "name": "ollas"
  },
  {
    "id": "22222222-2222-4222-8222-222222222222",
    "name": "vajilla"
  },
  {
    "id": "33333333-3333-4333-8333-333333333333",
    "name": "cubiertos"
  },
  {
    "id": "44444444-4444-4444-8444-444444444444",
    "name": "hornillas"
  },
  {
    "id": "55555555-5555-4555-8555-555555555555",
    "name": "manteles"
  }
]
```

Las categorías son fijas, sembradas inicialmente y ordenadas por nombre en la respuesta.

### 3.4. Artículos

| Método | Ruta | Rol | Función |
|---|---|---|---|
| GET | `/articles` | Autenticado | Buscar artículos |
| GET | `/articles/{id}` | Autenticado | Consultar artículo |
| POST | `/articles` | `admin` | Crear artículo |
| PUT | `/articles/{id}` | `admin` | Actualizar artículo |
| DELETE | `/articles/{id}` | `admin` | Desactivar artículo |
| PUT | `/articles/{id}/cover` | `admin` | Cargar imagen |
| DELETE | `/articles/{id}/cover` | `admin` | Eliminar imagen |
| GET | `/articles/{id}/cover` | Autenticado | Obtener imagen |

#### GET `/articles`

Parámetros disponibles:

- `q`: búsqueda por nombre o descripción.
- `category_id`: filtro por categoría.
- `page`: número de página.
- `size`: registros por página.

Ejemplo:

```http
GET /api/v1/articles?q=olla&page=1&size=20
```

La respuesta utiliza la estructura de paginación establecida en la sección 1.2.

#### GET `/articles/{id}`

Respuesta HTTP 200:

```json
{
  "id": "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  "name": "Olla grande",
  "description": "Olla de aluminio para eventos",
  "reference": "OLL-001",
  "category": {
    "id": "11111111-1111-4111-8111-111111111111",
    "name": "ollas"
  },
  "total_units": 10,
  "available_units": 8,
  "cover_key": null
}
```

#### POST `/articles`

Petición:

```json
{
  "name": "Olla grande",
  "description": "Olla de aluminio para eventos",
  "reference": "OLL-001",
  "category_id": "11111111-1111-4111-8111-111111111111",
  "total_units": 10
}
```

Respuesta HTTP 201: artículo creado con el formato definido anteriormente.

Las unidades disponibles se inicializan automáticamente con el mismo valor de las unidades totales.

#### PUT `/articles/{id}`

Permite actualizar el nombre, la descripción, la categoría y el total de unidades.

La referencia del artículo permanece inmutable después de su creación.

Al modificar `total_units`, la disponibilidad se ajusta por la misma diferencia. Si el cambio provoca disponibilidad negativa, se responde HTTP 422.

#### DELETE `/articles/{id}`

Realiza una baja lógica mediante `deleted_at`.

Respuesta exitosa: HTTP 204.

Si el artículo tiene préstamos abiertos, se devuelve HTTP 409 con código `ARTICLE_HAS_OPEN_LOANS`.

#### PUT `/articles/{id}/cover`

Recibe `multipart/form-data` con el campo `file`.

Restricciones:

- JPG o PNG.
- Máximo 2 MB.
- Validación del contenido del archivo.
- Almacenamiento mediante clave opaca.

#### DELETE `/articles/{id}/cover`

Elimina la referencia a la imagen y posteriormente el archivo físico.

Respuesta exitosa: HTTP 204.

#### GET `/articles/{id}/cover`

Devuelve el contenido binario de la imagen con su tipo MIME correspondiente.

Si no existe imagen, responde HTTP 404.

### 3.5. Vecinos

| Método | Ruta | Rol | Función |
|---|---|---|---|
| GET | `/neighbors` | `admin`, `operator` | Listar vecinos |
| GET | `/neighbors/{id}` | `admin`, `operator` | Consultar vecino |
| POST | `/neighbors` | `admin`, `operator` | Registrar vecino |

#### POST `/neighbors`

Petición:

```json
{
  "full_name": "Carlos Perez",
  "document_number": "1234567890"
}
```

Respuesta HTTP 201:

```json
{
  "id": "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  "full_name": "Carlos Perez",
  "document_number": "1234567890"
}
```

El documento debe ser único. Los duplicados responden HTTP 409 con código `DOCUMENT_TAKEN`.

#### GET `/neighbors`

Permite buscar por nombre o documento mediante `q`.

Admite `page` y `size` y devuelve la respuesta paginada.

#### GET `/neighbors/{id}`

Devuelve los datos del vecino e incluye `active_loans`, que representa el número de líneas de artículos pendientes de devolución.

Ejemplo:

```json
{
  "id": "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  "full_name": "Carlos Perez",
  "document_number": "1234567890",
  "active_loans": 2
}
```

Los vecinos no tienen operaciones de eliminación.

### 3.6. Préstamos y devoluciones

| Método | Ruta | Rol | Función |
|---|---|---|---|
| POST | `/loans` | `admin`, `operator` | Registrar préstamo |
| GET | `/loans` | `admin`, `operator` | Listar préstamos |
| GET | `/loans/{id}` | `admin`, `operator` | Consultar préstamo |
| POST | `/loans/{loan_id}/items/{item_id}/return` | `admin`, `operator` | Registrar devolución |
| GET | `/loans/overdue` | `admin`, `operator` | Consultar vencidos |

#### POST `/loans`

Petición:

```json
{
  "neighbor_id": "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  "items": [
    {
      "article_id": "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
    },
    {
      "article_id": "cccccccc-cccc-4ccc-8ccc-cccccccccccc"
    }
  ]
}
```

Respuesta HTTP 201:

```json
{
  "id": "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
  "neighbor_id": "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  "loaned_at": "2026-11-12T14:00:00Z",
  "status": "open",
  "items": [
    {
      "id": "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
      "article_id": "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      "article_name": "Olla grande",
      "article_reference": "OLL-001",
      "category_name": "ollas",
      "due_at": "2026-11-15T14:00:00Z",
      "returned_at": null
    },
    {
      "id": "ffffffff-ffff-4fff-8fff-ffffffffffff",
      "article_id": "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
      "article_name": "Juego de platos",
      "article_reference": "VAJ-001",
      "category_name": "vajilla",
      "due_at": "2026-11-15T14:00:00Z",
      "returned_at": null
    }
  ]
}
```

Reglas:

- Un préstamo pertenece a un solo vecino.
- Cada operación contiene de una a tres líneas.
- Cada línea corresponde a una unidad.
- Un artículo no puede repetirse dentro del mismo préstamo.
- El máximo es tres artículos pendientes por vecino.
- Un vecino con artículos vencidos no recibe nuevos préstamos.
- La fecha límite es tres días después de `loaned_at`.
- El descuento de unidades y el registro del préstamo son atómicos.

Si no hay unidades disponibles, se responde HTTP 409 y no se registra ningún cambio parcial.

#### GET `/loans`

Parámetros:

- `from`: fecha inicial.
- `to`: fecha final.
- `status`: `open`, `overdue` o `closed`.
- `neighbor_id`: filtro por vecino.
- `page`: número de página.
- `size`: cantidad de resultados.

Los préstamos se ordenarán por fecha descendente.

#### GET `/loans/{id}`

Devuelve los datos del préstamo, sus líneas y su estado calculado.

Los estados son:

- `open`: existen líneas pendientes y ninguna está vencida.
- `overdue`: existe por lo menos una línea pendiente vencida.
- `closed`: todas las líneas están devueltas.

El estado se calcula y no se almacena en la base de datos.

#### POST `/loans/{loan_id}/items/{item_id}/return`

Registra la devolución de una línea.

Respuesta HTTP 200:

```json
{
  "id": "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
  "article_id": "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  "article_name": "Olla grande",
  "article_reference": "OLL-001",
  "category_name": "ollas",
  "due_at": "2026-11-15T14:00:00Z",
  "returned_at": "2026-11-14T10:30:00Z"
}
```

La devolución incrementa una unidad disponible.

Si la línea ya estaba devuelta, responde HTTP 409 con código `ITEM_ALREADY_RETURNED`.

#### GET `/loans/overdue`

Devuelve las líneas de préstamo pendientes cuya fecha `due_at` sea anterior al instante actual.

Ejemplo de respuesta:

```json
{
  "items": [
    {
      "loan_id": "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
      "item_id": "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
      "article_name": "Olla grande",
      "neighbor_name": "Carlos Perez",
      "due_at": "2026-11-09T14:00:00Z",
      "days_late": 3
    }
  ]
}
```

Los resultados se ordenan por mayor cantidad de días de retraso.

El nombre del vecino se muestra únicamente a los usuarios autorizados en esta consulta operativa.

### 3.7. Reporte de artículos más solicitados

| Método | Ruta | Rol | Función |
|---|---|---|---|
| GET | `/reports/most-borrowed` | `admin` | Obtener artículos más solicitados |

#### GET `/reports/most-borrowed`

Requiere los parámetros `from` y `to`, que representan fechas inclusivas.

Ejemplo:

```http
GET /api/v1/reports/most-borrowed?from=2026-11-01&to=2026-11-30
```

Respuesta HTTP 200:

```json
{
  "from": "2026-11-01",
  "to": "2026-11-30",
  "rows": [
    {
      "article_id": "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      "article_name": "Olla grande",
      "category_name": "ollas",
      "times_borrowed": 12
    }
  ]
}
```

El reporte agrupa por artículo, nombre histórico y categoría histórica.

Los resultados se ordenan por `times_borrowed` de mayor a menor y después por nombre de artículo.

Los valores históricos no cambian cuando se modifica el catálogo.

El reporte no muestra información de vecinos ni operadores.

Si el rango de fechas es inválido, responde HTTP 422 con código `INVALID_DATE_RANGE`.

Si no existen préstamos para el periodo, `rows` será un arreglo vacío.

---

## 4. Seguridad

| Elemento | Regla |
|---|---|
| Autenticación | JWT firmado |
| Duración del token | Ocho horas |
| Contenido del token | `sub` y `role`, sin datos personales adicionales |
| Contraseñas | Hash seguro, nunca texto plano en persistencia |
| Autorización | Comprobación del rol en cada endpoint |
| Acceso no autorizado | HTTP 401 o 403 |
| CORS | Únicamente el origen configurado para React |
| Imágenes | JPG y PNG, máximo 2 MB |
| Errores | Sin trazas ni datos sensibles |
| Fechas | ISO 8601 en UTC |
| Transporte | HTTPS en despliegues públicos |

Las contraseñas y secretos se proporcionarán mediante variables de entorno.

Un error HTTP 403 no revelará información sobre la existencia de recursos protegidos.

---

## 5. Verificación del contrato

El contrato se comprobará mediante pruebas automatizadas de Laravel y pruebas de integración.

Las verificaciones incluirán:

1. Existencia de los 21 endpoints definidos.
2. Métodos HTTP correctos.
3. Autenticación y autorización por roles.
4. Estructuras JSON de petición y respuesta.
5. Paginación y filtros.
6. Códigos de error de negocio.
7. Validación de referencias y documentos únicos.
8. Límite de tres artículos pendientes por vecino.
9. Bloqueo de préstamos para vecinos con vencimientos.
10. Devoluciones sin duplicación de inventario.
11. Conservación de los datos históricos.
12. Control de concurrencia con HTTP 409.
13. Reportes agregados por fechas.
14. Protección de información sensible.

La aplicación React utilizará exclusivamente los endpoints definidos en este contrato.

No se crearán rutas HTTP adicionales sin actualizar y aprobar previamente la especificación.

El cumplimiento del contrato deberá demostrarse mediante pruebas automatizadas y la ejecución del sistema durante la sustentación individual.
