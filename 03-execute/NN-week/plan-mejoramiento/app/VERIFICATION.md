# Evidencia del frontend — bloque 8.1

Esta primera sección conserva la evidencia histórica de 8.1. El estado vigente
del catálogo y vecinos, las pruebas y límites del **bloque 8.2** se documentan al final.

Fecha local: 2026-11-18, America/Bogota. Rama main y Git limpio al iniciar.
app/ no existía. Se revisaron especificación, plan, arquitectura, contrato, tareas,
ADR, autenticación real, rutas Laravel, CORS y documentación de infraestructura.

## Implementación verificada

React 19.3.1, TypeScript 6.0.3, Vite 8.3.8 y React Router 8.5.2. Probado con
Node 24.22.2/npm 11.19.1; engines refleja la intersección de requisitos de las
dependencias. Lockfile con versiones exactas y excepción local al ignore global.
Solo React, React DOM y React Router son dependencias de producción.

Login conforme a username/password y respuesta access_token/token_type/expires_in/role.
Usuario normalizado; contraseña sin recortar; ocho horas/exp; JWT en memoria;
sin almacenamiento persistente, cookies de autenticación ni renovación inventada.
Cierre de sesión local, invalidación por 401, expiración y protección frente a
respuestas tardías. Un 403 conserva sesión y comunica falta de permisos.
El backend conserva la verificación de firma y autorización vigente.

Rutas técnicas en inglés conforme a constitución: /login, /home, /articles,
/neighbors, /loans, /overdue, /reports y /users. Etiquetas y mensajes en español.
Admin ve todas; operador no ve administración y recibe restricción visual al
entrar por ruta. Son rutas del frontend; no se agregaron endpoints a Laravel.
Los módulos de negocio muestran su estado pendiente, sin datos ficticios.

## Resultados realmente ejecutados

| Comprobación                                      | Resultado final                                 |
| ------------------------------------------------- | ----------------------------------------------- |
| npm test (Vitest/Testing Library)                 | 39 aprobadas, 0 fallidas, 2 archivos            |
| npm run test:e2e en Chromium, ejecución separada  | 6 aprobadas, 0 fallidas; escritorio y móvil     |
| npm run test:api                                  | 1 prueba de navegador real aprobada, 0 fallidas |
| Total de pruebas frontend                         | 46 aprobadas en las ejecuciones indicadas       |
| npm run typecheck                                 | Aprobado                                        |
| npm run lint                                      | Aprobado, cero advertencias                     |
| npm run format:check                              | Aprobado                                        |
| npm run build                                     | Aprobado; archivos estáticos en dist/           |
| npm audit --audit-level=high                      | 0 vulnerabilidades notificadas                  |
| Sintaxis Python del verificador; git diff --check | Aprobados                                       |

La cobertura incluye los doce escenarios solicitados: renderizado, campos
obligatorios, login exitoso simulado con contrato real, credenciales incorrectas,
red, carga y duplicados, navegación autenticada, rutas privadas, roles, logout,
token inválido/vencido y pérdida de sesión al recargar. Además: 422 por campo,
500 sin trazas/detalles internos, timeout, URLs inseguras, respuestas incompatibles
y 401 tardío de una sesión anterior sin invalidar otra posterior.

Chromium comprobó teclado, foco, cierre del menú móvil con Escape, ausencia de
desbordamiento horizontal en 1440x1000 y 390x844, rutas, roles, logout y recarga.
axe comprobó login e inicio con reglas WCAG 2 A/AA y 2.1 A/AA, sin infracciones
detectadas en esas ejecuciones. Se corrigieron contrastes encontrados inicialmente.
No constituye certificación WCAG ni una revisión con lector de pantalla real.

## Integración real y preservación del entorno

La última prueba real usó kitchenware-infra-test-6eb5d3506a2c, credenciales generadas
en ejecución, PostgreSQL/Laravel independientes y Vite en puerto libre. Se reutilizó
el verificador de infra/ sin cambiar sus fuentes; no se usó api/.env para configurar
la prueba. Chromium consumió React y el proxy: salud, login real, Bearer sobre
categorías, 401 sin token, 422 de validación, preflight CORS con origen permitido,
403 al operador sobre reporte y cierre de sesión. El operador se creó por HTTP
únicamente en la base de pruebas.

Después se retiraron solo sus servidores/contenedores/redes, conservando sus
volúmenes. Los metadatos de contenedores/volúmenes previos y las huellas internas
de .env permanecieron sin cambios detectados. No se consultó ni modificó la base
de desarrollo. No se imprimieron tokens ni contraseñas; las trazas de navegador
real están desactivadas. No se cambiaron puertos a públicos.

Chromium y las bibliotecas faltantes se prepararon en /tmp, usando índices APT y
extracción también temporales. No se instalaron paquetes del sistema ni se cambió
el Codespace. No se modificó código de API, infraestructura, page/ o tool/.

## Límites y pendientes

- Se observó un timeout intermitente de primera carga al ejecutar simultáneamente
  las suites de navegador y API real. Las ejecuciones separadas pasaron; ejecutar
  esos comandos secuencialmente. Se separaron las cachés Vite por modo/puerto,
  pero no se declara acreditada la estabilidad de las suites concurrentes.
- El proxy fue verificado en el Codespace. No se probó el acceso remoto privado
  con la sesión GitHub personal del usuario ni todos los despliegues CORS posibles.
- No se implementan catálogo, imágenes, vecinos, préstamos, devoluciones,
  vencidos, reportes ni gestión de operadores en la UI. Tampoco Docker de React,
  page/ o tool/. T-22 y el frontend completo siguen pendientes.
- La lectura de JWT en frontend es para la UX, sin validar su firma. Logout no
  revoca copias del token en el servidor. Recargar requiere iniciar sesión de nuevo;
  un cambio de rol en persistencia puede requerir reingreso para actualizar el menú.

Todos los archivos fuente creados están en app/. No se modificaron requisitos,
secretos reales, ramas ni historial. No se ejecutó git add, git commit ni git push.

## Bloque 8.2 — Catálogo y vecinos

Fecha local: 2026-11-18, America/Bogota. Git limpio al iniciar; rama main.
Se revisaron spec, architecture, api-contract, data-model, tasks, controladores,
validaciones y casos de uso Laravel, junto con el frontend/README/evidencia 8.1.
Se conservaron autenticación, proxy, roles, diseño y dependencias sin agregar librerías.

### Implementación y contrato

| Endpoints bajo /api/v1 | Evidencia de frontend                                       |
| ---------------------- | ----------------------------------------------------------- |
| GET /categories        | Consulta, carga/vacío/error/reintento; filtro y formularios |
| GET /articles          | q, category_id, page/size, total y unidades disponibles     |
| GET /articles/{id}     | Detalle, inventario y recurso inexistente                   |
| POST /articles         | Registro admin, UUID/disponibilidad asignados por backend   |
| PUT /articles/{id}     | Edición admin sin enviar referencia, id o disponibilidad    |
| DELETE /articles/{id}  | Confirmación/cancelación, 204 y protección 409              |
| GET /neighbors         | Listado, búsqueda nombre/documento y paginación             |
| GET /neighbors/{id}    | Datos y active_loans como unidades pendientes               |
| POST /neighbors        | Registro admin/operator, documento de texto único           |

Rutas reales: /categories, /articles, /articles/new, /articles/:id,
/articles/:id/edit, /neighbors, /neighbors/new y /neighbors/:id. No son endpoints
nuevos de Laravel. El operador no ve acciones administrativas y las rutas new/edit
de artículos también lo restringen. No hay edición/eliminación de vecinos ni
mantenimiento de categorías. No se consumen endpoints de imágenes o préstamos.

Validaciones: longitudes 250/200/50 de artículos, categoría de la API, total entero
1..2147483647 y mínimo conocido por unidades pendientes. La referencia se muestra
readonly y se omite del PUT. Disponibilidad y cambios concurrentes los verifica
Laravel. Vecinos: nombre 1..200, documento 1..30, recorte exterior sin convertir
a número, eliminar separadores ni cambiar mayúsculas. Registro asigna UUID en API.

Se presentan 401/403/404/409/422 y errores de conexión; no se confirman escrituras
cuando se desconoce el resultado. Los valores del formulario se conservan si falla.
No hay reintento automático de POST/PUT/DELETE. Se bloquean envíos duplicados y
las lecturas viejas no reemplazan una búsqueda más reciente. Tras escribir se
consulta de nuevo el detalle/listado; no se inventan filas ni cantidades locales.

### Resultados realmente ejecutados

| Comprobación                                 | Resultado                                                         |
| -------------------------------------------- | ----------------------------------------------------------------- |
| npm test                                     | 78 aprobadas, 0 fallidas, 3 archivos; conserva regresiones 8.1    |
| npm run test:e2e                             | 10 aprobadas, 0 fallidas, escritorio/móvil; conserva las 6 de 8.1 |
| npm run test:api                             | 2 pruebas de navegador reales aprobadas, 0 fallidas               |
| Total frontend                               | 90 pruebas aprobadas en las ejecuciones indicadas                 |
| npm run typecheck                            | Aprobado                                                          |
| npm run lint                                 | Aprobado, cero advertencias                                       |
| npm run format:check                         | Aprobado                                                          |
| npm run build                                | Aprobado                                                          |
| Sintaxis Python del runner; git diff --check | Aprobados                                                         |

Los mocks usan el contrato real y solo existen en tests/. Se verificaron categorías,
filtros, búsqueda literal, paginación/tamaño, detalle, registro, edición, baja y su
cancelación, inventario inválido, referencia duplicada, permisos directos y visuales,
vecinos, ceros/separadores, pendientes, documentos duplicados, formularios vacíos,
carga, vacíos, errores y navegación. Se comprobó una respuesta tardía cancelada y
una escritura de resultado incierto que no se reintenta automáticamente.

Chromium comprobó los ciclos de artículos/vecinos en 1440x1000 y 390x844, teclado,
formularios, tablas con desplazamiento dentro de su región y axe sobre categorías,
catálogo, formularios y detalle de vecino, sin infracciones detectadas con las
reglas A/AA configuradas. No equivale a certificación WCAG ni a revisión manual
con todas las tecnologías de asistencia.

### Integración real y seguridad

El stack aislado kitchenware-infra-test-5a52f128355d ejecutó React, proxy Vite,
Laravel y PostgreSQL reales. Se verificó desde UI el registro, edición, consulta,
búsqueda y desactivación de artículo, y registro/búsqueda/detalle de vecino como
operador. Inventario nuevo/cambio de total fue 4/4 y después 5/5; el vecino nuevo
tuvo cero pendientes. Una consulta SELECT en esa base comprobó que la fila del
artículo desactivado permanece con deleted_at; GET del artículo devuelve 404.
Las protecciones 409 por préstamos abiertos y los conteos mayores de cero se
comprobaron con mocks fieles; no se crearon préstamos reales en este bloque.
La regresión de login conserva CORS, JWT y respuestas 401/403/422 reales.

El runner obtiene el número de pruebas de la salida real y no lo fija en uno.
Solo realiza el SELECT de conservación dentro del nuevo contenedor de prueba.
No modificó código API/infra, credenciales reales, base de desarrollo ni puertos
públicos. Reutilizó el aislamiento existente y comprobó metadatos/huellas de los
recursos y .env previos, sin mostrar valores. Contenedores/redes de pruebas se
retiraron y sus volúmenes se conservaron. JWT sigue solo en memoria, sin logs.

### Problemas corregidos y límites

La validación previa de URL del cliente impedía búsquedas codificadas con espacios
y puntos. Ahora valida la ruta antes del signo ?, mantiene el origen fijo y rechaza
traversal/fragmentos, permitiendo q literal codificado. Tiene prueba de regresión.
Se evitó que una búsqueda anterior tardía sobrescriba la actual y que categorías
cargadas después pierdan la selección del filtro. Las tablas conservan los títulos
de columna y su desplazamiento horizontal en móvil.

Los totales/pendientes de validación local son los conocidos al abrir el formulario;
el servidor revalida ante concurrencia. Si falla la red durante una escritura,
revisar el listado antes de repetir: abortar en el navegador no revierte el servidor.
Mantener las suites de navegador y API real secuenciales por el límite intermitente
de carga concurrente observado en 8.1; no se declara corregido/acreditado ese escenario.
La URL privada reenviada con la sesión personal de GitHub sigue sin verificación
remota automática. Las dependencias y secretos no cambiaron en este bloque.

Siguen pendientes préstamos, devoluciones, vencidos, imágenes/portadas, reportes,
gestión de operadores y despliegue Docker de React, así como page/ y tool/.
El frontend completo y T-22 no se declaran terminados. Todos los cambios de 8.2
se limitan a app/. No se ejecutó git add, git commit, git push ni cambio de rama.
