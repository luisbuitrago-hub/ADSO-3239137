# Kitchenware — Frontend React, bloques 8.1 a 8.4

Resultados ejecutados y límites de verificación: [VERIFICATION.md](VERIFICATION.md).

Base del frontend, inicio/cierre de sesión y navegación, junto con categorías,
catálogo de artículos, registro/consulta de vecinos y préstamos, devoluciones y
vencimientos, imágenes privadas, reportes históricos y registro de operadores.
Se conserva la API y se añade un complemento Compose para ejecutar React compilado.
No se modifican datos de desarrollo, secretos, requisitos, page/ ni tool/.

## Decisiones y estructura

La documentación exige React y no fija lenguaje, router ni herramienta de build.
Se adopta TypeScript estricto para expresar el contrato, Vite para desarrollo/build,
React Router en modo declarativo y Context para autenticación. El cliente usa fetch
nativo, sin Axios, estado global adicional, librería de componentes o servicios externos.
Los iconos SVG y la tipografía del sistema no requieren descargas de terceros.

```text
app/
├── src/
│   ├── auth/          # Context, proveedor, validación de respuesta y vencimiento
│   ├── components/    # AppShell, datos, formularios, paginación e iconos
│   ├── hooks/         # Lecturas cancelables, mutaciones y parámetros de listado
│   ├── pages/         # Login, catálogo, vecinos, préstamos y vencimientos
│   ├── routes/        # Secciones y permisos visuales
│   ├── services/      # HTTP, catálogo, vecinos, préstamos y validaciones
│   ├── types/         # Contratos reales de sesión, catálogo, vecinos y préstamos
│   ├── App.tsx        # Rutas públicas/privadas, título y foco
│   ├── main.tsx       # Composición y límite de errores de arranque
│   └── styles.css     # Diseño adaptable y estados de foco/error/carga
├── tests/             # Vitest, navegador e integración aislada con Laravel
├── .env.example      # Solo configuración pública y destino del proxy
└── package-lock.json # Versiones reproducibles, incluido mediante excepción local
```

La excepción de package-lock.json en app/.gitignore conserva el lock sin cambiar
el ignore del repositorio, que excluye ese nombre globalmente.

## Requisitos e instalación

Node 22.22.2+, 24.15+ o 26+ (versiones compatibles con todas las herramientas); recomendado Node 24 LTS
(verificado con 24.22.2 y npm 11.19.1). Navegador moderno con fetch y AbortController.

Desde `03-execute/NN-week/plan-mejoramiento/app/`:

```bash
npm ci
npm run dev
```

Vite utiliza `http://127.0.0.1:5173`, sin cambiar a otro puerto silenciosamente si está
ocupado. No detener procesos ajenos; escoger un DEV_PORT libre en la configuración
local. La API se levanta según ../infra/README.md, en una instalación autorizada.
El frontend no ejecuta migraciones, no crea administradores ni necesita contraseñas
en su configuración. Solicitar credenciales al administrador.

## Variables y conexión con Laravel

No es necesario crear un .env para usar los valores predeterminados. Si se requiere
personalización, copiar .env.example a un archivo local ignorado, sin secretos.

| Variable          | Valor predeterminado  | Alcance                                                               |
| ----------------- | --------------------- | --------------------------------------------------------------------- |
| VITE_API_BASE_URL | /api/v1               | URL pública del cliente; relativa o URL absoluta terminada en /api/v1 |
| API_PROXY_TARGET  | http://127.0.0.1:8080 | Destino del proxy Vite, solo del servidor, sin ruta ni credenciales   |
| DEV_PORT          | 5173                  | Puerto de desarrollo; estricto, sin reemplazar procesos               |

Con la configuración predeterminada, el navegador solicita su mismo origen:
`/api/v1/auth/login`. Vite reenvía `/api/v1` a Laravel en el equipo del servidor.
El navegador del usuario **no** necesita acceder al localhost del Codespace.
El proxy mantiene el contrato, el cuerpo JSON y Authorization; no introduce nuevos
endpoints ni una segunda lógica de autenticación.

Para acceso directo a una API remota, configurar una URL absoluta pública HTTPS
que termine en /api/v1. Laravel debe permitir el origen exacto del frontend mediante
su CORS_ORIGIN; no activar comodines ni enviar cookies. No mezclar un frontend HTTPS
con una API HTTP remota. No usar localhost del servidor como URL remota del navegador.
Aquí se conserva CORS del backend sin cambios.

VITE_* se incorpora al bundle público: nunca colocar JWT_SECRET, APP_KEY, claves,
contraseñas ni tokens allí. Se rechazan URLs con credenciales, parámetros o fragmentos.

## GitHub Codespaces

1. Iniciar una API accesible desde el Codespace, sin alterar la base existente.
2. En app/, ejecutar npm ci y npm run dev, con un puerto libre.
3. En **Ports**, reenviar el DEV_PORT elegido manteniendo visibilidad privada y
   abrir la URL que ofrece GitHub. No se cambia la visibilidad automáticamente.
4. Mantener VITE_API_BASE_URL=/api/v1 y usar API_PROXY_TARGET con el destino
   alcanzable desde Vite, normalmente http://127.0.0.1:8080.

Vite permite los hosts concretos derivados de CODESPACE_NAME, DEV_PORT y el dominio
de reenvío del entorno; no usa allowedHosts=true. Si cambia puerto/configuración,
reiniciar Vite. El control privado de GitHub es independiente del JWT de Laravel:
no incrustar un GITHUB_TOKEN para saltarlo. El proxy del mismo origen evita tener
que publicar un segundo puerto o autenticar el navegador contra dos URLs privadas.

Se comprueba automáticamente HTTP y Chromium dentro del Codespace. La apertura
de la URL privada en el navegador personal requiere la sesión GitHub del usuario;
no se declara comprobada por este bloque.

## Autenticación y permisos

El único endpoint usado por la pantalla de acceso es POST /api/v1/auth/login con
username y password. La respuesta exige access_token, token_type=Bearer,
expires_in=28800 y role=admin u operator. El usuario se normaliza a minúsculas y se
recortan espacios exteriores; la contraseña conserva sus espacios. La identificación
visible es ese nombre introducido, porque el contrato no devuelve un perfil.

El JWT vive solo en memoria del proveedor. No se escribe en localStorage,
sessionStorage, cookies ni URL, y no se registra en consola. Cada pestaña requiere
su propio acceso. **Recargar/cerrar destruye la sesión del frontend**; la pantalla
explica ese comportamiento y permite volver a ingresar. No hay renovación automática,
auth/me ni endpoint de logout: no están documentados en la API.

Se lee exp para programar vencimiento y se limita la sesión a las ocho horas del
contrato. La pestaña vuelve a comprobarlo al recuperar foco/visibilidad. Esta lectura
no verifica la firma ni sustituye a Laravel; el reloj del cliente debe ser correcto.
Un 401 de una petición Bearer elimina la sesión y devuelve al login. Un 403 conserva
la sesión y comunica falta de permisos. Un 401 tardío de una sesión anterior no
cierra otra sesión iniciada después. El cliente cancela intentos reemplazados y usa
timeout de 15 segundos; el formulario bloquea envíos duplicados y limpia la contraseña
después de errores.

Cerrar sesión elimina el estado local e impide continuar por rutas privadas. No
revoca en el servidor una copia externa del JWT: esa copia vence según Laravel.
No mostrarla ni compartirla. El rol visual proviene de la respuesta del login;
Laravel consulta el rol vigente y sigue siendo la autoridad. Un cambio de rol en
servidor puede requerir volver a ingresar para actualizar el menú; no habilita
operaciones prohibidas en la API.

| Ruta del frontend  | Acceso           | Estado                                 |
| ------------------ | ---------------- | -------------------------------------- |
| /login             | Público          | Login funcional                        |
| /home              | Admin y operador | Inicio e identificación de sesión      |
| /categories        | Admin y operador | Categorías reales y acceso al filtro   |
| /articles          | Admin y operador | Listado, búsqueda, filtro y paginación |
| /articles/:id      | Admin y operador | Detalle e inventario                   |
| /articles/new      | Admin            | Registro                               |
| /articles/:id/edit | Admin            | Edición                                |
| /neighbors         | Admin y operador | Listado, búsqueda y paginación         |
| /neighbors/new     | Admin y operador | Registro                               |
| /neighbors/:id     | Admin y operador | Detalle y artículos pendientes         |
| /loans             | Admin y operador | Listado, filtros y paginación          |
| /loans/new         | Admin y operador | Selección, revisión y registro         |
| /loans/:id         | Admin y operador | Historial, inventario y devolución     |
| /overdue           | Admin y operador | Líneas vencidas y acceso a devolución  |
| /reports           | Admin            | Reporte histórico por fechas UTC       |
| /users             | Admin            | Registro de operadores                 |

Son rutas del navegador, no endpoints adicionales del backend. Operadores no ven
administración; el acceso directo también muestra restricción. Sin sesión, las
rutas privadas llevan al login y conservan solo un destino interno permitido.

## Catálogo y vecinos — bloque 8.2

| Endpoints bajo /api/v1 | Uso y permisos                                             |
| ---------------------- | ---------------------------------------------------------- |
| GET /categories        | Consulta para ambos roles; sin mantenimiento de categorías |
| GET /articles          | q por nombre/descripción, category_id, page y size         |
| GET /articles/{id}     | Detalle activo con categoría, referencia y unidades        |
| POST /articles         | Registro exclusivo admin                                   |
| PUT /articles/{id}     | Edición exclusiva admin, sin enviar reference              |
| DELETE /articles/{id}  | Baja lógica admin, con confirmación explícita              |
| GET /neighbors         | q por nombre/documento, page y size                        |
| GET /neighbors/{id}    | Detalle con active_loans                                   |
| POST /neighbors        | Registro para admin y operator                             |

Los listados conservan búsqueda/filtros/página en la URL; las búsquedas y cambios
de filtro/tamaño vuelven a página 1. Tamaño predeterminado 20, máximo 50. Se muestran
el total y las unidades disponibles reales. Las lecturas anteriores se cancelan
al navegar o cambiar filtros y no reemplazan resultados más recientes. Solo se
muestran datos recibidos; no hay estadísticas, categorías ni registros de muestra
incorporados al código de producción.

Artículos: nombre obligatorio hasta 250 caracteres, descripción hasta 200 y
referencia hasta 50. Categoría procedente de GET /categories y total entero entre
1 y 2147483647. No se asignan UUID, disponibilidad, cover_key ni deleted_at desde
formularios. Referencia inmutable al editar; la disponibilidad la recalcula Laravel.
No se permite localmente un total menor que las unidades pendientes conocidas al
abrir el formulario. El servidor vuelve a verificar inventario/rol/unicidad ante
cambios concurrentes y puede rechazar con 422 aunque la validación local pase.

La baja solicita confirmación y conserva el historial. Un 409
ARTICLE_HAS_OPEN_LOANS no quita el artículo de la pantalla; REFERENCE_TAKEN y
DOCUMENT_TAKEN se muestran en su campo. Las respuestas 401 invalidan sesión, 403
comunican permisos, 404 muestran inexistencia y 422 presentan errores por campo o
regla. No se consultan ni administran portadas en este bloque.

Vecinos: nombre obligatorio hasta 200 caracteres y documento entre 1 y 30, ambos
con espacios exteriores recortados. El documento se conserva como texto: no se
convierte a número, no se eliminan separadores y no se cambia su capitalización.
No se agregan restricciones numéricas ajenas al contrato. active_loans se presenta
como **artículos pendientes de devolución**, incluidos vencidos, no como número
de préstamos. No hay acciones de edición ni eliminación de vecinos.

Los formularios impiden solicitudes duplicadas, conservan valores si hay error
y vuelven a consultar el detalle después de crear/editar, o el catálogo tras una
baja. No hay reintentos automáticos de escrituras: ante fallo de conexión puede
haberse confirmado la operación; revisar el listado antes de volver a guardar.
Los controles administrativos se ocultan al operador y sus rutas directas también
están restringidas. Estas restricciones visuales no reemplazan las de Laravel.

## Build, lint y pruebas

```bash
npm run typecheck
npm run lint
npm run format:check
npm test
npm run build
npm run preview
```

El build genera dist/. Preview usa 127.0.0.1:4173 y el proxy solo para comprobación
local; no es un servidor de producción. Al desplegar los archivos estáticos, el
servidor debe resolver las rutas SPA a index.html y enrutar /api/v1 a Laravel o
compilar la URL absoluta correcta. No se integra Docker/frontend en este bloque.

Para navegador real (Chromium y sus bibliotecas requeridas):

```bash
npx playwright install chromium
npm run test:e2e
```

Vitest/Testing Library cubren renderizado, validación, contrato, errores de red,
401/403/422/500, carga, duplicados, rutas, roles, logout, recarga, expiración y
respuestas inválidas. Los JWT de fixtures se construyen por ejecución: no son
firmas válidas para Laravel ni secretos reales. Playwright comprueba escritorio
y móvil, teclado, ausencia de desbordamiento, navegación y axe sobre login/home.
Estas verificaciones no constituyen una certificación integral WCAG.

Ejecutar las suites de navegador y de API real secuencialmente. Durante la revisión
se observó un timeout intermitente de la primera carga al lanzarlas simultáneamente;
la ejecución separada terminó correctamente. Las cachés Vite se separan por modo
y puerto, pero no se acredita estabilidad de ambas suites concurrentes.

Para integración real, además se necesitan Docker y Python 3, con acceso al daemon:

```bash
npm run test:api
```

El script reutiliza el verificador de infra/ sin modificarlo: inicia un proyecto
único con credenciales generadas, PostgreSQL y Laravel independientes, y un Vite
en puerto libre. Chromium comprueba login, Bearer, CORS, 401, 403, 422, categorías,
CRUD de artículos permitido y registro/búsqueda de vecinos a través del proxy.
Una consulta SELECT de solo lectura confirma la fila desactivada en la base aislada.
Los operadores y datos de pruebas se crean por la API únicamente en esa
base aislada. No se conecta al PostgreSQL de desarrollo ni lee sus credenciales;
la preservación de archivos .env se comprueba mediante huellas internas, sin
imprimirlas. Finalmente detiene solo sus servidores/contenedores/redes y conserva
los volúmenes de prueba. No usa limpieza global ni elimina volúmenes existentes.

Si al navegador le faltan bibliotecas, instalarlas en un entorno de pruebas
autorizado o usar sus rutas temporales mediante LD_LIBRARY_PATH. En esta ejecución
se extrajeron bibliotecas e índices APT en /tmp y se usó PLAYWRIGHT_BROWSERS_PATH
también en /tmp; no se instalaron paquetes en el sistema del Codespace.

Artefactos locales ignorados: test-results/browser/ (capturas sin credenciales),
test-results/live/ y dist/. Las trazas de navegador están desactivadas para evitar
capturar credenciales. No publicar diagnósticos de login real.

## Pendientes

Las pantallas del contrato están implementadas. La evidencia y sus límites se
registran por bloque en VERIFICATION.md. Quedan rendimiento con 5.000 artículos,
accesibilidad manual, comprobación remota privada con sesión GitHub, page/ y tool/.
No se declara terminada la entrega completa ni toda la tarea T-22.

Referencias: contrato en ../docs/api-contract.md, decisiones en ../docs/plan.md,
[Vite](https://vite.dev/guide/), [React Router](https://reactrouter.com/start/declarative/installation)
y [Vitest](https://vitest.dev/guide/).

## Préstamos, devoluciones y vencimientos — bloque 8.3

Ambos roles usan las rutas /loans, /loans/new, /loans/:id y /overdue. Desde el detalle
de un vecino se puede iniciar un préstamo con ese vecino seleccionado o consultar
sus préstamos. Los identificadores de vecino del listado enlazan al registro real;
la API no incluye su nombre en cada préstamo. El detalle obtiene el vecino aparte.

| Endpoint bajo /api/v1                        | Uso                                                           |
| -------------------------------------------- | ------------------------------------------------------------- |
| POST /loans                                  | neighbor_id e items: [{article_id}], sin cantidades ni fechas |
| GET /loans                                   | status, neighbor_id, from, to, page y size; sin búsqueda q    |
| GET /loans/{id}                              | Estado calculado por API y snapshots de las líneas            |
| POST /loans/{loan_id}/items/{item_id}/return | Sin cuerpo; devuelve la línea actualizada                     |
| GET /loans/overdue                           | Líneas vencidas sin paginación ni filtros adicionales         |

El contrato permite entre uno y tres artículos distintos, **una unidad por línea**.
No hay campo quantity ni devolución parcial de una línea. El máximo de tres cuenta
todas las líneas pendientes del vecino, incluidas las vencidas y las de otros
préstamos. Antes de revisar se consultan active_loans y los préstamos vencidos de
ese vecino. El catálogo muestra existencias reales, impide agregar duplicados y
artículos sin disponibilidad y permite retirar selecciones. Se busca por nombre o
descripción y se pagina el catálogo; el selector de vecinos busca nombre/documento
y también pagina. El registro exige una revisión y confirmación separadas.

Laravel calcula los tres días y vuelve a comprobar pendientes, vencimientos e
inventario dentro de las transacciones y bloqueos de ADR-002. La comprobación del
navegador es informativa: otro operador puede cambiar el resultado antes del POST.
No se descuenta inventario en memoria ni se modifica el stock mediante PUT.

El detalle usa los nombres, referencias y categorías históricos de loan_item;
consultar el inventario actual no sustituye esos datos. Tras registrar o devolver
se vuelven a consultar el préstamo, el vecino y cada artículo. Al volver al listado
se hace una lectura nueva. Un artículo que ya no figure en el catálogo activo no
impide consultar su historial ni tramitar una línea pendiente autorizada por API.

Solo las líneas con returned_at nulo ofrecen devolución. La confirmación recibe el
foco; cancelar lo devuelve al botón inicial. Hay bloqueo síncrono del doble envío.
Un error de devolución requiere consultar el estado actualizado antes de confirmar
otra vez; no hay reintentos de escritura automáticos. Ante un fallo de red, revisar
los préstamos porque el servidor podría haber guardado la operación. Los errores
422 muestran los detalles de validación; 409 conserva la selección para corregirla.
401 usa el cierre de sesión común y 403 conserva una sesión válida.

Todas las fechas se presentan en UTC. from/to se envían como fechas inclusivas UTC.
El estado del préstamo y days_late proceden de Laravel. La indicación de una línea
vencida en el detalle compara due_at con el reloj local cada 30 segundos; puede
variar si el reloj del equipo está desajustado. No autoriza ni bloquea operaciones.
Actualizar vuelve a consultar el estado del servidor. Los días de atraso pueden
ser cero cuando aún no se ha completado el primer día desde el vencimiento.

Tipos y validación de respuestas: src/types/loans.ts y src/services/loans.ts.
useLoans reutiliza el cliente JWT; useRemote y useMutation mantienen cancelación,
errores y prevención de duplicados. No hay dependencias nuevas ni cambios de API.
Las pruebas y sus límites se registran en VERIFICATION.md; no se alteran el reloj
del sistema ni datos de desarrollo para preparar vencimientos.

## Imágenes, reportes y operadores — bloque 8.4

| Endpoint bajo /api/v1       | Pantalla y permisos                                              |
| --------------------------- | ---------------------------------------------------------------- |
| GET /articles/{id}/cover    | Catálogo/detalle, ambos roles                                    |
| PUT /articles/{id}/cover    | Detalle, administrador                                           |
| DELETE /articles/{id}/cover | Detalle con confirmación, administrador                          |
| GET /reports/most-borrowed  | /reports, administrador                                          |
| POST /users                 | /users, administrador; siempre role=operator                     |
| GET /health                 | Comprobación explícita desde Inicio; petición pública sin Bearer |

La imagen se descarga mediante el cliente autenticado como Blob. El elemento img
solo recibe una URL blob: local, nunca un token ni una ruta pública de almacenamiento.
cover_key solo indica la existencia/versión y no se convierte en URL. Se revocan
las URLs al cambiar imagen, reintentar o desmontar; se abortan consultas y se ignoran
respuestas obsoletas. Sin cover_key no se pide el archivo; 404 ofrece la alternativa
sin imagen. Otros errores permiten consultar de nuevo sin ocultar un 401/403.

Administradores pueden subir o reemplazar por PUT multipart con el único campo
file y eliminar tras confirmar. Se valida MIME JPG/PNG, tamaño no vacío y máximo
2.097.152 bytes; Laravel valida el contenido real. El navegador establece el boundary
multipart. Los binarios recibidos también deben tener MIME JPG/PNG y tamaño válido.
Se conserva la política privada/no-store. El éxito actualiza el artículo y su imagen;
el listado hace una consulta nueva al volver. No se guardan archivos en storage web.

Reportes requiere ambas fechas válidas AAAA-MM-DD, inclusivas UTC, con final mayor
o igual a inicial. No se consulta hasta enviar. Cambiar fechas oculta resultados
anteriores y cancela su lectura. Se muestran las filas y el orden recibidos: cantidad
descendente, después nombre histórico; no se recalculan cantidades ni se agrupa por
el catálogo actual. Un artículo puede aparecer varias veces por cambios históricos.
Los artículos desactivados pueden figurar y no se enlazan a un detalle activo supuesto.

Operadores ofrece únicamente registro: usuario obligatorio de 1–120 caracteres,
normalizado a minúsculas y sin espacios exteriores, contraseña obligatoria de máximo
72 bytes y rol operator fijo. No se inventa longitud mínima, listado, edición ni baja.
La contraseña es un input no controlado, se envía solo en el cuerpo de la solicitud
y se vacía después de cada intento. No se incorpora al estado, URL, almacenamiento
local/de sesión ni logs. No se puede impedir que un gestor de contraseñas externo
actúe por decisión del usuario. 409 identifica nombre repetido; 422 muestra detalles;
401 retira la sesión y 403 no invalida una sesión válida. Se impide doble envío.

Los selectores de archivo, formularios y confirmaciones conservan etiquetas, foco,
estados de error/carga, navegación por teclado y diseño móvil. Las rutas de reportes
y operadores también se protegen al ingresar directamente como operador.

## React compilado con Docker

El archivo base infra/compose.yaml continúa ejecutando solo API y PostgreSQL. El
complemento infra/compose.app.yaml incorpora app, sin modificar sus volúmenes ni
montar el código del equipo. Después de configurar los secretos según infra/README.md,
en una instalación autorizada, desde infra/:

```sh
docker compose -f compose.yaml -f compose.app.yaml up --build -d --wait --wait-timeout 180
```

app publica 127.0.0.1:5173 por defecto, configurable con APP_BIND_ADDRESS/APP_PORT.
No ejecutar ese comando sobre contenedores existentes sin revisar proyecto/puertos;
las verificaciones de este bloque usan exclusivamente proyectos aleatorios aislados.
En Codespaces abrir el puerto privado del servicio app. El navegador usa el mismo
origen HTTPS reenviado y /api/v1 pasa por Nginx hacia api:8080; no necesita conocer
el puerto de Laravel ni habilitar CORS abierto. No se verificó la sesión GitHub remota.

La construcción usa npm ci y el lockfile, compila React y sirve dist mediante Nginx
sin privilegios en 8080. No hay Vite ni Node en runtime. app/.dockerignore permite
solo fuentes/configuración pública, excluyendo .env, node_modules, pruebas y artefactos.
La imagen solo contiene archivos estáticos y nginx.conf; no recibe secretos de API.
Las rutas SPA se resuelven a index.html y las rutas /api/v1 conservan errores JSON,
Bearer y binarios privados. Los assets inexistentes devuelven 404. El proxy admite
el sobrecoste multipart y Laravel mantiene el límite de 2 MB del archivo.
Las etiquetas base de Docker son móviles; no se promete reproducción bit a bit.

## Verificación del bloque 8.4

```sh
npm run typecheck
npm run lint
npm test
npm run test:e2e
npm run test:api
npm run test:docker
npm run format:check
npm run build
```

Las suites de navegador, API y Docker se ejecutan por separado. test:api conserva
Vite/proxy y Laravel/PostgreSQL aislados. test:docker comprueba tres servicios healthy
con un comando y ejecuta el flujo de imágenes/reporte/operadores contra la compilación
estática y Nginx en otro proyecto aislado, sin Vite. Ambos verificadores conservan
volúmenes, comparan metadatos previos y huellas de .env, y no publican credenciales.
El caso compartido prepara historia exclusivamente mediante HTTP; nunca cambia SQL
de desarrollo ni el reloj del sistema. Resultados concretos en VERIFICATION.md.
