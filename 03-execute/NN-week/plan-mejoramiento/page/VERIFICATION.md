# Verificación — Kitchenware, página pública

Fecha: 2026-11-19, America/Bogota. Rama main, Git limpio al iniciar. page/ no existía.
Se revisaron constitution.md, spec.md, plan.md, architecture.md, tasks.md, estilo de
app/, sus rutas y los archivos Compose/Nginx existentes. El alcance es T-23: página
estática independiente de la API. El plan exige omitir información académica en la
presentación pública; esa información solo se conserva en esta documentación interna.

## Contenido y alcance comprobado

- Identidad Kitchenware, presentación y problema de organización comunitaria.
- Cinco categorías definidas, inventario, vecinos, préstamos/devoluciones e historial.
- Proceso de consulta, registro y devolución; tres días y máximo tres pendientes
  identificados como reglas del sistema, nunca como estadísticas de uso.
- Acceso a React para administradores/operadores, FAQ, tecnologías y pie de página.
- Ningún testimonio, nombre, documento, foto privada, registro de vecino o credencial.
- No hay formularios, consultas API, tracking, fuentes remotas ni almacenamiento web.

El manifiesto publica solo cinco archivos: HTML, CSS, JavaScript y dos SVG locales.
El servidor no expone archivos de configuración, README, pruebas ni .env. Los enlaces
hacia React se generan desde configuración pública validada, sin tokens o credenciales.
No se incluye una dirección de despliegue fija. La regla de precedencia y Codespaces
se comprueban con valores sintéticos. No se consulta ni se cambia la API de desarrollo.

## Pruebas ejecutadas y evidencia

La tabla final se registra después de cerrar las comprobaciones. La suite Node tiene
12 casos: destinos local/puerto/Codespaces/configurado, esquemas y credenciales
rechazados, errores sin valor sensible, escape de atributos, estructura/enlaces,
contenido público, manifiesto de build, ausencia de captación de datos, recursos HTTP,
HEAD, métodos rechazados y protección frente a un puerto ocupado (algunos casos
comprueban varios escenarios). Su configuración evita aislamiento por proceso para
mostrar cada caso en la salida de este entorno.

Playwright ejecuta cuatro escenarios en escritorio y móvil: renderizado, navegación,
recursos e imágenes; teclado/foco y menú; ancho 320 y movimiento reducido; navegación
sin JavaScript. Se ejecuta axe WCAG 2 A/AA y 2.1 A/AA mediante DevTools sin añadir
scripts remotos a la página ni modificar la CSP de los archivos. Se revisaron
visualmente las capturas de escritorio y móvil generadas en test-results/browser/.

La integración crea copias temporales de las fuentes públicas de React y del build
de la presentación. Dos pruebas (escritorio/móvil) pulsan el enlace y verifican el
login real de React. No escriben credenciales ni realizan peticiones a la API. Los
puertos y la caché Vite son temporales; la configuración mínima de QA no sustituye
las pruebas de infraestructura existentes. No se copian .env, datos privados o
archivos de ejecución. Al terminar se cierran únicamente los servidores del verificador.

## Incidencias corregidas

Las pruebas HTTP iniciales no pudieron abrir puertos dentro del sandbox (EPERM).
Se repitieron con la autorización de ejecución local y pasaron. No era un fallo de
los endpoints de Kitchenware ni se accedió a sus datos.
La primera auditoría detectó contraste insuficiente en el pie de ilustración durante
la animación de opacidad del contenedor. Se dejó el texto estático y la animación
solo en el dibujo decorativo. Se corrigió también una expectativa de prueba que
contaba como visible el enlace dentro del menú móvil colapsado. Se ajustó asimismo la comprobación de carga para seleccionar elementos HTML img,
separándolos de los iconos SVG inline. No se desactivaron reglas de accesibilidad ni
se cambió el comportamiento para ocultar fallos.
La revisión visual detectó que el dibujo se superponía a su etiqueta decorativa;
se corrigió el orden de apilamiento. La ilustración y marca son SVG locales, no
capturas de inventario ni imágenes de usuarios.

## Límites

No se publicó la página ni se modificó infraestructura. Docker para page/ permanece
como estrategia documentada; no se declara verificado. No se comprobó el acceso
remoto privado con una sesión GitHub real, navegadores distintos a Chromium, lectores
de pantalla o Core Web Vitals. No se repitieron pruebas del backend porque page/ no
lo utiliza. El chequeo de contenido sensible es acotado: revisión del texto, manifiesto,
configuración de URL, ausencia de formularios/API/almacenamiento y rutas privadas.
Los enlaces configurados deben apuntar al despliegue real de React antes de publicar.
Los artefactos son locales/ignorados; no se hicieron commits ni push.

## Resultado final

| Comando / comprobación   | Resultado                                                     |
| ------------------------ | ------------------------------------------------------------- |
| npm test                 | 12 aprobadas, 0 fallidas                                      |
| npm run test:e2e         | 8 aprobadas, 0 fallidas                                       |
| npm run test:integration | 2 aprobadas, 0 fallidas                                       |
| npm run check            | Aprobado; estructura, enlaces, recursos y sintaxis JavaScript |
| npm run build            | Aprobado; cinco archivos estáticos públicos                   |
| npm run format:check     | Aprobado                                                      |
| git diff --check         | Aprobado                                                      |

Total: **22 ejecuciones de pruebas aprobadas**. Ninguna omitida. Las primeras
ejecuciones con EPERM o fallos de contraste/expectativas no se cuentan como aprobadas.
Axe no detectó infracciones en las pantallas auditadas después de la corrección.
Se revisaron las capturas en escritorio y móvil; las pruebas incluyen ancho de 320 px.
El verificador de integración terminó con código 0, mostrando el login auténtico de
la copia temporal de React en ambos tamaños y cero solicitudes a la API.
La suite normal y la integración se ejecutaron secuencialmente.

En este entorno se utilizaron las herramientas de Chromium ya preparadas en /tmp:

```sh
LD_LIBRARY_PATH=/tmp/kitchenware-browser-libs/extracted/usr/lib/x86_64-linux-gnu PLAYWRIGHT_BROWSERS_PATH=/tmp/kitchenware-browser-cache npm run test:e2e
LD_LIBRARY_PATH=/tmp/kitchenware-browser-libs/extracted/usr/lib/x86_64-linux-gnu PLAYWRIGHT_BROWSERS_PATH=/tmp/kitchenware-browser-cache npm run test:integration
```

Son rutas locales de QA, no requisitos del alojamiento. La integración usa puertos
aleatorios y cierra sus procesos; Playwright cierra su servidor de presentación.
Solo se crean archivos dentro de page/ y artefactos temporales públicos de pruebas.
No hay cambios de fuentes en app/, api/, infra/, docs/ o tool/. Los archivos generados
son ignorados y los nuevos archivos de page/ quedan sin seguimiento para revisión;
por eso git diff --stat no muestra todavía un resumen de cambios, sin ejecutar git add.
