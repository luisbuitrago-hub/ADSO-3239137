# API — Kitchenware

**Proyecto:** Sistema de Préstamo de Menaje de un Salón Comunal  
**Dominio:** kitchenware  
**Ficha:** ADSO 3239137  
**Aprendiz:** A16

## Propósito

El backend de Kitchenware tiene como propósito proporcionar una API REST para gestionar los artículos de menaje de un salón comunal, los vecinos registrados, los préstamos, las devoluciones y los reportes.

La API se diseña con PHP y Laravel, siguiendo los requisitos funcionales y técnicos establecidos en la documentación del proyecto.

## Tecnologías

- PHP
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
