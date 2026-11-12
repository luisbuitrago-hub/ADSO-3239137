# Plan técnico — Kitchenware

**Proyecto:** Sistema de Préstamo de Menaje de un Salón Comunal  
**Identificador:** kitchenware  
**Ficha:** ADSO 3239137  
**Aprendiz:** A16  
**Stack:** PHP, Laravel, React y PostgreSQL

## Propósito

Definir las decisiones técnicas, la configuración, la estrategia de pruebas y el orden de construcción del sistema Kitchenware.

Este documento establece cómo implementar los requisitos definidos en `spec.md`, respetando los principios de `constitution.md`.

El esquema de persistencia se documentará en `data-model.md`, la estructura del sistema en `architecture.md`, los endpoints en `api-contract.md` y las tareas verificables en `tasks.md`.

---

## 1. Decisiones técnicas

| Código | Decisión | Elección | Justificación |
|---|---|---|---|
| D-01 | Lenguaje del backend | PHP | Tecnología obligatoria del plan de mejoramiento. |
| D-02 | Framework del backend | Laravel | Permite implementar la API HTTP, validaciones y migraciones. |
| D-03 | Frontend | React | Tecnología obligatoria para la interfaz del sistema. |
| D-04 | Persistencia | PostgreSQL 16 con migraciones de Laravel | Permite gestionar transacciones y restricciones de integridad. |
| D-05 | Arquitectura | Arquitectura hexagonal | Separa dominio, aplicación e infraestructura. |
| D-06 | Concurrencia | Transacciones con bloqueo de fila y verificación de disponibilidad | Evita prestar dos veces la última unidad. |
| D-07 | Fechas | UTC y reloj abstraído | Permite verificar préstamos y vencimientos de tres días. |
| D-08 | Reportes | Consulta agregada sobre líneas históricas de préstamos | Conserva los resultados aunque cambie el catálogo. |
| D-09 | Objetos de valor | `ArticleReference`, `Quantity`, `DocumentNumber`, `DateRange` | Encapsulan validaciones sin requerir tablas independientes. |
| D-10 | Imágenes | Almacenamiento local mediante una clave opaca | Evita almacenar imágenes binarias directamente en la base. |
| D-11 | Contraseñas | Hash seguro mediante BCrypt | Protege las credenciales de los usuarios. |
| D-12 | Autenticación | JWT con vigencia de ocho horas | Permite autenticar las solicitudes de la API. |
| D-13 | Administración inicial | Usuario administrador creado desde variables de entorno | Evita permitir la creación pública de administradores. |
| D-14 | Pruebas | PHPUnit y pruebas de integración de Laravel | Verifican reglas de negocio, endpoints y persistencia. |
| D-15 | Despliegue | Docker Compose | Permite iniciar la base de datos, el backend y el frontend mediante un solo comando. |

Estas decisiones deberán mantenerse coherentes con los documentos de arquitectura y los ADR correspondientes.

## 2. Configuración por entorno

Los valores sensibles del sistema se proporcionarán mediante variables de entorno.

| Variable | Obligatoria | Uso |
|---|---|---|
| `DB_CONNECTION` | Sí | Motor de persistencia (`pgsql`). |
| `DB_HOST` | Sí | Dirección del servicio PostgreSQL. |
| `DB_PORT` | Sí | Puerto de conexión. |
| `DB_DATABASE` | Sí | Nombre de la base de datos. |
| `DB_USERNAME` | Sí | Usuario de la base de datos. |
| `DB_PASSWORD` | Sí | Contraseña de la base de datos. |
| `JWT_SECRET` | Sí | Firma de tokens de autenticación. |
| `ADMIN_USERNAME` | Sí | Nombre del administrador inicial. |
| `ADMIN_PASSWORD` | Sí | Contraseña del administrador inicial. |
| `CORS_ORIGIN` | Sí | Origen autorizado del frontend. |
| `COVERS_DIR` | No | Directorio para imágenes de artículos. |

El proyecto incluirá archivos `.env.example` sin credenciales reales.

Los archivos `.env` y las dependencias generadas no se incorporarán al repositorio.

## 3. Estrategia de pruebas

### 3.1. Pruebas del dominio

Verificarán las reglas de negocio sin conexión a la base de datos.

Casos principales:

- Un vecino no puede superar tres artículos pendientes de devolución.
- El vencimiento corresponde a tres días después del préstamo.
- Un vecino con artículos vencidos no puede recibir nuevos préstamos.
- Las unidades disponibles permanecen entre cero y el total.
- Los valores históricos de las líneas no cambian al modificar el catálogo.

### 3.2. Pruebas de aplicación

Verificarán los casos de uso utilizando implementaciones simuladas de los repositorios y servicios externos.

Incluirán registro de artículos, registro de vecinos, préstamos, devoluciones, autenticación y generación de reportes.

### 3.3. Pruebas de integración

Comprobarán el funcionamiento de Laravel con PostgreSQL.

Se verificarán migraciones, restricciones, consultas, transacciones y persistencia de las operaciones.

### 3.4. Pruebas del contrato HTTP

Verificarán que los endpoints definidos en `api-contract.md` cumplan sus rutas, métodos, estructuras de respuesta y códigos de estado.

Se comprobarán especialmente:

- HTTP 401 para solicitudes sin autenticación.
- HTTP 403 para roles no autorizados.
- HTTP 404 para recursos inexistentes.
- HTTP 409 para conflictos de negocio y disponibilidad.
- HTTP 422 para datos inválidos.

### 3.5. Pruebas de arquitectura

Verificarán que las capas del dominio y aplicación no dependan directamente de adaptadores de infraestructura.

Los casos de uso utilizarán interfaces y dependencias inyectadas.

### 3.6. Pruebas de concurrencia

Se ejecutarán dos solicitudes simultáneas para prestar la última unidad de un artículo.

El resultado esperado será una operación exitosa y otra rechazada con HTTP 409.

La cantidad disponible nunca podrá ser negativa.

### 3.7. Pruebas de rendimiento

Se comprobará la búsqueda de artículos con un catálogo de 5.000 registros.

El objetivo de respuesta será inferior a 300 milisegundos, conforme al requisito RNF-1 definido en `spec.md`.

### 3.8. Evidencia de pruebas

El proyecto incluirá por lo menos quince archivos de pruebas automatizadas.

Cada archivo tendrá una responsabilidad identificable y las pruebas deberán poder ejecutarse mediante comandos documentados.

---

## 4. Orden de construcción

La implementación seguirá el siguiente orden, conservando la trazabilidad con las 23 tareas de `tasks.md`.

### Fase 1 — Documentación

Elaborar y revisar:

1. `constitution.md`
2. `spec.md`
3. `plan.md`
4. `architecture.md`
5. `data-model.md`
6. `api-contract.md`
7. `tasks.md`
8. Al menos tres ADR.

**Resultado esperado:** especificación coherente antes de implementar los componentes.

### Fase 2 — Backend inicial

Crear el proyecto Laravel y configurar el endpoint de salud `/api/v1/health`.

Implementar las migraciones de PostgreSQL y la semilla de las cinco categorías iniciales.

**Resultado esperado:** backend funcional con base de datos configurada.

### Fase 3 — Dominio y casos de uso

Desarrollar las entidades, objetos de valor e interfaces del dominio.

Implementar los casos de uso de autenticación, artículos, vecinos, préstamos, devoluciones, vencimientos y reportes.

**Resultado esperado:** reglas del negocio verificadas mediante pruebas unitarias.

### Fase 4 — Persistencia y contrato HTTP

Implementar los repositorios y adaptadores de PostgreSQL.

Desarrollar las rutas, controladores, autenticación y respuestas de la API.

Incorporar las transacciones y el control de concurrencia.

**Resultado esperado:** API funcional y coherente con `api-contract.md`.

### Fase 5 — Frontend React

Desarrollar las pantallas requeridas para:

- Inicio de sesión.
- Consulta y administración de artículos.
- Registro y búsqueda de vecinos.
- Registro de préstamos.
- Devolución de artículos.
- Consulta de préstamos vencidos.
- Reporte de artículos más solicitados.

**Resultado esperado:** interfaz conectada a la API y con autorización por roles.

### Fase 6 — Infraestructura

Configurar los contenedores de PostgreSQL, Laravel y React.

Permitir el arranque mediante un solo comando y documentar el procedimiento de instalación y ejecución.

**Resultado esperado:** sistema integrado que pueda iniciarse de forma reproducible.

### Fase 7 — Sembrador de demostración

Desarrollar un programa que registre datos de prueba utilizando únicamente los endpoints HTTP de la API.

El sembrador no podrá insertar registros mediante SQL directo.

**Resultado esperado:** conjunto de datos útil para probar y presentar el sistema.

### Fase 8 — Sitio público

Crear una página web estática y adaptable a dispositivos móviles.

La página presentará Kitchenware como producto, explicará sus funcionalidades y no mostrará información sobre la prueba técnica o el plan académico.

**Resultado esperado:** sitio público independiente de la API.

### Fase 9 — Validación final

Ejecutar las pruebas automatizadas y verificar:

- Cumplimiento de las diez historias de usuario.
- Cumplimiento de las seis reglas de negocio.
- Cumplimiento de los cinco requisitos no funcionales.
- Implementación de los endpoints definidos.
- Finalización de las veintitrés tareas.
- Ausencia de funcionalidades fuera de la especificación.
- Coherencia de la documentación y el código.
- Historial de commits y organización del repositorio.

**Resultado esperado:** proyecto preparado para la entrega y sustentación individual.

---

## 5. Criterio de finalización

Una fase se considera terminada cuando su implementación corresponde con la especificación y existe evidencia verificable.

La documentación, el código, las pruebas y los resultados de ejecución deben mantenerse coherentes.

El cumplimiento detallado de cada una de las veintitrés tareas se registrará en `tasks.md`.
