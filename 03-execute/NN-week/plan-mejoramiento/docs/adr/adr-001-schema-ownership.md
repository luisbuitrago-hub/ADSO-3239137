# ADR-001 — Propiedad del esquema de base de datos

**Estado:** Aceptado  
**Fecha:** 2026-11-12  
**Proyecto:** Kitchenware  
**Decisión:** Utilizar migraciones de Laravel como mecanismo único de administración del esquema PostgreSQL.

## 1. Contexto

Kitchenware necesita almacenar categorías, artículos, vecinos, usuarios, préstamos y líneas de préstamo.

La base de datos utilizará PostgreSQL 16 y el backend estará desarrollado con PHP y Laravel.

Es necesario definir cómo se crearán las tablas, relaciones, restricciones e índices, evitando diferencias entre el código, la documentación y la base de datos.

## 2. Decisión

El backend Laravel será el único responsable de administrar el esquema de base de datos mediante migraciones versionadas.

Se establece que:

- Las tablas se crearán mediante migraciones de Laravel.
- Las claves primarias utilizarán UUID.
- Las relaciones se protegerán mediante claves foráneas.
- Las restricciones críticas se implementarán en PostgreSQL.
- Las migraciones se almacenarán en `api/database/migrations/`.
- El esquema utilizado será `kitchenware`.
- Las categorías iniciales se crearán durante la migración inicial.
- El administrador inicial será creado por la aplicación a partir de variables de entorno.
- La herramienta ubicada en `tool/` no ejecutará SQL directo; utilizará la API HTTP.
- La estructura real deberá coincidir con `docs/data-model.md`.

El uso de SQL dentro de una migración de Laravel estará permitido cuando sea necesario para definir restricciones o índices propios de PostgreSQL.

## 3. Alternativas consideradas

### Alternativa A: Crear las tablas manualmente

Se descartó porque dificulta reproducir el sistema y controlar los cambios mediante Git.

### Alternativa B: Utilizar archivos SQL independientes

Se descartó como mecanismo principal porque implicaría mantener un proceso adicional de actualización del esquema.

### Alternativa C: Migraciones de Laravel

Se seleccionó por su integración con el backend, su versionamiento y su facilidad para ejecutar cambios de manera controlada.

## 4. Consecuencias

### Positivas

- La estructura de datos se podrá reproducir.
- Los cambios quedarán registrados en Git.
- Las restricciones estarán documentadas.
- Se facilitarán las pruebas automatizadas.
- La inicialización del proyecto será más consistente.

### Negativas

- Será necesario mantener las migraciones sincronizadas con `data-model.md`.
- Algunas restricciones de PostgreSQL requerirán instrucciones SQL específicas.
- Los cambios de esquema deberán revisarse antes de aplicarse.

## 5. Verificación

La decisión se comprobará mediante:

1. Ejecución de las migraciones sobre una base de datos vacía.
2. Consulta de las seis tablas requeridas.
3. Verificación de claves foráneas, índices y restricciones.
4. Comprobación de las cinco categorías.
5. Comparación de resultados con `docs/data-model.md`.

La implementación de esta decisión corresponde principalmente a las tareas `T-02`, `T-12` y `T-18` de `tasks.md`.

**Este ADR documenta una decisión técnica; su cumplimiento deberá verificarse cuando se implemente el backend.**
