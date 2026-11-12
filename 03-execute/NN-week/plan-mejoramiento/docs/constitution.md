# Constitución — Kitchenware

**Proyecto:** Sistema de Préstamo de Menaje de un Salón Comunal  
**Identificador:** kitchenware  
**Ficha:** ADSO 3239137  
**Aprendiz:** A16  
**Tecnologías:** React, PHP, Laravel y PostgreSQL  
**Metodología:** Spec-Driven Development (SDD)

## Propósito

Establecer los principios técnicos y las restricciones obligatorias para desarrollar Kitchenware, un sistema web que permite administrar artículos de menaje, vecinos, préstamos, devoluciones y reportes de un salón comunal.

Cada principio debe poder verificarse mediante documentación, pruebas automatizadas o revisión del código.

---

## Artículo I — Independencia del dominio

El dominio del sistema debe contener las reglas de negocio sin depender directamente de Laravel, React, la base de datos ni servicios externos.

Las entidades principales representan artículos, vecinos, administradores, préstamos y sus líneas.

**Verificación:** las reglas del dominio pueden probarse sin iniciar un servidor ni conectarse a PostgreSQL.

## Artículo II — Arquitectura hexagonal y puertos

El sistema utilizará una separación entre dominio, aplicación e infraestructura.

La capa de aplicación definirá las interfaces necesarias para acceder a repositorios, gestionar contraseñas, emitir tokens, consultar fechas y almacenar imágenes.

Los adaptadores implementarán estas interfaces utilizando las tecnologías seleccionadas.

**Verificación:** las pruebas de los casos de uso podrán ejecutarse con implementaciones simuladas, sin depender directamente de la infraestructura.

## Artículo III — Punto único de composición

La conexión entre interfaces y sus implementaciones se centralizará mediante el contenedor de servicios de Laravel y sus proveedores correspondientes.

**Verificación:** los casos de uso recibirán sus dependencias por inyección, sin crear directamente conexiones o adaptadores de infraestructura.

## Artículo IV — Principios SOLID

El sistema respetará los cinco principios SOLID:

- **SRP:** cada clase tendrá una responsabilidad definida.
- **OCP:** las implementaciones podrán extenderse sin modificar las reglas del dominio.
- **LSP:** las implementaciones de una interfaz podrán sustituirse sin alterar el comportamiento esperado.
- **ISP:** las interfaces serán pequeñas y específicas.
- **DIP:** los casos de uso dependerán de abstracciones y no de implementaciones concretas.

**Verificación:** revisión de dependencias, pruebas unitarias y pruebas de arquitectura.

## Artículo V — Propiedad del esquema de base de datos

La estructura de PostgreSQL será administrada mediante migraciones de Laravel.

La carpeta `infra` configurará los contenedores necesarios, pero no duplicará las instrucciones de creación de tablas.

**Verificación:** las tablas, claves foráneas, índices y restricciones se crearán mediante las migraciones.

## Artículo VI — Integridad de los datos

Las restricciones que puedan aplicarse directamente en PostgreSQL deberán implementarse en la base de datos.

El sistema garantizará:

- Que las unidades totales no sean negativas.
- Que las unidades disponibles estén entre cero y el total.
- Que las referencias de los artículos cumplan las restricciones de unicidad establecidas en el modelo.
- Que las relaciones entre entidades mantengan su integridad.
- Que una solicitud concurrente no permita prestar dos veces la última unidad.

**Verificación:** pruebas de restricciones y una prueba de concurrencia que confirme que una operación tiene éxito y la otra recibe HTTP 409.

## Artículo VII — Estados y valores derivados

El estado de un préstamo se determinará a partir de sus fechas y devoluciones.

Los estados `open`, `overdue` y `closed`, así como los días de retraso, se calcularán cuando sean necesarios.

**Verificación:** el modelo de datos no incluirá columnas innecesarias para almacenar estados calculables.

## Artículo VIII — Conservación de los datos históricos

Los datos del artículo guardados en una línea de préstamo conservarán los valores correspondientes al momento de realizar la operación.

Los cambios posteriores en el catálogo no deberán modificar la información histórica.

Las operaciones de préstamo y devolución no podrán eliminarse físicamente. Los artículos del catálogo utilizarán baja lógica.

**Verificación:** una prueba modificará los datos de un artículo después del préstamo y comprobará que el registro histórico mantiene sus valores originales.

## Artículo IX — Seguridad y protección de secretos

Las contraseñas, claves de autenticación y credenciales de base de datos no podrán almacenarse directamente en el repositorio.

Los secretos se configurarán mediante variables de entorno.

El archivo `.env` real estará excluido del control de versiones. Se podrá proporcionar un `.env.example` sin credenciales reales.

**Verificación:** revisión del repositorio para detectar secretos y pruebas que garanticen que las respuestas HTTP no expongan contraseñas ni hashes.

## Artículo X — Coherencia entre documentación e implementación

Los documentos `constitution.md`, `spec.md`, `plan.md`, `architecture.md`, `data-model.md`, `api-contract.md` y `tasks.md` deberán corresponder al comportamiento implementado.

Cuando la base de datos y el documento del modelo presenten diferencias, se revisará la implementación y se corregirá la documentación para reflejar las restricciones realmente aplicadas, sin incumplir la especificación.

**Verificación:** pruebas automatizadas y comprobación de congruencia entre la especificación y los componentes del sistema.

## Artículo XI — Idioma y convenciones

Los nombres de clases, métodos, variables, columnas, tablas, rutas y demás identificadores técnicos estarán escritos en inglés.

La documentación, las etiquetas de la interfaz y los mensajes dirigidos al usuario estarán escritos en español.

Las fechas se registrarán y procesarán en UTC.

**Verificación:** revisión estática del código y pruebas de las respuestas de la API.

## Artículo XII — Evidencia y cumplimiento

Una tarea solamente se considerará terminada cuando exista evidencia verificable de su implementación.

El proyecto deberá cumplir el alcance establecido en su especificación:

- Diez historias de usuario.
- Seis reglas de negocio.
- Cinco requisitos no funcionales.
- Veintitrés tareas.
- Contrato API completo.
- Al menos tres registros de decisiones de arquitectura (ADR).
- Quince o más archivos de pruebas automatizadas.

Los commits deberán ser pequeños, descriptivos y distribuidos durante al menos ocho días distintos, con un mínimo de cuatro commits por subcarpeta, de acuerdo con el acta del plan de mejoramiento.

**Verificación:** ejecución de pruebas, revisión de los documentos, historial de Git y demostración del producto.

---

## Cumplimiento de la constitución

Toda decisión de arquitectura, cambio del código o modificación de la especificación debe respetar estos artículos.

Los cambios que afecten decisiones técnicas importantes deberán quedar documentados mediante los ADR correspondientes.

La constitución orientará la implementación y la sustentación individual del sistema Kitchenware.
