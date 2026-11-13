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
