# Kitchenware — Frontend React, bloque 8.1

Resultados ejecutados y límites de verificación: [VERIFICATION.md](VERIFICATION.md).

Base del frontend, inicio/cierre de sesión y navegación del sistema comunitario de
préstamo de utensilios. **Los módulos de negocio todavía no están implementados.**
No se modifican API, infraestructura, page/, tool/, secretos ni requisitos.

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
│   ├── components/    # AppShell, navegación, identidad e iconos
│   ├── pages/         # Login, inicio, pendientes y acceso restringido/404
│   ├── routes/        # Secciones y permisos visuales
│   ├── services/      # HTTP, errores, timeout, Bearer y respuesta 401
│   ├── types/         # Contrato real de login, sesión y errores
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

| Ruta del frontend | Acceso           | Estado                                   |
| ----------------- | ---------------- | ---------------------------------------- |
| /login            | Público          | Login funcional                          |
| /home             | Admin y operador | Inicio e identificación de sesión        |
| /articles         | Admin y operador | Informativa, sin operaciones de catálogo |
| /neighbors        | Admin y operador | Informativa                              |
| /loans            | Admin y operador | Informativa                              |
| /overdue          | Admin y operador | Informativa                              |
| /reports          | Admin            | Informativa                              |
| /users            | Admin            | Informativa                              |

Son rutas del navegador, no endpoints adicionales del backend. Operadores no ven
administración; el acceso directo también muestra restricción. Sin sesión, las
rutas privadas llevan al login y conservan solo un destino interno permitido.

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
en puerto libre. Chromium comprueba login, Bearer, 401, 403, 422, categorías y logout
a través del proxy. El operador de pruebas se crea por la API únicamente en esa
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

Catálogo/categorías, imágenes, vecinos, préstamos/devoluciones, vencidos, reportes
y gestión de operadores requieren sus bloques funcionales. Las tarjetas actuales
indican explícitamente su estado pendiente y no consultan ni inventan estadísticas.
Quedan también integración Docker de React, despliegue estático, verificación
remota con sesión GitHub y revisión de accesibilidad con tecnologías de asistencia.
T-22 y el frontend completo no están terminados.

Referencias: contrato en ../docs/api-contract.md, decisiones en ../docs/plan.md,
[Vite](https://vite.dev/guide/), [React Router](https://reactrouter.com/start/declarative/installation)
y [Vitest](https://vitest.dev/guide/).
