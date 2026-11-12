# Especificación — Kitchenware

**Proyecto:** Sistema de Préstamo de Menaje de un Salón Comunal  
**Identificador:** kitchenware  
**Ficha:** ADSO 3239137  
**Aprendiz:** A16

## Propósito

Desarrollar un sistema web que permita administrar el catálogo de artículos de menaje de un salón comunal, registrar vecinos, gestionar préstamos y devoluciones, consultar artículos vencidos y generar reportes de los artículos más solicitados.

Esta especificación se rige por `constitution.md`. El esquema de la base de datos se define en `data-model.md` y los endpoints HTTP en `api-contract.md`.

---

## 1. Actores

| Actor | Responsabilidades | Autenticación |
|---|---|---|
| Administrador (`admin`) | Gestiona artículos, vecinos, operadores y reportes | Usuario y contraseña mediante token |
| Operador (`operator`) | Registra préstamos y devoluciones; consulta artículos, vecinos y vencidos | Usuario y contraseña mediante token |
| Vecino (`neighbor`) | Solicita artículos prestados; no utiliza directamente el sistema | No requiere autenticación |

El administrador inicial se configura mediante variables de entorno durante el despliegue. La API no permite crear nuevos usuarios con rol `admin`.

## 2. Alcance

### Funcionalidades incluidas

- Autenticación y autorización según el rol.
- Administración de operadores.
- Catálogo de artículos con imagen opcional.
- Cinco categorías iniciales: ollas, vajilla, cubiertos, hornillas y manteles.
- Registro y consulta de vecinos.
- Préstamos con múltiples líneas.
- Devolución individual por línea.
- Consulta de préstamos y vencimientos.
- Reporte de artículos más solicitados.
- Control de unidades disponibles.
- Protección frente a solicitudes concurrentes.

### Funcionalidades excluidas

No se implementarán multas, pagos, reservas, renovaciones, notificaciones por correo o SMS, importación masiva, préstamos entre sedes ni funcionalidades adicionales fuera de esta especificación.

---

## 3. Historias de usuario y criterios de aceptación

### HU-01 — Iniciar sesión

Como administrador u operador, quiero iniciar sesión para acceder a las funcionalidades autorizadas según mi rol.

**Criterios de aceptación**

- **CA-01.1:** las credenciales válidas generan un token con vigencia de ocho horas.
- **CA-01.2:** las credenciales inválidas generan HTTP 401 sin revelar si el usuario o la contraseña son incorrectos.
- **CA-01.3:** los endpoints protegidos requieren autenticación. Sin token responden 401; con un rol insuficiente, 403.

### HU-02 — Registrar operadores

Como administrador, quiero registrar operadores para permitirles gestionar los préstamos del salón comunal.

**Criterios de aceptación**

- **CA-02.1:** el administrador puede crear usuarios con nombre, contraseña y rol `operator`.
- **CA-02.2:** los nombres de usuario se normalizan a minúsculas, se eliminan los espacios exteriores y deben ser únicos.
- **CA-02.3:** un nombre repetido genera HTTP 409.
- **CA-02.4:** intentar crear un usuario con rol `admin` mediante la API genera HTTP 422.
- **CA-02.5:** las contraseñas nunca se devuelven en las respuestas ni se registran en los logs.

### HU-03 — Gestionar artículos

Como administrador, quiero registrar, modificar y desactivar artículos para mantener actualizado el inventario del salón comunal.

**Criterios de aceptación**

- **CA-03.1:** se puede registrar un artículo con nombre, descripción, referencia, categoría y cantidad total de unidades.
- **CA-03.2:** cada artículo activo tiene una referencia única.
- **CA-03.3:** al crear un artículo, sus unidades disponibles son iguales a las unidades totales.
- **CA-03.4:** la cantidad total inicial debe ser como mínimo una unidad.
- **CA-03.5:** modificar la cantidad total ajusta la disponibilidad por la misma diferencia, sin permitir valores negativos ni superar el total.
- **CA-03.6:** se permite asociar una imagen JPG o PNG de máximo 2 MB; su almacenamiento utiliza una clave opaca.
- **CA-03.7:** la desactivación de artículos es lógica. No se permite desactivar un artículo con préstamos abiertos; se responde HTTP 409.

### HU-04 — Consultar y buscar artículos

Como usuario autenticado, quiero buscar artículos para conocer el inventario disponible.

**Criterios de aceptación**

- **CA-04.1:** se permite buscar por nombre o descripción parcial.
- **CA-04.2:** los resultados pueden filtrarse por categoría.
- **CA-04.3:** solo aparecen artículos activos.
- **CA-04.4:** los artículos se presentan ordenados por nombre, con paginación mediante `page` y `size`, con máximo 50 resultados por página.
- **CA-04.5:** la respuesta incluye el total de resultados.
- **CA-04.6:** consultar un artículo inexistente o desactivado genera HTTP 404.

### HU-05 — Gestionar vecinos

Como administrador u operador, quiero registrar y consultar vecinos para identificar a quienes solicitan artículos prestados.

**Criterios de aceptación**

- **CA-05.1:** se registra un vecino con nombre y documento de identificación.
- **CA-05.2:** el documento es único; si está repetido, se responde HTTP 409.
- **CA-05.3:** los vecinos pueden buscarse por nombre o documento.
- **CA-05.4:** los resultados se presentan de forma paginada.
- **CA-05.5:** los vecinos no pueden eliminarse físicamente.

### HU-06 — Registrar préstamos

Como administrador u operador, quiero registrar préstamos para controlar las unidades entregadas a los vecinos.

**Criterios de aceptación**

- **CA-06.1:** un préstamo pertenece a un único vecino y registra al usuario autenticado que lo realiza.
- **CA-06.2:** cada préstamo contiene entre una y tres líneas de artículos.
- **CA-06.3:** un mismo artículo no puede aparecer dos veces en un mismo préstamo. La solicitud inválida genera HTTP 422.
- **CA-06.4:** cada línea presta una unidad y disminuye en uno la cantidad disponible del artículo.
- **CA-06.5:** si no hay unidades disponibles, el sistema responde HTTP 409 y no registra parcialmente el préstamo.
- **CA-06.6:** cada vecino puede tener como máximo tres artículos sin devolver entre todos sus préstamos.
- **CA-06.7:** un vecino con artículos vencidos no puede recibir nuevos préstamos hasta devolverlos. El sistema responde HTTP 409.
- **CA-06.8:** el plazo de devolución es de tres días desde la fecha del préstamo.
- **CA-06.9:** cada línea conserva una copia del nombre, referencia y categoría del artículo al momento del préstamo.
- **CA-06.10:** los préstamos registrados no pueden editarse ni eliminarse.

### HU-07 — Registrar devoluciones

Como administrador u operador, quiero registrar las devoluciones para actualizar la disponibilidad de los artículos.

**Criterios de aceptación**

- **CA-07.1:** cada línea del préstamo puede devolverse individualmente.
- **CA-07.2:** al devolver una línea se registra `returned_at` y se incrementa en uno la disponibilidad del artículo.
- **CA-07.3:** una línea ya devuelta no puede devolverse nuevamente; se responde HTTP 409.
- **CA-07.4:** la devolución nunca permite superar la cantidad total de unidades.
- **CA-07.5:** cuando todas las líneas se encuentran devueltas, el préstamo se considera cerrado.

### HU-08 — Consultar préstamos

Como administrador u operador, quiero consultar los préstamos registrados para conocer su estado e historial.

**Criterios de aceptación**

- **CA-08.1:** consultar un préstamo presenta sus líneas y el estado calculado.
- **CA-08.2:** los estados posibles son `open`, `overdue` y `closed`.
- **CA-08.3:** los préstamos pueden filtrarse por vecino, rango de fechas y estado.
- **CA-08.4:** los resultados se ordenan por fecha descendente y se presentan paginados.
- **CA-08.5:** el estado del préstamo se calcula a partir de sus fechas y devoluciones; no se almacena como una columna independiente.

### HU-09 — Consultar artículos vencidos

Como administrador u operador, quiero consultar los artículos que no se devolvieron dentro del plazo establecido para controlar los préstamos pendientes.

**Criterios de aceptación**

- **CA-09.1:** el sistema muestra las líneas sin devolver cuya fecha de vencimiento sea anterior al instante actual.
- **CA-09.2:** cada resultado incluye el artículo, el vecino y los días de retraso.
- **CA-09.3:** los resultados se ordenan por mayor cantidad de días de retraso.
- **CA-09.4:** solamente los roles `admin` y `operator` pueden consultar esta información.

### HU-10 — Reporte de artículos más solicitados

Como administrador, quiero obtener un reporte de los artículos más solicitados para conocer su frecuencia de préstamo.

**Criterios de aceptación**

- **CA-10.1:** el administrador puede consultar el reporte mediante un rango de fechas.
- **CA-10.2:** se muestra una fila por artículo y categoría histórica, con la cantidad de veces que se ha prestado.
- **CA-10.3:** los resultados se ordenan de mayor a menor cantidad de préstamos.
- **CA-10.4:** si la fecha final es anterior a la inicial, se responde HTTP 422.
- **CA-10.5:** si no existen préstamos en el periodo, se devuelve una lista vacía.
- **CA-10.6:** los cambios posteriores en el catálogo no modifican los datos históricos del reporte.
- **CA-10.7:** únicamente el administrador puede consultar el reporte.

---

## 4. Reglas de negocio

| Código | Regla |
|---|---|
| RN-1 | Las unidades disponibles deben permanecer siempre entre cero y las unidades totales. |
| RN-2 | El plazo del préstamo es de tres días y cada vecino puede mantener como máximo tres artículos sin devolver. |
| RN-3 | Un vecino con préstamos vencidos no puede recibir nuevos artículos hasta realizar las devoluciones pendientes. |
| RN-4 | Los valores históricos almacenados en las líneas de préstamo no se modifican cuando cambia el catálogo. |
| RN-5 | Los préstamos y devoluciones no pueden eliminarse. Los artículos solo se desactivan mediante baja lógica. |
| RN-6 | Las fechas se registran en UTC, los identificadores técnicos están en inglés y los mensajes al usuario en español. |

## 5. Requisitos no funcionales

| Código | Requisito | Verificación |
|---|---|---|
| RNF-1 | La búsqueda de artículos deberá responder en menos de 300 ms con un catálogo de 5.000 artículos. | Prueba de rendimiento utilizando datos generados por el sembrador. |
| RNF-2 | Si dos operadores intentan prestar simultáneamente la última unidad, solo uno tendrá éxito y el otro recibirá HTTP 409. | Prueba automatizada de concurrencia. |
| RNF-3 | Las contraseñas no se almacenarán en texto plano ni aparecerán en respuestas o logs. | Pruebas de seguridad y revisión de registros. |
| RNF-4 | Todos los errores de la API utilizarán una estructura de respuesta uniforme. | Pruebas del contrato HTTP. |
| RNF-5 | La base de datos y los servicios deberán levantarse mediante un solo comando. | Verificación de la configuración de contenedores y del procedimiento de arranque. |

---

## 6. Restricciones de implementación

El sistema se implementará utilizando:

- React para la interfaz de usuario.
- PHP con Laravel para la API.
- PostgreSQL como base de datos.
- Contenedores para ejecutar la base de datos y los servicios.
- Un sembrador que utilice exclusivamente la API HTTP.

Los nombres de clases, métodos, variables, tablas, columnas y rutas utilizarán identificadores en inglés.

Los mensajes dirigidos al usuario estarán en español.

Todas las fechas se gestionarán en UTC.

La implementación deberá mantener correspondencia con `data-model.md`, `api-contract.md` y `tasks.md`.

No se añadirán funcionalidades fuera de la especificación aprobada.
