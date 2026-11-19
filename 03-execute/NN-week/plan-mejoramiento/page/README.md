# Kitchenware — Página pública (bloque 9)

Presentación estática del producto, independiente de Laravel y de PostgreSQL.
No es una segunda aplicación administrativa: explica el sistema y enlaza a React.
No consulta la API, publica registros ni contiene formularios, credenciales,
estadísticas de uso, testimonios o datos de vecinos.

## Requisitos y decisiones

- Node.js 24 o posterior; verificado con Node 24.22.2 y npm 11.19.1.
- Navegador moderno. El contenido, preguntas y enlaces funcionan sin JavaScript.
- HTML semántico, CSS adaptable, JavaScript nativo y SVG propios/locales.
- Ninguna dependencia de ejecución ni fuentes, imágenes o scripts de terceros.
- Playwright, axe-core y Prettier son únicamente herramientas de desarrollo, con
  versiones exactas en package-lock.json.

T-23 en ../docs/tasks.md pide producto, problema, funcionalidades, tecnologías,
diseño adaptable e independencia del backend. ../docs/plan.md, fase 8, exige además
no mostrar información sobre la prueba técnica o el plan académico en la página.
Se preserva la distinción de ../docs/architecture.md: page/ presenta; app/ gestiona.
El diseño utiliza los verdes, crema y naranja de app/, con una ilustración SVG local.

## Instalación y ejecución local

Desde `03-execute/NN-week/plan-mejoramiento/page/`:

```sh
npm ci
npm run dev
```

Abrir `http://127.0.0.1:4174`. El servidor es para desarrollo y solo escucha en loopback.
Sirve una lista explícita de archivos públicos; no expone README, pruebas, configuración
ni archivos .env. Si el puerto está ocupado falla y no reemplaza otro proceso.
Para cambiarlo: `PAGE_PORT=4175 npm run dev`. No requiere levantar API ni base de datos.

El servidor no incluye recarga automática: recargar el navegador después de editar.
El HTML se prepara al iniciar; reiniciar el servidor tras cambiar HTML o configuración.
CSS/JS/SVG se leen al solicitarlos y llevan Cache-Control no-store en la vista local.

## Acceso a la aplicación React

Los tres enlaces de acceso usan el mismo destino, validado e insertado en HTML.
No necesitan JavaScript ni abren ventanas nuevas. La ruta /login existe en app/src/App.tsx.

| Variable pública                         | Comportamiento                                                                  |
| ---------------------------------------- | ------------------------------------------------------------------------------- |
| KITCHENWARE_APP_URL                      | Destino completo explícito; tiene prioridad                                     |
| KITCHENWARE_APP_PORT                     | Puerto real de React; 5173 por defecto, según infra/compose.app.yaml            |
| CODESPACE_NAME                           | Si existe, deriva el host reenviado al puerto de React                          |
| GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN | Dominio de reenvío; coincide con app/vite.config.ts, por defecto app.github.dev |
| PAGE_PORT                                | Puerto del servidor de presentación; 4174 por defecto                           |

Sin Codespaces ni destino explícito se usa `http://127.0.0.1:5173/login`, que corresponde
al puerto local documentado de React. Si React usa otro puerto:

```sh
KITCHENWARE_APP_PORT=6001 npm run dev
```

Para otro origen, establecer KITCHENWARE_APP_URL con la dirección real de React y su
ruta de acceso. Solo admite HTTP/HTTPS sin credenciales, query ni fragmento, o una ruta
absoluta del mismo origen. No se aceptan esquemas ejecutables ni URLs con tokens.
Una ruta como /login solo corresponde si presentación y React comparten origen y el
proxy envía esa ruta a la aplicación; en servidores separados usar el origen completo.
No se deduce el destino de parámetros de URL ni del encabezado Host del visitante.

En Codespaces abrir el puerto privado 4174 de la presentación y el puerto real de
React. El origen se deriva de las variables del entorno, como en la configuración
existente de Vite; KITCHENWARE_APP_URL permite reemplazarlo. La derivación está probada
con valores de prueba. El acceso remoto privado con sesión GitHub requiere revisión
manual; no se declara comprobado. No hay una URL pública de despliegue versionada.

## Compilación estática

```sh
npm run check
npm run build
```

El build no transpila ni requiere bibliotecas: prepara el destino de acceso y copia
únicamente index.html, styles.css, site.js y los dos SVG en dist/. Esa carpeta se
puede servir con cualquier alojamiento estático. Publicar únicamente dist/, nunca
la raíz de page/ ni el repositorio. No incluye Node, pruebas ni secretos.
No abrir src/index.html como producto final: contiene el marcador de configuración;
utilizar la vista local o el archivo generado dist/index.html.

Antes de publicar, definir KITCHENWARE_APP_URL con el destino real de la aplicación y
volver a ejecutar el build. El destino queda incluido en el HTML generado; no cambia
por modificar variables del alojamiento después de compilar. El build predeterminado
es para vista local/Codespaces, no una dirección de producción supuesta.
Los cinco recursos publicados ocupan aproximadamente 30 KB sin comprimir; este dato
mide archivos, no tiempos de carga ni uso comunitario.

## Pruebas

```sh
npm test
npm run check
npm run format:check
npm run build
```

Para navegador, preparar Chromium y sus bibliotecas en el entorno de pruebas:

```sh
npx playwright install chromium
npm run test:e2e
```

Las herramientas pueden necesitar autorización de red/ejecución para descargar
Chromium, abrir puertos locales y lanzar el navegador. No instalar paquetes globales
si el entorno no lo permite. En esta ejecución se reutilizaron Chromium y bibliotecas
de /tmp, sin instalar paquetes del sistema.

Pruebas nativas Node (sin dependencias): contenido público, configuración de destinos,
escape HTML, build, recursos, HTTP, encabezados y rechazo de rutas privadas. Se usa
--test-isolation=none para mostrar cada caso de forma explícita en este entorno.
Playwright verifica escritorio 1440×1000, móvil 390×844 y ancho de 320 px, enlaces,
teclado, foco, menú, imágenes cargadas, recursos locales, FAQ, movimiento reducido,
contenido sin JavaScript y axe WCAG 2 A/AA y 2.1 A/AA.

### Integración real con app/

Requiere las dependencias ya utilizadas por React (`npm ci` dentro de app/ si faltan):

```sh
npm run test:integration
```

El verificador copia solo fuentes públicas de React a un directorio temporal, reutiliza
sus herramientas instaladas y asigna caché y puertos de prueba propios. Sirve una
compilación de esta página con el enlace al puerto temporal real. Comprueba en ambos
tamaños que pulsar el acceso abre el formulario de login de React. Intercepta cualquier
solicitud a /api/v1 y exige que no exista ninguna. No introduce credenciales, no inicia
sesión, no requiere PostgreSQL y no modifica fuentes de app/ ni secretos .env.
El servidor Vite temporal usa configuración mínima de QA con el plugin React; esta
prueba verifica la aplicación y el enlace, no el despliegue Docker de React.
Al terminar cierra únicamente sus servidores. No reutiliza procesos de desarrollo.

Resultados detallados, incidencias y límites: [VERIFICATION.md](VERIFICATION.md).
Capturas ignoradas: test-results/browser/**/presentation.png. dist/, node_modules/ y
artefactos de pruebas están ignorados. La excepción local de .gitignore conserva el
lockfile sin modificar las reglas del repositorio.

## Estrategia futura para Docker Compose

No se cambió infra/: su configuración de API/PostgreSQL/React ya está comprobada.
La página puede desplegarse como un cuarto servicio estático independiente:

1. Compilar dist/ con el destino público real de React mediante KITCHENWARE_APP_URL.
2. Preparar un complemento Compose separado, por ejemplo compose.page.yaml, para un
   servidor estático sin privilegios. Publicar un puerto libre solo en loopback y
   copiar dist/ a la imagen o montarlo en modo de solo lectura.
3. Conservar compose.yaml y compose.app.yaml, sus volúmenes, redes y servicios. La
   presentación no requiere red de base de datos ni secretos o credenciales de API.
4. Exponer por el proxy HTTPS autorizado y mantener privados los puertos de Codespaces.
   Si se usan orígenes separados, el enlace debe contener el origen real de React;
   no añadir un prefijo /app/ porque React actualmente utiliza rutas desde la raíz.
5. Comprobar rutas, MIME, recursos, acceso al login y cabeceras de seguridad en ese
   despliegue antes de acreditarlo. No ejecutar el arranque sobre servicios existentes
   sin revisar proyecto y puertos.

Esta es una estrategia documentada: no se añadió un servicio Docker ni se ejecutó
un despliegue de page/. Por tanto, no se acredita aquí la integración Docker de la
página. El servidor de desarrollo proporciona CSP y nosniff; el alojamiento estático
elegido debe configurar sus propias cabeceras y HTTPS.

## Alcance y pendientes

No hay funcionalidades de inventario o gestión duplicadas ni enlace de registro
público de vecinos. La página permanece utilizable sin backend y sin JavaScript;
JavaScript solo mejora menú y foco. Las animaciones CSS respetan prefers-reduced-motion.
No hay seguimiento, cookies ni almacenamiento del navegador.

Quedan publicación, integración Docker de page/, prueba del origen remoto privado
con sesión GitHub y accesibilidad manual con lectores de pantalla. Axe y las pruebas
no constituyen una certificación de accesibilidad ni una auditoría universal de
secretos; la revisión se acota al contenido, recursos publicados y comportamiento
verificados. No se mide Core Web Vitals ni rendimiento bajo carga.

Los commits y la publicación son responsabilidad del usuario. No se ejecutó git add,
git commit, git push ni cambios de ramas/historial. No se desarrolló tool/ ni se
modificaron funcionalidades o datos de Laravel, React o PostgreSQL.
