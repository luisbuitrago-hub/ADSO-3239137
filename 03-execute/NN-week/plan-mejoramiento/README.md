Este proyecto es la solución del plan de mejoramiento del aprendiz A16, ficha 3239137, dominio kitchenware

# Kitchenware — Sistema de Préstamo de Menaje

## Descripción

Kitchenware es un sistema web diseñado para administrar el préstamo de artículos de menaje de un salón comunal.

Permite organizar el catálogo, registrar vecinos, controlar préstamos y devoluciones, consultar vencimientos y generar reportes de los artículos más solicitados.

## Tecnologías

- **Frontend:** React
- **Backend:** PHP y Laravel
- **Base de datos:** PostgreSQL 16
- **Infraestructura:** Docker
- **Pruebas:** PHPUnit y pruebas de integración

## Organización del proyecto

| Carpeta  | Responsabilidad                                                              |
| -------- | ---------------------------------------------------------------------------- |
| `docs/`  | Especificaciones, arquitectura, modelo de datos, contrato HTTP, tareas y ADR |
| `api/`   | Backend Laravel y pruebas automatizadas                                      |
| `app/`   | Interfaz de administración desarrollada en React                             |
| `page/`  | Página pública de presentación                                               |
| `infra/` | Configuración de contenedores y servicios                                    |
| `tool/`  | Generación de datos de demostración mediante la API                          |

## Funcionalidades especificadas

- Autenticación y autorización por roles.
- Administración de artículos y categorías.
- Registro y consulta de vecinos.
- Registro de préstamos de artículos.
- Devoluciones individuales.
- Consulta de préstamos vencidos.
- Reportes de artículos más solicitados.
- Control de disponibilidad del inventario.

## Reglas principales

- Cada vecino puede tener como máximo tres artículos pendientes de devolución.
- Los préstamos tienen un plazo de tres días.
- Los vecinos con artículos vencidos no pueden recibir nuevos préstamos.
- Las unidades disponibles deben permanecer entre cero y el total.
- Los préstamos conservan la información histórica de los artículos.
- Las fechas se gestionan en UTC.

## Documentación técnica

Los requisitos y decisiones del sistema se encuentran en `docs/`.

La especificación funcional está en `docs/spec.md`, el modelo de datos en `docs/data-model.md` y el contrato de la API en `docs/api-contract.md`.

Las tareas verificables se describen en `docs/tasks.md`.

## Arquitectura

El backend sigue como diseño de referencia una arquitectura hexagonal basada en dominio, aplicación y adaptadores.

La aplicación React consume los endpoints HTTP definidos para Laravel.

## Pruebas y verificación

El estado consolidado de configuración, servicios, pruebas e historial está en
[la auditoría final de entrega](docs/DELIVERY_AUDIT.md). Las instrucciones de Docker
y configuración privada se encuentran en [infra/README.md](infra/README.md).

El proyecto contempla pruebas del dominio, casos de uso, contrato HTTP, persistencia, concurrencia y arquitectura.

Las evidencias de implementación deberán demostrar el cumplimiento de los requisitos establecidos en la documentación.
