# Evidencia del frontend — bloques 8.1 a 8.4

Esta primera sección conserva la evidencia histórica de 8.1. El estado vigente
de cada bloque se conserva por separado. La implementación, pruebas y límites
del **bloque 8.4** se documentan en la última sección.

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

## Bloque 8.3 — préstamos, devoluciones y vencimientos

Fecha: 2026-11-19 (UTC). Git limpio en main antes de modificar archivos. Se revisaron
spec.md, api-contract.md, data-model.md, architecture.md, tasks.md, ADR-002/003,
las solicitudes/controladores, entidades Loan/LoanItem/Neighbor, casos de uso y
adaptador PostgreSQL reales, además de componentes, hooks y documentos de app/.
Los resultados de 8.1/8.2 anteriores son evidencia histórica, no pendientes actuales.

### Implementación y contrato

- /loans: listado paginado, estado, vecino y rango inclusivo UTC. No existe q en
  el contrato de préstamos; la búsqueda por texto pertenece al selector de vecinos.
- /loans/new: vecino existente, búsqueda paginada de artículos y selección de uno
  a tres artículos distintos, una unidad por línea; revisión y confirmación.
- /loans/:id: vecino, fechas UTC, estado calculado por API, snapshots históricos,
  disponibilidad actual consultada aparte y devolución individual confirmada.
- /overdue: listado no paginado de líneas vencidas con vecino, nombre histórico,
  fecha límite, días completos de atraso y acceso al detalle para devolver.
- Ambos roles tienen acceso; se mantienen JWT en memoria, invalidación 401,
  permanencia de sesión válida ante 403, rutas privadas y servicios compartidos.

Se integran exactamente POST/GET /loans, GET /loans/{id}, POST
/loans/{loan_id}/items/{item_id}/return y GET /loans/overdue bajo /api/v1.
El POST de creación no añade quantity, fechas, usuario ni estado. El POST de
retorno no tiene cuerpo y consume una respuesta LoanItem, no un préstamo completo.
Después del éxito se consultan de nuevo préstamo, artículos y pendientes del vecino.
No hay incrementos de stock optimistas, edición ni eliminación de préstamos.

La validación local del máximo de tres incluye todas las líneas pendientes previas,
no tres préstamos. La elegibilidad consulta el detalle del vecino y GET /loans con
status=overdue/neighbor_id/size=1. Si esa lectura falla, no permite confirmar. La API
revalida dentro de la transacción ante cualquier cambio simultáneo. Las mutaciones
no se reintentan automáticamente y tienen guardia síncrona contra doble envío.
Un 409 al devolver exige refrescar el estado; cancelar tras error también refresca.
Ante pérdida de conexión se advierte que el resultado puede ser incierto.

### Cobertura ejecutada

La tabla de resultados finales aparece al cierre de esta sección. Vitest conserva
las pruebas previas y añade casos para ambos roles, payload exacto/Bearer, vecino
seleccionado desde detalle, búsquedas, cero disponibilidad, duplicados de selección,
máximo de tres, pendientes anteriores, vencimientos, elegibilidad inaccesible,
409/422 con detalles por campo, conexión incierta y prevención de envíos dobles.
También verifica filtros UTC, paginación, snapshots, devolución confirmada/cancelada,
foco, actualización de stock/estado/pendientes, artículo fuera del catálogo activo,
conflicto de retorno, vencidos, carga/vacío/red y 401/403/404. El vencimiento de exp
con temporizadores simulados permanece cubierto en la suite de autenticación.
El servicio rechaza UUID inválidos y respuestas incompletas.

Playwright recorre selección, revisión, préstamo, devolución, cancelación, listado
y vencimientos como admin y operator, en escritorio 1440x1000 y móvil 390x844.
Usa teclado para confirmar y comprueba el foco al cancelar. Axe-core revisa las
pantallas recorridas con WCAG 2 A/AA y 2.1 A/AA y comprueba ausencia de desbordamiento
global; las tablas mantienen su propio desplazamiento. Las capturas de selección
con datos simulados están en test-results/browser/**/loan-selection.png, ignoradas.
Esto no equivale a una certificación de accesibilidad ni prueba manual con lectores.

### Integración real aislada

Se reutiliza tests/verify-api.py sin cambiar su aislamiento, la API ni infraestructura.
Cada ejecución crea un proyecto Compose kitchenware-infra-test-* y volúmenes nuevos,
credenciales efímeras y un Vite con puerto aleatorio. No consulta datos de desarrollo.
El caso nuevo crea por HTTP su vecino, artículo y operador exclusivos del stack;
usa React para registrar y devolver, y consultas reales para verificar:

- Tres días exactos entre loaned_at y due_at.
- Disponibilidad 1 → 0 → 1 y pendientes del vecino 0 → 1 → 0.
- HTTP 409 ARTICLE_NOT_AVAILABLE ante otra solicitud sin disponibilidad.
- Conservación del nombre histórico aunque el catálogo cambie de nombre.
- Estado closed después de devolver y HTTP 409 ITEM_ALREADY_RETURNED ante un
  retorno repetido, manteniendo disponibilidad 1.
- Listado histórico y consulta de vencidos vacía. Se incorpora además la consulta
  del préstamo en un rango UTC que comprende exclusivamente su día de registro.

El verificador conserva las otras dos pruebas reales de login y catálogo/vecinos,
comprueba con SELECT la conservación de la baja lógica y compara los metadatos de
contenedores/volúmenes anteriores y las huellas de .env, sin mostrarlos. Retira solo
sus contenedores/redes; conserva los volúmenes de prueba y no hace limpieza global.
Las trazas de navegador real están desactivadas. No publicar diagnósticos reales.

### Incidencias corregidas y límites

Axe detectó diferencias entre texto visible y nombre accesible en botones de
selección, devolución y detalle. Se corrigieron sin desactivar reglas. Las pruebas
esperan las lecturas y el foco asíncrono, y usan el título real del login existente.

El primer intento de navegador no pudo iniciar Chromium por bibliotecas ausentes.
Se descargaron navegador, índices y bibliotecas únicamente en /tmp, sin instalar
paquetes del sistema. La primera integración Docker se detuvo antes de ejecutar
pruebas por una capa inexistente en la caché de BuildKit. Se creó un constructor
exclusivo kitchenware-ui83-verification con caché separada, sin limpiar las capas ni
recursos existentes; la integración pudo ejecutarse. Estas incidencias de entorno
no se contabilizan como pruebas aprobadas. Se ejecutan navegador y API secuencialmente.

**Límites reales:** los vencimientos positivos y el bloqueo correspondiente se
comprueban mediante mocks fieles; no se envejecieron datos de PostgreSQL ni se
cambió el reloj del sistema. La integración real comprueba vencidos vacíos. Tampoco
se repitieron aquí las pruebas concurrentes PostgreSQL del backend: el 409 secuencial
y la prevención del doble clic no prueban bloqueos entre procesos. ADR-002 se conserva
sin cambios y su batería corresponde al backend. No se midió RNF-1 con 5.000 artículos.

El estado general y days_late vienen de Laravel; la etiqueta de vencimiento de una
línea en el detalle usa el reloj del navegador cada 30 s y puede discrepar si el equipo
tiene una hora incorrecta. No controla autorizaciones ni reglas del servidor. Las
lecturas son una instantánea; Actualizar vuelve a consultar los datos. No se añade
polling de préstamos ni sincronización entre pestañas. El destino después del login
conserva la ruta privada permitida; sus filtros no se restauran al perder la sesión.

Siguen pendientes imágenes, reportes, gestión de operadores en UI, despliegue Docker
React, comprobación remota con sesión personal GitHub, accesibilidad manual, page/ y
tool/. Este bloque no declara terminado el frontend completo ni T-22. No hay cambios
fuera de app/, migraciones, secretos ni nuevas dependencias. No se ejecutó git add,
commit, push, creación de ramas ni alteración del historial.

### Resultados finales

| Comprobación         | Resultado                                    |
| -------------------- | -------------------------------------------- |
| npm run typecheck    | Aprobado                                     |
| npm run lint         | Aprobado, sin advertencias                   |
| npm test             | 112 aprobadas, 0 fallidas; 4 archivos        |
| npm run test:e2e     | 14 aprobadas, 0 fallidas; escritorio y móvil |
| npm run test:api     | 3 aprobadas, 0 fallidas; código de salida 0  |
| npm run build        | Compilación de producción aprobada           |
| npm run format:check | Aprobado                                     |
| git diff --check     | Aprobado                                     |

Total: **129 pruebas aprobadas**, incluidas las regresiones de 8.1/8.2. Se añaden
34 casos Vitest, cuatro ejecuciones de navegador y un caso de integración real.
Hay diez archivos ejecutables de pruebas (cuatro Vitest, tres .spec.ts y tres
.real.ts), sin contar fixtures, configuración ni el runner Python.

Último proyecto real: kitchenware-infra-test-3870bebf9be1. El caso de préstamo
comprobó además el filtro inclusivo real de un solo día UTC. Una repetición previa
imprimió todas las aprobaciones y conservación pero finalizó con señal 143; no se
usó como evidencia de un comando exitoso. La última ejecución confirmó expresamente
Integration command exit status: 0. El constructor exclusivo quedó detenido; se
conservan su caché y los volúmenes aislados. No quedaron contenedores en ejecución.

Comandos utilizados en este entorno para navegador e integración, ejecutados por
separado desde app/ (las rutas temporales dependen de la preparación de Chromium):

```sh
LD_LIBRARY_PATH=/tmp/kitchenware-browser-libs/extracted/usr/lib/x86_64-linux-gnu PLAYWRIGHT_BROWSERS_PATH=/tmp/kitchenware-browser-cache npm run test:e2e
BUILDX_BUILDER=kitchenware-ui83-verification LD_LIBRARY_PATH=/tmp/kitchenware-browser-libs/extracted/usr/lib/x86_64-linux-gnu PLAYWRIGHT_BROWSERS_PATH=/tmp/kitchenware-browser-cache npm run test:api
```

BUILDX_BUILDER es una solución local a la caché dañada de este entorno; no cambia
el procedimiento del repositorio ni es necesario en un Docker sano. El constructor
conservado puede volver a arrancar al construir. No se reparó ni eliminó la caché
original del equipo.

## Bloque 8.4 — imágenes privadas, reportes, operadores y cierre funcional

Fecha: 2026-11-19, America/Bogota. Git limpio al iniciar, rama main. Se revisaron
spec.md, api-contract.md, architecture.md, tasks.md, ADR históricos, implementación
Laravel de imágenes/reportes/usuarios, autenticación, cliente HTTP, hooks, componentes,
pruebas y documentación existentes; también Compose y documentación de infraestructura.
Las secciones anteriores conservan evidencia histórica; sus pendientes no describen
el estado funcional actual. No se modifica API, contrato, migraciones ni secretos.

### Implementación

Imágenes en listado/detalle para ambos roles, descarga autenticada Blob mediante el
cliente común y URLs locales blob: revocadas. No se construye una ruta pública desde
cover_key ni se pasa JWT por URL. Se validan MIME/tamaño de respuesta y los archivos
seleccionados JPG/PNG no vacíos, de máximo 2.097.152 bytes. Las consultas obsoletas se
abortan y no crean URLs; limpiar/reintentar/desmontar revoca las anteriores. 404 de
imagen muestra alternativa, mientras otros fallos muestran errores y reintento.

PUT usa multipart con file y boundary generado por navegador. DELETE tiene confirmación,
foco y bloqueo del doble envío. Se consulta de nuevo el artículo después de modificar
su imagen. La portada no cambia inventario ni snapshots. La API sigue validando el
contenido real. Se corrigió un fallo encontrado por integración real: un mensaje de
éxito de la primera subida permanecía visible al iniciar el reemplazo. Ahora desaparece
al editar y se asocia al identificador del artículo. Tiene comprobación de regresión.

/reports requiere administrador y fechas válidas inclusivas UTC. No consulta sin
rango enviado, oculta/cancela resultados anteriores al editar fechas, muestra carga,
vacío y error, y conserva exactamente las filas/orden del servidor. Las claves incluyen
artículo/nombre/categoría históricos; no agrupa ni recalcula cantidades en React ni
supone que un artículo histórico siga activo.

/users solo registra operadores como administrador. Envía username/password/role=operator,
normaliza usuario y respeta 120 caracteres/72 bytes. No añade longitud mínima de
contraseña ni endpoints de listado, edición o eliminación. Contraseña no controlada,
sin almacenamiento persistente, estado React o logs; se vacía tras cada intento.
Las rutas administrativas rechazan operadores antes de emitir la solicitud. 401
usa cierre común; 403 conserva sesión; 409/422 permiten corregir el formulario.
El gestor de contraseñas del navegador es externo a la persistencia de la aplicación.

Inicio permite comprobar GET /health explícitamente sin Bearer; el resultado solo
indica disponibilidad del endpoint HTTP, no certifica PostgreSQL. Esto completa el
acceso desde las pantallas a los 21 endpoints documentados, sin endpoints adicionales.

### Matriz de los 21 endpoints

U = Vitest; B = navegador con respuestas simuladas; R = integración real Vite/proxy/
Laravel/PostgreSQL. La existencia de cobertura no implica probar cada combinación
posible de errores en cada despliegue. Docker tiene un caso adicional separado.

| Método y ruta bajo /api/v1                   | Acceso / pantalla                        | Evidencia                |
| -------------------------------------------- | ---------------------------------------- | ------------------------ |
| POST /auth/login                             | Público, /login                          | U/B/R                    |
| GET /health                                  | Público, botón de Inicio                 | U/R; comprobación Docker |
| POST /users                                  | Admin, /users                            | U/B/R                    |
| GET /categories                              | Ambos, /categories y selectores          | U/B/R                    |
| GET /articles                                | Ambos, /articles y selector de préstamos | U/B/R                    |
| GET /articles/{id}                           | Ambos, detalle                           | U/B/R                    |
| POST /articles                               | Admin, registro                          | U/B/R                    |
| PUT /articles/{id}                           | Admin, edición                           | U/B/R                    |
| DELETE /articles/{id}                        | Admin, baja confirmada                   | U/B/R                    |
| GET /articles/{id}/cover                     | Ambos, catálogo/detalle                  | U/B/R                    |
| PUT /articles/{id}/cover                     | Admin, detalle                           | U/B/R                    |
| DELETE /articles/{id}/cover                  | Admin, confirmación                      | U/B/R                    |
| GET /neighbors                               | Ambos, listado y selector                | U/B/R                    |
| GET /neighbors/{id}                          | Ambos, detalle y préstamos               | U/B/R                    |
| POST /neighbors                              | Ambos, registro                          | U/B/R                    |
| POST /loans                                  | Ambos, /loans/new                        | U/B/R                    |
| GET /loans                                   | Ambos, filtros y listado                 | U/B/R                    |
| GET /loans/{id}                              | Ambos, detalle                           | U/B/R                    |
| POST /loans/{loan_id}/items/{item_id}/return | Ambos, confirmación                      | U/B/R                    |
| GET /loans/overdue                           | Ambos, /overdue                          | U/B; R vacío             |
| GET /reports/most-borrowed                   | Admin, /reports                          | U/B/R                    |

Rutas verificadas contra api/routes/api.php y docs/api-contract.md. No se implementa
/auth/me ni acciones de usuarios que el contrato no ofrece. La sesión mantiene JWT
en memoria y ocho horas/exp; se conservan pruebas de expiración, 401 y roles de 8.1.

### Cobertura y evidencia real

La nueva suite Vitest comprueba lectura autenticada, ausencia de token en URL,
revocación de URLs, respuesta obsoleta abortada, alternativa sin imagen, rechazo de
un MIME de respuesta no permitido (SVG), multipart exacto, permisos, 401/403/404/422/500, errores de red,
confirmación/cancelación de borrado, frontera de 2 MB y archivos inválidos. Reportes
verifica filtros UTC, fechas reales (incluido año bisiesto), rango invertido, histórico,
orden y agrupaciones separadas del mismo artículo, vacío y restricción administrativa.
Operadores prueba normalización, rol fijo, límite en bytes, errores 401/403/409/422,
contraseña vacía tras el intento, ausencia de almacenamiento y bloqueo del doble POST.

Playwright añade cuatro ejecuciones (admin/operator, escritorio 1440x1000 y móvil
390x844) que recorren imágenes/reporte/operadores con axe WCAG 2 A/AA y 2.1 A/AA,
foco de confirmación, ausencia de desbordamiento global y regresiones anteriores.
Se sustituyeron únicamente las expectativas antiguas que trataban Reportes como una
pantalla pendiente. Los controles de autenticación y roles permanecen comprobados.
Capturas simuladas: test-results/browser/**/report.png; ignoradas, sin credenciales.

El caso real compartido prepara únicamente por HTTP sus artículos, vecino y préstamo
propios. Comprueba subida, reemplazo con nueva clave opaca, eliminación, 404 posterior,
contenido falso rechazado 422, lectura sin token 401 y permisos 403 de operador.
Edita nombre/categoría del artículo histórico, devuelve y desactiva; el reporte de
su día UTC conserva nombre/categoría originales y cuenta una línea. Registra un
operador por UI, comprueba duplicado 409 y luego ingresa con ese operador para leer
la imagen sin controles administrativos. No cambia fechas ni usa SQL para fixtures.

La primera ejecución real detectó el mensaje obsoleto de reemplazo y falló; después
de la corrección se volvió a ejecutar toda la suite. Los resultados finales de los
comandos y proyectos reales se registran al cierre de esta sección. No se publican
trazas ni credenciales reales o temporales; los diagnósticos quedan ignorados localmente.

### Docker y límites de verificación

compose.app.yaml añade app a la configuración existente, sin cambiar compose.yaml.
Construcción por npm ci/lock y Nginx sin privilegios, API por proxy del mismo origen,
rutas SPA y volumen de imágenes fuera del frontend. El contexto excluye .env y datos
locales mediante whitelist. No se incorporan secretos a dist ni al entorno de build.
El verificador Docker usa un proyecto aleatorio y puertos/volúmenes exclusivos;
comprueba tres servicios saludables, ruta profunda SPA, errores JSON de API y el
flujo real sobre React compilado. No levanta ni modifica el proyecto de desarrollo.

Se preserva infra-postgres-1, que estaba activo y saludable al iniciar; los runners
comparan identidad, arranque, montajes, puertos, reinicios, volúmenes y huellas de .env.
Se descargaron Chromium y bibliotecas únicamente en /tmp, sin instalar paquetes del
sistema. Se usa un constructor de pruebas propio kitchenware-ui84-verification para
no intervenir la caché previamente dañada del constructor predeterminado.

| Requisito | Alcance comprobado / límite                                                                                                    |
| --------- | ------------------------------------------------------------------------------------------------------------------------------ |
| RN-1      | Inventario real y conflictos secuenciales en regresión de préstamos; sin alterar reglas                                        |
| RN-2      | Plazo real de tres días; máximo acumulado validado en UI/mocks; API conserva autoridad                                         |
| RN-3      | Bloqueo por vencidos y listado positivo con mocks; integración real de vencidos vacía                                          |
| RN-4      | Snapshots reales de nombre/categoría en reporte de artículo desactivado                                                        |
| RN-5      | Baja lógica real y conservación de historia; UI sin edición/eliminación de préstamos                                           |
| RN-6      | Fechas UTC, DTO técnicos en inglés y mensajes en español                                                                       |
| RNF-1     | No se ejecutó rendimiento de 5.000 artículos; corresponde a evidencia de backend/tool                                          |
| RNF-2     | No se repitió la batería PostgreSQL concurrente; doble clic y 409 secuencial no la sustituyen                                  |
| RNF-3     | Sin persistencia/logs de contraseñas en app; validación real de login del operador; no auditoría integral de logs del servidor |
| RNF-4     | Errores uniformes consumidos y probados; binarios seguros separados de JSON                                                    |
| RNF-5     | Verificado en stack aislado: tres servicios saludables con un comando y flujo real sobre React compilado                       |

Las capturas y axe no sustituyen accesibilidad manual con tecnologías de asistencia.
No se comprobó el acceso HTTPS privado con sesión GitHub del usuario ni despliegues
públicos: requieren terminación TLS externa. Las etiquetas Docker base son móviles,
no se promete reproducción bit a bit. El reloj local solo orienta etiquetas vencidas;
Laravel autoriza las operaciones. Las escrituras con fallo de red pueden haberse
guardado: se advierte consultar antes de repetir. Sin endpoints de listado de usuarios,
un registro de resultado incierto requiere revisar por medios administrativos antes
de repetir; el frontend no inventa un GET de usuarios para resolverlo.

Quedan comprobaciones manuales/remotas y evidencias de rendimiento/concurrencia del
backend no repetidas en este bloque, page/ y tool/. Las pantallas funcionales del
contrato están implementadas; no se declara completa toda la entrega ADSO/T-22.
No se ejecutó git add, commit, push ni cambios de ramas/historial.

### Resultados finales ejecutados

| Comando                                              | Resultado final                              |
| ---------------------------------------------------- | -------------------------------------------- |
| npm test                                             | 148 aprobadas, 0 fallidas, cinco archivos    |
| npm run test:e2e                                     | 18 aprobadas, 0 fallidas, escritorio y móvil |
| npm run test:api                                     | Cuatro aprobadas, código de salida 0         |
| npm run test:docker                                  | Una aprobada, código de salida 0             |
| npm run typecheck                                    | Aprobado                                     |
| npm run lint                                         | Aprobado, sin advertencias                   |
| npm run build                                        | Producción compilada correctamente           |
| npm run format:check                                 | Aprobado                                     |
| Prettier sobre compose.app.yaml e infra/README.md    | Aprobado                                     |
| AST Python de ambos verificadores y git diff --check | Aprobados                                    |

Total: **171 ejecuciones de pruebas aprobadas**. Se conservan las regresiones de
8.1–8.3 y se añaden 36 casos Vitest, cuatro ejecuciones de navegador, un caso real y
otro sobre Docker estático. Hay 14 archivos ejecutables de prueba: cinco Vitest,
cuatro .spec.ts, cuatro .real.ts y un .docker.ts, sin contar fixtures y runners.

Proyectos finales: kitchenware-infra-test-b76fe8de6fa3 (Vite/proxy/API) y
kitchenware-infra-test-3881146a193e (React/Nginx/API/PostgreSQL). En ambos se aprobaron
las comprobaciones de conservación de recursos previos y .env. Docker además comprobó
UID distinto de cero, ruta SPA profunda, health, 401 JSON, 404 JSON para /api/v1 y
/api/v1/not-existing, y 404 para un asset inexistente. El proxy no convierte errores
API en HTML de la SPA. Se ejecutó el flujo completo con reemplazo PNG por JPG.

Una repetición real imprimió todas las aprobaciones/conservación y terminó con señal
143, incidencia ya observada en 8.3. Se aisló la sesión del servidor Vite auxiliar
mediante start_new_session y se repitió la suite, confirmando explícitamente salida 0.
No se atribuye con certeza la señal al servidor ni se acredita estabilidad exhaustiva
con ejecuciones simultáneas; las suites continúan ejecutándose secuencialmente.
La prueba Docker final también confirmó explícitamente salida 0. Los fallos iniciales
corregidos no se cuentan como aprobaciones de esas ejecuciones.

El constructor kitchenware-ui84-verification se deja detenido, conservando caché y
volúmenes de prueba. No se detiene infra-postgres-1 ni ningún recurso previo. Comandos
utilizados desde app/, una vez preparado Chromium y bibliotecas temporales:

```sh
LD_LIBRARY_PATH=/tmp/kitchenware-browser-libs/extracted/usr/lib/x86_64-linux-gnu PLAYWRIGHT_BROWSERS_PATH=/tmp/kitchenware-browser-cache npm run test:e2e
BUILDX_BUILDER=kitchenware-ui84-verification LD_LIBRARY_PATH=/tmp/kitchenware-browser-libs/extracted/usr/lib/x86_64-linux-gnu PLAYWRIGHT_BROWSERS_PATH=/tmp/kitchenware-browser-cache npm run test:api
BUILDX_BUILDER=kitchenware-ui84-verification LD_LIBRARY_PATH=/tmp/kitchenware-browser-libs/extracted/usr/lib/x86_64-linux-gnu PLAYWRIGHT_BROWSERS_PATH=/tmp/kitchenware-browser-cache npm run test:docker
```

Las rutas /tmp y el constructor son preparación local de este entorno; no se necesitan
esas variables en un equipo con Chromium/dependencias y Docker ya configurados.
No se limpió la caché original dañada ni se modificaron paquetes del sistema.
