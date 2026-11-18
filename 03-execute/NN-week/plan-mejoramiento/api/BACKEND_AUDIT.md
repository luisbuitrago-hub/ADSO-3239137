# Verificación del backend Kitchenware

Fecha: 2026-11-16. Alcance: bloques 1–6, checkout local y entornos de pruebas
aislados. Este informe no sustituye los requisitos de `../docs/` ni acredita
un despliegue de producción. No se realizaron commits, push, cambios de ramas,
modificaciones de secretos reales ni operaciones sobre la base de desarrollo.

## Contrato: 21 endpoints

Todas las rutas siguientes están verificadas por pruebas automatizadas. Las rutas
son relativas a `/api/v1`; «ambos» significa `admin` y `operator` con JWT Bearer.
`ApiContractTest` comprueba el conjunto exacto de rutas, roles y rechazo sin token
de las 19 protegidas. Las suites funcionales y PostgreSQL comprueban los casos
de uso, restricciones, errores y persistencia.

| Método | Ruta | Acceso | Evidencia principal |
|---|---|---|---|
| POST | `/auth/login` | Público | LoginTest, TokenAuthorizationTest, SecurityPersistenceTest |
| GET | `/health` | Público | ExampleTest, ApiContractTest |
| POST | `/users` | Admin | CreateOperatorTest, SecurityPersistenceTest |
| GET | `/categories` | Ambos | CatalogQueriesTest, CategoriesTest |
| GET | `/articles` | Ambos | CatalogQueriesTest, CatalogPersistenceTest |
| GET | `/articles/{id}` | Ambos | CatalogQueriesTest, CatalogPersistenceTest |
| POST | `/articles` | Admin | ArticleWritesTest, CatalogPersistenceTest |
| PUT | `/articles/{id}` | Admin | ArticleWritesTest, CatalogPersistenceTest |
| DELETE | `/articles/{id}` | Admin | CatalogPermissionsAndDeletionTest, CatalogPersistenceTest |
| PUT | `/articles/{id}/cover` | Admin | ArticleCoverTest, CoverStorageIntegrationTest |
| DELETE | `/articles/{id}/cover` | Admin | ArticleCoverTest, CoverStorageIntegrationTest |
| GET | `/articles/{id}/cover` | Ambos | ArticleCoverTest, CoverStorageIntegrationTest |
| GET | `/neighbors` | Ambos | NeighborQueriesTest, NeighborPersistenceTest |
| GET | `/neighbors/{id}` | Ambos | NeighborQueriesTest, NeighborPersistenceTest |
| POST | `/neighbors` | Ambos | CreateNeighborTest, NeighborPersistenceTest |
| POST | `/loans` | Ambos | LoanEndpointsTest, LoanPersistenceTest, LoanConcurrencyTest |
| GET | `/loans` | Ambos | LoanEndpointsTest, LoanPersistenceTest |
| GET | `/loans/{id}` | Ambos | LoanEndpointsTest, LoanPersistenceTest |
| POST | `/loans/{loan_id}/items/{item_id}/return` | Ambos | LoanEndpointsTest, LoanPersistenceTest, LoanConcurrencyTest |
| GET | `/loans/overdue` | Ambos | LoanEndpointsTest, LoanPersistenceTest |
| GET | `/reports/most-borrowed` | Admin | MostBorrowedReportTest, MostBorrowedReportIntegrationTest |

No se agrega `/auth/me` ni un endpoint de almacenamiento público. Laravel conserva
sus rutas de arranque fuera de `/api/v1`; no son endpoints nuevos del contrato.

## Resultados ejecutados

| Comprobación | Resultado observado |
|---|---|
| `composer test` | 188 pruebas, 1.201 aserciones, 0 fallidas |
| `composer test:integration` | 80 pruebas, 798 aserciones, 0 fallidas |
| Total | 268 pruebas, 1.999 aserciones, 0 fallidas |
| Archivos `*Test.php` | 40; 38 excluyendo los dos ExampleTest; supera el mínimo de 15 archivos |
| Sintaxis PHP | 180 archivos propios, sin errores |
| `composer validate --no-check-publish` | Aprobado |
| `composer check-platform-reqs` | Aprobado con PHP 8.4.27 |
| `composer audit --locked --no-plugins --format=json` | Sin avisos de seguridad ni paquetes abandonados en la consulta realizada |
| Pint en app/bootstrap/config/routes/tests/factories/seeders | Aprobado |
| Pint global | Pendiente: estilo previo en tres migraciones históricas, sin modificar |
| `git diff --check` | Aprobado |

Las tres migraciones con observaciones de Pint son
`2026_11_14_025611_create_user_table.php`,
`2026_11_14_025755_create_loan_table.php` y
`2026_11_14_025923_create_loan_item_table.php` (posición de llaves, declaración
de clase y/o fin de archivo). Su sintaxis y ejecución PostgreSQL pasan. No se
modifican migraciones históricas por una corrección meramente estética.

Las pruebas rápidas usan SQLite en memoria; la integración inicia PostgreSQL 16
temporal, con identidad y credenciales exclusivas de prueba. Los casos que necesitan
commits y concurrencia crean bases independientes dentro de ese contenedor.
Las pruebas de imágenes usan directorios temporales privados. Se comprobó carga
PUT multipart mediante un servidor HTTP real y cURL, no solo UploadedFile simulado.

### Cuatro escenarios críticos del ADR-002

Se repitieron sobre PostgreSQL real con procesos/conexiones independientes y
espera de bloqueos observada, no sobre SQLite:

| Escenario | Resultado observado |
|---|---|
| Dos préstamos de la última unidad | HTTP 201/409; dos conexiones bloqueadas observadas; stock 0; una línea pendiente |
| Préstamos del mismo vecino | HTTP 201/422; dos conexiones bloqueadas observadas; tres pendientes como máximo |
| Dos devoluciones de la misma línea | HTTP 200/409; dos conexiones bloqueadas observadas; stock 1; una devolución |
| Fallo en préstamo de varias líneas | HTTP 409; stock original restaurado; cero préstamos y líneas parciales |

También pasan las carreras existentes entre préstamo, baja lógica y ajuste de
inventario. MigrationsTest, CategoriesTest y DatabaseConstraintsTest comprueban
preparación desde una base vacía, repetición sin pérdida de datos, seis tablas,
cinco categorías, esquema fijo, UTC, índices y restricciones.

## Reglas de negocio y requisitos no funcionales

| Regla | Estado y alcance de evidencia |
|---|---|
| RN-1 | Verificada: límites de inventario, ajuste de total, préstamo, devolución, restricciones SQL y concurrencia |
| RN-2 | Verificada: tres días exactos UTC y máximo tres pendientes, también bajo concurrencia |
| RN-3 | Verificada: vecino con vencidos bloqueado, revalidación después de esperar bloqueo |
| RN-4 | Verificada: snapshots sobreviven edición, baja e imágenes; reporte agrupa datos históricos |
| RN-5 | Verificada: baja lógica protegida; no hay rutas para editar/eliminar préstamos o devoluciones |
| RN-6 | Verificada en código/pruebas: UTC, identificadores en inglés y errores al usuario en español |
| RNF-1 | Parcial: búsqueda local de 5.000 artículos sintéticos bajo 300 ms; falta sembrador HTTP y medición del despliegue con sus datos |
| RNF-2 | Verificada: última unidad concurrente, HTTP 201/409 en PostgreSQL |
| RNF-3 | Verificada en código/pruebas: BCrypt, respuestas sin credenciales y logs redactados; falta revisión de registros del despliegue real |
| RNF-4 | Verificada en pruebas de contrato: code/message/details para validación, autenticación, permisos, inexistencia, conflicto y error inesperado |
| RNF-5 | Pendiente: Compose actual levanta PostgreSQL; no levanta todos los servicios con un solo comando |

JWT conserva ocho horas, claims técnicas/sub/role y autorización con rol vigente
en persistencia. ArchitectureTest comprueba dependencias prohibidas en dominio y
aplicación, enlaces de puertos y ausencia de persistencia directa en controladores.
Esto complementa la revisión de los casos de uso; no es una demostración formal
de todas las propiedades arquitectónicas.

## Cambios y límites del bloque 6

Imágenes: JPG/PNG inspeccionados por contenido, máximo 2 MiB inclusive, claves
aleatorias, almacenamiento privado, rechazo de traversal y enlaces simbólicos,
reemplazo/eliminación después del commit y compensación de rollback. Las pruebas
incluyen permisos, errores de almacenamiento, corrupción, ausencia, límite exacto,
fallo SQL, transacción exterior y fallo de limpieza posterior al commit.
Una caída o fallo físico puede dejar archivos privados huérfanos: base y disco
no constituyen una transacción distribuida. No se implementó un recolector.

Reporte: rango inclusivo UTC sobre fecha del préstamo; agrupación histórica por
article_id/nombre/categoría; incluye desactivados, orden estable, lista vacía,
fechas inválidas y permisos. No cambia inventario ni historial.

Se corrige además el ValueError de fechas con bytes nulos (ahora HTTP 422),
se deshabilita la publicación automática del disco local y se declara PHP 8.4
como mínimo para procesar PUT multipart real. Composer lock solo cambia su hash
y el requisito PHP; no se actualizaron versiones de paquetes. Pint normalizó
estilo de config/auth.php y finales de archivo de tres modelos existentes.

## Pendientes reales de entrega

- `infra/`: contenedor PHP compatible con 8.4, arranque conjunto de servicios,
  volumen privado persistente/escribible para COVERS_DIR, configuración real de
  CORS/JWT/administrador y verificación del despliegue. No se implementa aquí.
- `app/`: frontend React y sus flujos; el directorio no existe en este checkout.
- `page/`: página/documentación de presentación exigida para entrega; directorio
  ausente. No se implementó interfaz en este bloque.
- `tool/`: sembrador por HTTP con 40 artículos, 10 vecinos, 15 préstamos y al menos
  tres vencidos; directorio ausente. Diseñar una demostración de vencidos compatible
  con fechas del servidor: no agregar SQL directo ni fechas públicas inventadas.
- Medir RNF-1 con el sembrador y el despliegue; verificar RNF-3 en sus registros;
  completar RNF-5. Preparar recuperación operativa de archivos privados huérfanos.
- Conciliar estados desactualizados de tasks.md/data-model.md con evidencia real;
  no se modificaron los documentos de requisitos para hacer pasar pruebas.
- Pint global conserva las tres observaciones históricas indicadas arriba.
- La exigencia de historial de la constitución no está completada: se observaron
  cuatro días distintos de commits del proyecto, frente al mínimo de ocho.
  Conteos publicados por carpeta: docs 10, api 37, infra 2, app/page/tool 0;
  quedan carpetas por alcanzar el mínimo de cuatro commits significativos.
  Este bloque no crea commits ni altera el historial para satisfacer ese requisito.

El backend tiene cobertura de los 21 endpoints, pero la entrega completa del
proyecto y todos sus requisitos no funcionales todavía requieren los pasos anteriores.
