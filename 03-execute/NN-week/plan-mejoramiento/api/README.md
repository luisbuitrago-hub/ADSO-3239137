# API — Kitchenware

**Proyecto:** Sistema de Préstamo de Menaje de un Salón Comunal  
**Dominio:** kitchenware  
**Ficha:** ADSO 3239137  
**Aprendiz:** A16

## Propósito

El backend de Kitchenware tiene como propósito proporcionar una API REST para gestionar los artículos de menaje de un salón comunal, los vecinos registrados, los préstamos, las devoluciones y los reportes.

La API se diseña con PHP y Laravel, siguiendo los requisitos funcionales y técnicos establecidos en la documentación del proyecto.

## Tecnologías

- PHP 8.4 o superior compatible con Composer
- Laravel
- PostgreSQL 16
- Composer
- PHPUnit

## Documentación de referencia

Las especificaciones del backend se encuentran en `../docs/`:

- `constitution.md`: principios técnicos y reglas arquitectónicas.
- `spec.md`: historias de usuario y reglas de negocio.
- `plan.md`: decisiones técnicas y estrategia de desarrollo.
- `architecture.md`: organización de capas y dependencias.
- `data-model.md`: tablas, relaciones y restricciones.
- `api-contract.md`: endpoints, autenticación y respuestas HTTP.
- `tasks.md`: tareas de implementación y criterios de verificación.

Las decisiones arquitectónicas complementarias se encuentran en `../docs/adr/`.

## Arquitectura

Kitchenware utiliza como arquitectura de referencia el enfoque hexagonal de puertos y adaptadores, dividido en:

- **Domain:** entidades, objetos de valor y reglas de negocio.
- **Application:** casos de uso y definición de puertos.
- **Infrastructure:** persistencia, seguridad y almacenamiento.
- **HTTP:** controladores, rutas y validaciones.

Las dependencias del dominio se mantienen independientes de los frameworks y de la base de datos.

## Contrato HTTP

La API utiliza el prefijo:

`/api/v1`

Los endpoints, sus métodos HTTP, los permisos de acceso y los formatos de respuesta se definen en `../docs/api-contract.md`.

### Endpoint de salud

**Ruta:** `GET /api/v1/health`

**Respuesta esperada:**

```json
{
  "status": "ok"
}
```

## Imágenes y reporte histórico (bloque 6)

Los 21 endpoints del contrato están implementados. La evidencia y las limitaciones
de la verificación se detallan en [BACKEND_AUDIT.md](BACKEND_AUDIT.md).

- `PUT /api/v1/articles/{id}/cover`: administrador; cuerpo `multipart/form-data`
  con campo `file`; devuelve HTTP 200 con el artículo actualizado.
- `DELETE /api/v1/articles/{id}/cover`: administrador; devuelve HTTP 204.
- `GET /api/v1/articles/{id}/cover`: administrador u operador; devuelve los bytes
  con el MIME validado, o HTTP 404 si el artículo o su imagen no están disponibles.
- `GET /api/v1/reports/most-borrowed?from=AAAA-MM-DD&to=AAAA-MM-DD`:
  administrador; devuelve las filas históricas, o una lista vacía.

La carga acepta únicamente contenido JPG/PNG válido de hasta 2.097.152 bytes.
No utiliza el nombre original: genera claves aleatorias opacas y almacena los
archivos en el disco privado `covers`, por defecto `storage/app/covers`.
`COVERS_DIR` permite configurar un directorio absoluto privado y escribible;
no debe estar dentro de un directorio publicado por el servidor web. No se
requiere un enlace público de almacenamiento. Se deshabilitan las rutas
automáticas de publicación del disco local: las descargas pasan por JWT y roles.

PHP 8.4 es el mínimo declarado porque permite procesar un PUT multipart real
mediante el soporte nativo utilizado por Symfony. La integración comprueba esa
solicitud por HTTP real, además del cliente de pruebas de Laravel.

El reemplazo guarda el archivo nuevo antes de cambiar la referencia bajo bloqueo.
El archivo anterior se elimina después del commit; un rollback retira el nuevo.
La eliminación también espera al commit. No se modifican inventario ni snapshots.
PostgreSQL y el sistema de archivos no comparten una transacción distribuida:
una caída del proceso o un fallo al eliminar después del commit puede dejar un
archivo privado huérfano. Ese fallo responde con un error genérico y conserva la
referencia ya confirmada; si fue un reemplazo, conserva también su imagen nueva.
La recuperación de esos huérfanos queda como procedimiento operativo pendiente.

El reporte filtra por fecha del préstamo usando días inclusivos en UTC
(`from` incluido, día siguiente a `to` excluido). Agrupa por UUID del artículo,
nombre y categoría históricos, cuenta líneas, incluye artículos desactivados y
ordena por cantidad descendente y nombre ascendente, con desempates estables.
Un rango invertido o una fecha inválida devuelve HTTP 422. No consulta los nombres
actuales del catálogo ni expone datos personales de vecinos.

## Reglas fundamentales

- Un vecino puede tener como máximo tres artículos pendientes de devolución.
- Los préstamos tienen una duración de tres días.
- Los vecinos con artículos vencidos no pueden recibir nuevos préstamos.
- Las unidades disponibles deben permanecer entre cero y el total.
- Los préstamos conservan los datos históricos de los artículos.
- Las devoluciones se registran individualmente.
- Las fechas se gestionan en UTC.
- Los mensajes dirigidos al usuario se presentan en español.
- Las operaciones concurrentes deben proteger la disponibilidad del inventario.

## Seguridad

La API contempla autenticación mediante JWT, autorización por roles y almacenamiento seguro de contraseñas.

Los secretos y las credenciales se gestionan mediante variables de entorno.

Los archivos que contienen credenciales reales no deben incorporarse al repositorio.

### Inicialización del administrador

Configura localmente `ADMIN_USERNAME`, `ADMIN_PASSWORD`, `JWT_SECRET` y
`CORS_ORIGIN`. La plantilla `.env.example` no contiene credenciales iniciales.
`JWT_SECRET` debe ser una clave aleatoria adecuada para el algoritmo de firma;
para HS256 utiliza al menos 32 bytes. `CORS_ORIGIN` admite el origen exacto del
frontend, sin comodines; si falta, no se permite ningún origen del navegador.

Después de preparar las migraciones, el paso de inicialización del despliegue es:

```bash
php artisan kitchenware:initialize-admin
```

En producción requiere `--force`. El comando toma las credenciales exclusivamente
de la configuración del entorno: no acepta contraseñas como argumentos y no las
imprime. Es idempotente: conserva el hash del administrador existente y no cambia
su contraseña aunque cambie `ADMIN_PASSWORD`. Rechaza elevar un operador existente
o crear otro administrador cuando ya existe uno con un nombre diferente.
Si faltan las variables o hay conflicto, termina con código de error.

`composer setup` incluye este paso después de preparar la base para instalaciones
nuevas. `DatabaseSeeder` utiliza la misma inicialización, sin usuarios de muestra
ni contraseñas predeterminadas. Estas operaciones escriben en la base configurada:
ejecútalas solo como parte del despliegue que corresponda. Las pruebas las ejecutan
exclusivamente sobre SQLite en memoria o PostgreSQL temporal.

### Contrato de autenticación y operadores

- `POST /api/v1/auth/login` es público y devuelve `access_token`,
  `token_type: Bearer`, `expires_in: 28800` y `role`.
- La duración es de ocho horas y no se modifica mediante `JWT_TTL`. El JWT incluye
  `sub`, `role` y las claims técnicas de firma/tiempo, sin nombres ni credenciales.
- Los nombres de usuario se convierten a minúsculas y se recortan en sus extremos
  al iniciar sesión, crear operadores e inicializar el administrador.
- `POST /api/v1/users` requiere `Authorization: Bearer <token>` y rol `admin`.
  Solo crea `operator`, devuelve HTTP 201 con `id`, `username`, `role` y asigna UUID v4.
- Los nombres repetidos normalizados producen `409 USERNAME_TAKEN`, incluso si
  la restricción de PostgreSQL detecta una colisión después de la consulta previa.
- Intentar crear un `admin` produce `422 VALIDATION_ERROR`; un operador recibe
  `403 FORBIDDEN_ROLE` antes de validar el cuerpo de la solicitud.
- La autorización consulta el rol vigente del usuario en persistencia. Un token
  ausente, malformado, vencido o inválido produce HTTP 401; no se aceptan tokens
  mediante parámetros de consulta. No existe `/auth/me` porque no está documentado.
- Las contraseñas se protegen con BCrypt y se conservan sus espacios. La creación
  admite hasta 72 bytes para evitar truncamiento de BCrypt, incluidos caracteres
  multibyte. No se devuelven contraseñas ni hashes.
- Los errores de `/api/*` usan `code`, `message` en español y `details` como arreglo,
  incluso sin `Accept: application/json`. Los errores inesperados no muestran
  trazas ni SQL aun con depuración activada; sus logs solo contienen una etiqueta
  genérica y el tipo de excepción, sin argumentos ni credenciales.

Los casos de uso de seguridad dependen de puertos de usuarios, hashing, tokens
e identificadores. Sus adaptadores Laravel se enlazan en `AppServiceProvider`.
Los seis modelos y las migraciones existentes se conservan.

## Catálogo de categorías y artículos

El catálogo utiliza las cinco categorías y las tablas existentes del esquema
`kitchenware`; no agrega migraciones ni operaciones de mantenimiento de categorías.

| Método | Ruta bajo `/api/v1` | Roles |
|---|---|---|
| GET | `/categories` | `admin`, `operator` |
| GET | `/articles` | `admin`, `operator` |
| GET | `/articles/{id}` | `admin`, `operator` |
| POST | `/articles` | `admin` |
| PUT | `/articles/{id}` | `admin` |
| DELETE | `/articles/{id}` | `admin` |

Todas requieren JWT Bearer. Las categorías se ordenan por nombre. La búsqueda
admite `q` por nombre o descripción parcial, `category_id`, `page` y `size`.
La paginación predeterminada es `page=1&size=20`; tamaños mayores de 50 o
parámetros inválidos producen HTTP 422. La respuesta es `items`, `page`, `size`
y `total`, ordenada por nombre e identificador para estabilizar los empates.
La búsqueda trata `%`, `_` y `!` como texto literal, sin interpolar entradas SQL.
Solo se muestran artículos activos; los inexistentes o desactivados producen 404.

El registro recibe `name`, `description`, `reference`, `category_id` y
`total_units`. Genera UUID v4 e inicializa `available_units` con el mismo total.
Se verifican las longitudes del modelo, categoría existente y total entero
positivo compatible con PostgreSQL. La referencia es única entre artículos
activos: un duplicado produce `409 REFERENCE_TAKEN`, también ante una colisión
detectada directamente por el índice único de PostgreSQL.

La actualización conserva campos omitidos y permite cambiar nombre, descripción,
categoría y total. La referencia permanece inmutable: un valor distinto produce
422; enviar el mismo valor no la modifica. El cliente no puede asignar `id`,
`available_units`, `cover_key` ni `deleted_at`, tampoco enviándolos como `null`.
Al variar el total, la disponibilidad cambia por la misma diferencia. Si quedan
unidades prestadas sin respaldo, se rechaza toda la actualización con 422,
conservando también los metadatos anteriores.

Las actualizaciones y bajas utilizan transacciones con bloqueo de la fila del
artículo antes de validar su estado. La baja consulta `loan_item.returned_at`:
si existen líneas pendientes, responde `409 ARTICLE_HAS_OPEN_LOANS`; en otro caso
registra `deleted_at` en UTC y responde 204 sin eliminar físicamente el artículo.
Las líneas históricas no se actualizan ni eliminan. Una referencia puede reutilizarse
en otro artículo después de la baja, conservando la identidad del artículo histórico.

Las pruebas rápidas emplean SQLite en memoria. La integración usa las migraciones
reales en PostgreSQL temporal y verifica los seis endpoints, bloqueos, conflictos,
inventario e historial. Los préstamos pendientes/devueltos se preparan mediante
fixtures exclusivamente en esa base de pruebas: no se implementan endpoints de
préstamos ni devoluciones en este bloque. Cuando se desarrollen, deberán bloquear
los mismos artículos y revalidar su estado activo, conforme al ADR-002; entonces
se verificará la carrera entre préstamo, actualización y baja.

También se mide una búsqueda con 5.000 artículos sintéticos contra el cliente HTTP
de pruebas de Laravel, con un límite de 300 ms. Esa medición local no incluye red
ni sustituye la validación posterior del despliegue con el sembrador HTTP.
Las operaciones de imágenes quedan para su bloque correspondiente; este bloque
solo conserva el `cover_key` existente.

## Gestión de vecinos

| Método | Ruta bajo `/api/v1` | Roles |
|---|---|---|
| GET | `/neighbors` | `admin`, `operator` |
| GET | `/neighbors/{id}` | `admin`, `operator` |
| POST | `/neighbors` | `admin`, `operator` |

Los tres endpoints requieren JWT Bearer y conservan los errores uniformes del
contrato. No existen operaciones HTTP para actualizar o eliminar vecinos.

El registro recibe `full_name` y `document_number`, asigna UUID v4 y devuelve
únicamente `id`, `full_name` y `document_number` con HTTP 201. El nombre es texto
obligatorio de hasta 200 caracteres; el documento, texto obligatorio de hasta 30.
Se recortan espacios exteriores en ambos. La documentación no define un patrón
numérico ni eliminación de separadores: el documento conserva ceros iniciales,
letras, mayúsculas, espacios interiores y separadores. No se convierte a número.
La unicidad sigue la restricción existente de PostgreSQL, sensible a mayúsculas.

Un documento repetido tras recortar espacios produce `409 DOCUMENT_TAKEN`,
sin reemplazar los datos del vecino anterior. El adaptador traduce también una
colisión detectada por el índice único después de la consulta previa y conserva
la transacción exterior mediante un savepoint. Los campos `id` y `active_loans`
no pueden asignarse en el registro. El vecino no obtiene credenciales de acceso.

La búsqueda admite `q` parcial por nombre o documento, sin distinguir mayúsculas
en PostgreSQL, y paginación `page`/`size` (1 y 20 por defecto, máximo 50 por página).
La respuesta contiene `items`, `page`, `size` y `total`. El orden es por nombre y
UUID para estabilizar los empates. Los comodines `%`, `_` y `!` se buscan como
texto literal. Los parámetros inválidos producen 422; los listados sin resultados
devuelven un arreglo vacío.

El detalle agrega `active_loans`: número de líneas de `loan_item` con
`returned_at IS NULL`, pertenecientes a todos los préstamos del vecino. Incluye
líneas vencidas y pendientes futuras, excluye devoluciones y préstamos de otras
personas, y devuelve cero cuando no hay pendientes. No es un conteo de préstamos.
El adaptador obtiene identidad y conteo en una sola consulta SQL, sin depender
del estado actual de los artículos ni añadir columnas calculadas. Un vecino
inexistente o un identificador de ruta inválido produce `404 NOT_FOUND`.

Las pruebas de dominio y aplicación se ejecutan sin base de datos; las HTTP
rápidas utilizan SQLite en memoria. La integración verifica el contrato y las
restricciones sobre las migraciones PostgreSQL reales en el contenedor temporal.
Las fixtures de préstamos son exclusivas de pruebas y se comparan antes y después
de consultar el detalle para comprobar que no cambió el historial. No se agregan
funcionalidades de préstamos ni devoluciones en este bloque.

## Préstamos, devoluciones y vencimientos

| Método | Ruta bajo `/api/v1` | Roles |
|---|---|---|
| POST | `/loans` | `admin`, `operator` |
| GET | `/loans` | `admin`, `operator` |
| GET | `/loans/{id}` | `admin`, `operator` |
| POST | `/loans/{loan_id}/items/{item_id}/return` | `admin`, `operator` |
| GET | `/loans/overdue` | `admin`, `operator` |

El registro recibe `neighbor_id` y una lista `items` de una a tres líneas,
cada una con `article_id`. Cada línea representa una unidad. Los identificadores
repetidos, incluso variando mayúsculas, producen `422 DUPLICATE_ARTICLE_IN_LOAN`.
La API genera UUID v4, toma el usuario autenticado y registra las fechas en UTC;
el cliente no puede asignar `loaned_at`, `loaned_by_user_id`, `id` ni `status`.

Cada vecino mantiene un máximo de tres líneas pendientes entre todos sus
préstamos (`422 NEIGHBOR_LIMIT_EXCEEDED`). Si alguna está vencida, se rechaza
el préstamo con `409 NEIGHBOR_HAS_OVERDUE`. Los artículos inexistentes o inactivos
producen 404; la falta de inventario, `409 ARTICLE_NOT_AVAILABLE`.
La fecha límite de cada línea es exactamente tres días en UTC después del préstamo.
Al registrar las líneas se copian nombre, referencia y categoría del catálogo.
Los cambios posteriores y la baja lógica no alteran esos valores históricos.

El préstamo ejecuta una transacción: bloquea primero al vecino y después los
artículos en orden de UUID, vuelve a comprobar vencimientos tras la espera,
descuenta unidades y guarda préstamo y líneas. Cualquier fallo revierte todo,
incluidas escrituras ya realizadas. Se reutiliza el gestor transaccional existente.

La devolución verifica que la línea pertenezca al préstamo, bloquea vecino,
artículo y línea en ese orden, y vuelve a comprobar `returned_at` bajo bloqueo.
Actualiza únicamente esa fecha en la línea e incrementa una unidad disponible
dentro de la misma transacción. La escritura además exige `returned_at IS NULL`.
Una devolución repetida produce `409 ITEM_ALREADY_RETURNED`; ninguna devolución
puede superar el total. Un artículo histórico ya inactivo puede devolverse sin
reactivar su registro. No existen endpoints para editar o eliminar préstamos.

Los estados `open`, `overdue` y `closed` se calculan a partir de líneas y fechas,
sin columnas adicionales. En el instante exacto del vencimiento una línea sigue
abierta; pasa a vencida cuando `due_at` es anterior al instante de consulta.
La consulta de préstamos permite `neighbor_id`, `status`, `from`, `to`, `page`
y `size` (1/20 por defecto, máximo 50). Las fechas `AAAA-MM-DD` son inclusivas en
UTC; el rango invertido devuelve `422 INVALID_DATE_RANGE`. Los resultados se
ordenan por fecha descendente y UUID para estabilizar empates.

`/loans/overdue` está registrada antes de la ruta por UUID y devuelve únicamente
líneas pendientes vencidas, con nombre histórico, vecino y `days_late` calculado
en períodos completos de 24 horas. Se ordena por vencimiento más antiguo primero.
No se implementan imágenes ni reportes en este bloque.

### Verificación de concurrencia del ADR-002

Además de `composer test`, ejecuta desde `api/`:

```bash
composer test:integration
composer test:integration -- --filter LoanConcurrencyTest
```

Las pruebas funcionales HTTP se ejecutan tanto en SQLite en memoria como en
PostgreSQL real. SQLite no se utiliza para acreditar concurrencia. Cada prueba
concurrente crea una base `kitchenware_concurrency_*` dentro del contenedor
temporal del runner, aplica las seis migraciones y utiliza fixtures confirmadas.
La conexión se restringe al usuario de pruebas, localhost y al puerto temporal;
no se reutiliza la base de desarrollo. Al terminar se cierran los procesos y
se elimina exclusivamente esa base desechable; el runner elimina su contenedor.

Dos procesos PHP ejecutan peticiones mediante el kernel HTTP de Laravel, con
autenticación JWT, operadores distintos y conexiones PostgreSQL independientes.
Una conexión de control retiene una fila hasta observar ambas peticiones activas
esperando bloqueos en `pg_stat_activity`; después libera la compuerta. Las pruebas
fallan si no observan esa superposición o si los resultados no cumplen el ADR.

- Última unidad: exactamente HTTP 201 y 409; inventario cero y una línea pendiente.
- Mismo vecino con dos pendientes: HTTP 201 y 422; exactamente tres pendientes.
- Misma devolución: HTTP 200 y 409; disponibilidad incrementada exactamente una vez.
- Atomicidad: un préstamo con disponibilidad parcial recibe 409, sin préstamos ni
  líneas nuevas y con el inventario original conservado.

También se prueban préstamo contra baja lógica, préstamo contra reducción de total,
y un fallo simulado al insertar la segunda línea después de guardar préstamo y
primera línea: ninguna escritura parcial sobrevive. Las pruebas imprimen evidencia
resumida de las cuatro verificaciones del ADR, sin tokens ni credenciales.

## Pruebas y verificación

### Preparación reproducible de PostgreSQL

Requisitos: PHP con `pdo_pgsql`, dependencias Composer instaladas y una base
PostgreSQL 16 disponible. Para levantar PostgreSQL mediante Docker, consulta
[`../infra/README.md`](../infra/README.md).

Configura localmente las variables `DB_CONNECTION=pgsql`, `DB_HOST`, `DB_PORT`,
`DB_DATABASE`, `DB_USERNAME` y `DB_PASSWORD` según tu instalación. No publiques
el archivo `.env`. El usuario debe poder crear esquemas en esa base.

En una instalación nueva, ejecuta desde `api/`:

```bash
php artisan kitchenware:prepare-database
```

El comando crea `kitchenware` si no existe **antes** de ejecutar `migrate`,
incluida la creación de la tabla interna `migrations`. Después aplica solamente
las migraciones pendientes: las seis tablas del negocio y las cinco categorías
iniciales. No ejecuta `migrate:fresh`, no borra tablas y no llama a `db:seed`.
En producción requiere `--force` antes de realizar cualquier cambio.

Puede repetirse sin recrear tablas ni duplicar categorías. En una instalación
existente con las seis migraciones aplicadas, no es necesario volver a ejecutarlo
para adoptar estos cambios. No se han modificado las migraciones históricas.

El esquema **es fijo: `kitchenware`**, conforme a `data-model.md` y ADR-001.
`DB_SCHEMA` ya no configura la conexión; elimina esa variable de tus plantillas
locales si la utilizabas. Así, las consultas de Laravel y el SQL explícito de las
migraciones siempre utilizan el mismo esquema. No se permite cambiar el esquema
mediante este procedimiento. Las conexiones PostgreSQL trabajan en UTC.

La configuración de ejemplo usa sesiones y caché en archivos y cola síncrona,
por lo que no requiere tablas auxiliares ajenas al modelo.

### Pruebas rápidas y pruebas PostgreSQL aisladas

Desde `api/`:

```bash
composer test
composer test:integration
```

`composer test` ejecuta Unit y Feature con SQLite en memoria, sin borrar cachés
de configuración. La configuración de PHPUnit fuerza los valores de aislamiento
para evitar que variables del entorno seleccionen la base de desarrollo.

`composer test:integration` requiere Docker Compose con soporte de `up --wait`.
Inicia un proyecto Compose exclusivo por ejecución, PostgreSQL 16 en un puerto
local asignado automáticamente y almacenamiento temporal en memoria. Siempre
detiene y elimina únicamente ese proyecto de pruebas al finalizar.

La conexión `pgsql_testing` tiene base y usuario fijos `kitchenware_test`, no
hereda `DB_URL` ni las credenciales de desarrollo y solo admite configurar
`TEST_DB_PORT`. Su contraseña pública es exclusivamente una credencial de la
instancia temporal; no debe utilizarse en desarrollo ni producción.

Las pruebas verifican la identidad real de la conexión y rechazan una base que
ya contenga el esquema `kitchenware`. Cada caso crea esquema y migraciones dentro
de una transacción y los revierte al terminar. Se ejecutan secuencialmente.
No utilizan `RefreshDatabase`, `migrate:fresh` ni reinician la base de desarrollo.

Ambas suites Laravel rechazan configuración cacheada para evitar conexiones
heredadas de otro entorno. En ese caso, usa un checkout de pruebas sin caché;
no es necesario modificar la configuración del backend en ejecución.

Cobertura del bloque de persistencia:

- Preparación desde una base sin esquema y repetición sin pérdida de datos.
- Seis migraciones, tablas y columnas, UUID, fechas con zona horaria y UTC.
- Categorías con sus cinco identificadores exactos.
- Índices, claves foráneas y políticas de actualización/eliminación.
- Cantidades inválidas, roles, unicidad y referencia exclusiva entre activos.
- Artículos no repetidos en un préstamo y protección de registros referenciados.
- Rechazo del comando en conexiones incompatibles.

Las verificaciones del backend deben cubrir:

- Reglas del dominio.
- Casos de uso.
- Persistencia en PostgreSQL.
- Contrato de la API.
- Autenticación y autorización.
- Concurrencia de préstamos.
- Integridad de los datos históricos.
- Dependencias de la arquitectura hexagonal.

Los resultados de las pruebas permitirán comprobar el cumplimiento de las especificaciones del sistema.
