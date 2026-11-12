# Tareas de implementación — Kitchenware

**Proyecto:** Sistema de Préstamo de Menaje de un Salón Comunal  
**Identificador:** kitchenware  
**Ficha:** ADSO 3239137  
**Aprendiz:** A16  
**Tecnologías:** PHP, Laravel, React, PostgreSQL 16 y Docker

## Propósito

Definir las tareas necesarias para implementar Kitchenware siguiendo la arquitectura y los requisitos descritos en:

- `constitution.md`
- `spec.md`
- `plan.md`
- `architecture.md`
- `data-model.md`
- `api-contract.md`

El proyecto tendrá 23 tareas principales, identificadas como `T-01` a `T-23`.

Cada tarea tendrá dependencias y una evidencia verificable. Una tarea solamente se considerará terminada cuando su funcionalidad haya sido implementada y comprobada.

**Estado inicial de las 23 tareas: pendiente.**

La elaboración de documentos no significa que las funcionalidades descritas ya estén implementadas.

---

## 1. Lista de tareas

| ID | Tarea | Depende de | Evidencia |
|---|---|---|---|
| T-01 | Crear el esqueleto del backend Laravel y el endpoint `GET /health` | — | `GET /api/v1/health` devuelve `{"status":"ok"}` |
| T-02 | Crear migraciones de las seis tablas, claves foráneas, índices y cinco categorías | T-01 | Consultas SQL de `data-model.md` verifican la estructura |
| T-03 | Implementar objetos de valor `ArticleReference`, `Quantity`, `DocumentNumber` y `DateRange` | T-01 | Pruebas unitarias para referencias, cantidades y fechas |
| T-04 | Implementar entidad `Article` con retiro, reposición y baja lógica | T-03 | Pruebas garantizan disponibilidad entre 0 y total |
| T-05 | Implementar `Loan` y `LoanItem`, estados calculados y plazo de tres días | T-04 | Pruebas para `open`, `overdue`, `closed` y máximo de tres líneas |
| T-06 | Implementar `Neighbor` y `User`, documentos únicos y roles válidos | T-03 | Pruebas de normalización y validación |
| T-07 | Implementar puertos y casos de uso de autenticación y creación de operadores | T-06 | Pruebas de `LoginService` y `CreateOperatorService` con repositorios falsos |
| T-08 | Implementar casos de uso del catálogo de artículos | T-04 | Crear, consultar, buscar, modificar y desactivar artículos |
| T-09 | Implementar `LendArticlesService` | T-05, T-08 | Pruebas de disponibilidad, límites y vecinos con vencidos |
| T-10 | Implementar devoluciones y consultas de vencimientos | T-09 | Devolver dos veces produce `ITEM_ALREADY_RETURNED` |
| T-11 | Implementar reporte de artículos más solicitados | T-09 | Reporte por rango de fechas utilizando datos históricos |
| T-12 | Implementar persistencia de artículos, vecinos y usuarios | T-02, T-08 | Pruebas de integración con PostgreSQL real |
| T-13 | Implementar persistencia de préstamos y control de concurrencia | T-12, T-09 | Última unidad: una solicitud exitosa y otra HTTP 409 |
| T-14 | Implementar hash de contraseñas y JWT | T-07 | Pruebas de autenticación y protección de credenciales |
| T-15 | Implementar almacenamiento de imágenes de artículos | T-08 | PNG/JPG válido aceptado; archivo mayor de 2 MB rechazado |
| T-16 | Implementar los 21 endpoints y autorización por rol | T-10, T-11, T-13, T-14, T-15 | Pruebas de contrato para las rutas y errores HTTP |
| T-17 | Configurar dependencias e inicialización del administrador | T-16 | Backend inicia con base limpia y permite ingreso del administrador |
| T-18 | Incorporar restricciones adicionales de base de datos | T-12 | PostgreSQL rechaza cantidades inválidas y roles no permitidos |
| T-19 | Implementar pruebas de arquitectura hexagonal | T-17 | Se detectan dependencias prohibidas entre capas |
| T-20 | Configurar infraestructura con Docker Compose | T-17 | Un comando inicia PostgreSQL, Laravel y React |
| T-21 | Crear sembrador de demostración utilizando la API | T-17 | Artículos, vecinos y préstamos generados por endpoints HTTP |
| T-22 | Implementar la aplicación React | T-16 | Recorrido funcional de login, catálogo, préstamos y devoluciones |
| T-23 | Crear página pública de presentación | — | Página estática adaptable a móvil y escritorio |

---

## 2. Fase 1 — Estructura y dominio

### T-01. Esqueleto del proyecto

Crear el backend Laravel dentro de `api/`.

Configurar:

- Estructura del proyecto.
- Rutas de la API.
- Endpoint de salud.
- Variables de entorno de ejemplo.
- Configuración inicial de pruebas.

**Evidencia:** el endpoint `GET /api/v1/health` responde HTTP 200 con el estado `ok`.

### T-02. Migraciones iniciales

Crear mediante migraciones de Laravel las tablas:

1. `category`
2. `article`
3. `neighbor`
4. `user`
5. `loan`
6. `loan_item`

Incluir claves primarias UUID, claves foráneas, restricciones, índices y las cinco categorías fijas.

**Evidencia:** las consultas de verificación de `data-model.md` muestran las seis tablas y sus relaciones.

### T-03. Objetos de valor

Implementar:

- `ArticleReference`
- `Quantity`
- `DocumentNumber`
- `DateRange`

Las validaciones deberán impedir valores inválidos antes de realizar operaciones de negocio.

**Evidencia:** pruebas unitarias con entradas válidas e inválidas.

### T-04. Entidad Article

Implementar las operaciones:

- `Withdraw`
- `Restock`
- `SoftDelete`

Mantener la regla:

`0 <= available_units <= total_units`

**Evidencia:** ninguna operación permite cantidades negativas ni superiores al total.

### T-05. Entidades Loan y LoanItem

Implementar:

- Creación de préstamos.
- Agregación de líneas.
- Vencimiento a tres días.
- Devolución de líneas.
- Cálculo de estados.
- Conservación de datos históricos.

**Evidencia:** pruebas unitarias con un reloj falso que comprueben los estados `open`, `overdue` y `closed`.

### T-06. Entidades Neighbor y User

Implementar:

- Vecinos con documento obligatorio.
- Normalización de nombres de usuario.
- Roles `admin` y `operator`.
- Protección de contraseñas mediante interfaces.

**Evidencia:** pruebas de validación de documentos y roles.

---

## 3. Fase 2 — Casos de uso

### T-07. Autenticación

Implementar:

- `LoginService`
- `CreateOperatorService`
- Puertos para usuarios.
- Puerto de hash de contraseñas.
- Puerto de emisión de tokens.

**Evidencia:** pruebas con implementaciones falsas, sin depender de la base de datos.

### T-08. Gestión de artículos

Implementar casos de uso para:

- Crear artículos.
- Buscar artículos.
- Consultar detalles.
- Actualizar información.
- Desactivar artículos.
- Asociar y eliminar imágenes.

**Evidencia:** pruebas del catálogo, referencias duplicadas y disponibilidad.

### T-09. Registrar préstamos

Implementar `LendArticlesService`.

Validaciones obligatorias:

- Vecino existente.
- De una a tres líneas por operación.
- Artículos no repetidos.
- Disponibilidad suficiente.
- Máximo tres artículos pendientes por vecino.
- Ausencia de préstamos vencidos.
- Fecha límite de tres días.

**Evidencia:** pruebas que cubran cada regla y no permitan cambios parciales.

### T-10. Devoluciones y vencidos

Implementar:

- `ReturnItemService`
- `OverdueLoansService`

La devolución aumentará la disponibilidad una sola vez.

**Evidencia:** una devolución duplicada produce HTTP 409 y no modifica el inventario.

### T-11. Reporte

Implementar `MostBorrowedArticlesReportService` y su puerto de lectura.

El reporte utilizará:

- Fechas inicial y final.
- Cantidad de veces prestado.
- Nombre histórico.
- Categoría histórica.

**Evidencia:** al modificar el nombre de un artículo, las líneas históricas y las filas correspondientes del reporte conservan el nombre registrado originalmente.

---

## 4. Fase 3 — Persistencia e infraestructura interna

### T-12. Repositorios

Crear adaptadores de PostgreSQL para:

- `ArticleRepository`
- `NeighborRepository`
- `UserRepository`

**Evidencia:** pruebas reales de inserción, consulta, actualización y restricciones.

### T-13. Persistencia de préstamos y concurrencia

Crear `LoanRepository` y la persistencia de líneas de préstamo.

Implementar transacciones y bloqueos de filas de PostgreSQL según la decisión arquitectónica de Kitchenware.

La adquisición de bloqueos se realizará en un orden estable.

**Evidencia:** cuando dos solicitudes intentan prestar la última unidad de un artículo, exactamente una tiene éxito y la otra responde HTTP 409, sin dejar cantidades negativas.

**Decisión de adaptación:** el proyecto original propone un mecanismo de versión optimista. Kitchenware utilizará bloqueo transaccional de filas, como se definió en `architecture.md`. Esta diferencia deberá justificarse en un ADR de concurrencia.

### T-14. Seguridad

Implementar:

- Hash seguro de contraseñas.
- Verificación de contraseñas.
- Emisión y validación de JWT.
- Expiración de ocho horas.

**Evidencia:** la contraseña original y su hash nunca aparecen en respuestas HTTP ni registros de aplicación.

### T-15. Almacenamiento de imágenes

Implementar carga, consulta y eliminación de imágenes de artículos.

Reglas:

- JPG o PNG.
- Máximo 2 MB.
- Validación por contenido.
- Uso de `cover_key` como referencia opaca.

**Evidencia:** pruebas de formatos aceptados, tamaños rechazados y ausencia de imagen.

### T-16. Adaptador HTTP

Implementar todas las rutas descritas en `api-contract.md`.

Configurar:

- Controladores.
- Validaciones de solicitudes.
- Autenticación.
- Autorización por rol.
- Respuestas JSON.
- Manejo uniforme de errores.
- Paginación.

**Evidencia:** pruebas de contrato para los 21 endpoints.

### T-17. Composición y arranque

Vincular puertos e implementaciones mediante el contenedor de dependencias de Laravel.

Crear el administrador inicial con credenciales tomadas de variables de entorno.

**Evidencia:** desde una base de datos limpia se ejecutan las migraciones, se inicializa el administrador y se puede iniciar sesión.

### T-18. Restricciones adicionales

Incorporar a PostgreSQL:

- `ck_article_total_positive`
- `ck_user_role`

Revisar que la base de datos impida los estados inválidos indicados en `data-model.md`.

**Evidencia:** operaciones SQL inválidas son rechazadas por PostgreSQL.

Actualizar la clasificación de las restricciones en `data-model.md` cuando estén implementadas.

### T-19. Pruebas de arquitectura

Comprobar que:

- Dominio no importe Laravel.
- Dominio no dependa de PostgreSQL.
- Aplicación utilice puertos.
- Infraestructura implemente adaptadores.
- Los controladores no contengan reglas de negocio.

**Evidencia:** pruebas automatizadas que detecten dependencias prohibidas.

---

## 5. Fase 4 — Infraestructura y demostración

### T-20. Docker Compose

Crear la configuración en `infra/`.

Servicios principales:

- PostgreSQL 16.
- Backend Laravel.
- Frontend React.

**Evidencia:** el sistema puede iniciarse con un solo comando documentado en el `README.md`.

Las migraciones deberán poder ejecutarse sobre una base de datos inicialmente vacía.

### T-21. Sembrador de demostración

Crear un programa en `tool/` que utilice exclusivamente los endpoints HTTP de Kitchenware.

Cantidad mínima de datos de demostración adaptada del proyecto original:

- 40 artículos.
- 10 vecinos.
- 15 préstamos.
- Al menos tres líneas vencidas.

**Evidencia:** después de ejecutarlo, la consulta de vencidos devuelve al menos tres líneas y el reporte de artículos más solicitados contiene resultados.

El sembrador no insertará datos mediante SQL directo.

### T-22. Aplicación React

Crear las pantallas necesarias para:

- Inicio de sesión.
- Catálogo de artículos.
- Registro y consulta de vecinos.
- Registro de préstamos.
- Registro de devoluciones.
- Consulta de vencidos.
- Reporte de artículos más solicitados.

**Evidencia:** recorrido completo desde el navegador utilizando la API de Laravel.

### T-23. Página pública

Crear en `page/` una página estática para presentar Kitchenware.

Debe incluir:

- Nombre del producto.
- Problema que resuelve.
- Funcionalidades principales.
- Tecnologías utilizadas.
- Diseño adaptable a diferentes pantallas.

**Evidencia:** la página se abre en móvil y escritorio sin depender del backend.

---

## 6. Plan de pruebas automatizadas

Se organizarán al menos 15 archivos de pruebas automatizadas, distribuidos entre dominio, casos de uso, integración, contrato y arquitectura.

Propuesta de archivos:

| Archivo de prueba | Cobertura |
|---|---|
| `ArticleReferenceTest.php` | Referencias válidas e inválidas |
| `QuantityTest.php` | Cantidades permitidas |
| `DateRangeTest.php` | Rangos de fechas |
| `ArticleTest.php` | Disponibilidad |
| `LoanTest.php` | Creación y estados |
| `NeighborTest.php` | Validaciones de vecinos |
| `UserTest.php` | Roles y normalización |
| `LoginServiceTest.php` | Autenticación |
| `CreateArticleServiceTest.php` | Creación de artículos |
| `LendArticlesServiceTest.php` | Reglas de préstamos |
| `ReturnItemServiceTest.php` | Devoluciones |
| `OverdueLoansServiceTest.php` | Vencimientos |
| `MostBorrowedReportTest.php` | Reportes históricos |
| `PersistenceIntegrationTest.php` | Repositorios PostgreSQL |
| `LoanConcurrencyTest.php` | Última unidad concurrente |
| `ApiContractTest.php` | Endpoints y respuestas |
| `ArchitectureTest.php` | Dependencias entre capas |

**Total propuesto: 17 archivos de pruebas.**

Los nombres definitivos podrán ajustarse a la estructura de pruebas de Laravel, manteniendo la cobertura y el requisito mínimo.

---

## 7. Relación con las historias de usuario

| Historia | Tareas principales |
|---|---|
| HU-01 — Inicio de sesión | T-06, T-07, T-14, T-16 |
| HU-02 — Gestión de operadores | T-06, T-07, T-16 |
| HU-03 — Administración de artículos | T-04, T-08, T-12, T-15, T-16 |
| HU-04 — Búsqueda de artículos | T-08, T-12, T-16, T-22 |
| HU-05 — Registro de vecinos | T-06, T-12, T-16 |
| HU-06 — Registrar préstamos | T-05, T-09, T-13, T-16 |
| HU-07 — Registrar devoluciones | T-10, T-13, T-16 |
| HU-08 — Consultar préstamos | T-10, T-13, T-16 |
| HU-09 — Consultar vencidos | T-10, T-13, T-16 |
| HU-10 — Reporte de artículos | T-11, T-13, T-16 |

---

## 8. Orden recomendado de implementación

El desarrollo seguirá este orden de trabajo:

**Primera etapa:**

`T-01 → T-02 → T-03 → T-04 → T-05 → T-06`

**Segunda etapa:**

`T-07 → T-08 → T-09 → T-10 → T-11`

**Tercera etapa:**

`T-12 → T-13 → T-14 → T-15 → T-16 → T-17`

**Cuarta etapa:**

`T-18 → T-19 → T-20 → T-21 → T-22 → T-23`

Las tareas podrán desarrollarse en paralelo cuando sus dependencias lo permitan. Por ejemplo, la página pública `T-23` no depende del backend.

---

## 9. Definición de terminado

Una tarea estará terminada cuando cumpla todas las condiciones aplicables:

1. El código está implementado.
2. Se respetan las reglas de `constitution.md`.
3. Se cumplen los criterios de `spec.md`.
4. La API coincide con `api-contract.md`.
5. Las tablas y restricciones coinciden con `data-model.md`.
6. Existen pruebas o evidencias ejecutables.
7. Las pruebas correspondientes pasan.
8. Los cambios están registrados en Git.
9. La documentación refleja el comportamiento real.
10. El aprendiz puede explicar y demostrar el resultado.

Una tarea sin implementación o sin evidencia verificable permanecerá pendiente.

El objetivo no será únicamente completar una lista de archivos, sino construir un sistema funcional que permita demostrar las competencias requeridas durante la sustentación individual.
