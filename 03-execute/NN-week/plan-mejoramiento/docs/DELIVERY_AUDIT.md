# Kitchenware — Auditoría final y preparación de entrega

Fecha de cierre de las comprobaciones: 19 de noviembre de 2026 en America/Bogota;
20 de noviembre en UTC. Rama main. Git limpio antes de intervenir. Repositorio:
[luisbuitrago-hub/ADSO-3239137](https://github.com/luisbuitrago-hub/ADSO-3239137).

## Proyecto, tecnologías y estructura

Kitchenware administra el préstamo comunitario de utensilios de cocina: catálogo y
categorías, vecinos, operadores, inventario, préstamos, devoluciones, vencidos,
imágenes privadas y reportes históricos. Los vecinos no tienen acceso directo a la
aplicación. Administradores y operadores acceden mediante JWT con permisos distintos.

| Carpeta | Implementación y responsabilidad                                                    |
| ------- | ----------------------------------------------------------------------------------- |
| docs/   | Especificación, contrato, modelo, arquitectura, tareas y tres ADR                   |
| api/    | Laravel 12, dominio independiente, casos de uso, puertos, adaptadores y PHPUnit     |
| infra/  | PostgreSQL 16, PHP 8.4/Apache, Compose, verificadores y despliegue React/Nginx      |
| app/    | React 19.3.1, TypeScript, Vite, Vitest y Playwright                                 |
| page/   | Presentación pública HTML/CSS/JavaScript, compilación y servidor Node de desarrollo |
| tool/   | Sembrador HTTP en Python estándar, escenarios, recibos y comprobaciones             |

Versiones observadas en el stack nuevo: PHP 8.4.28, Laravel 12.72.0 y PostgreSQL
16.16. El PHP del host usado por PHPUnit es 8.4.27; Node del host 24.22.2.
Las etiquetas Docker no están fijadas a un digest: no se promete reproducción bit a bit.

## Causa del fallo y configuración segura

Compose interpola sus variables antes de ejecutar incluso ps. infra/.env.example
no se carga automáticamente y api/.env no abastece esa interpolación. Faltaba
infra/.env y por eso fallaban ADMIN_PASSWORD, ADMIN_USERNAME, APP_KEY,
POSTGRES_PASSWORD y JWT_SECRET. No era un error del esquema ni de PostgreSQL.

Se creó infra/.env de forma exclusiva, sin sobrescribir archivos, con permisos
0600, contraseñas y secretos nuevos mediante secrets/os.urandom de Python y clave
Laravel de 32 bytes codificados en base64. Las cinco variables quedaron configuradas.
Git ignora el archivo; solo .env.example está versionado. api/.env se inspeccionó
sin revelar valores y no se modificó. Sus secretos de desarrollo no se reutilizaron.
No hay secretos como argumentos de construcción ni archivos públicos.

Configuración local no sensible:

| Elemento            | Valor / alcance                                             |
| ------------------- | ----------------------------------------------------------- |
| Proyecto nuevo      | kitchenware-delivery-15ef2c2662a2                           |
| API                 | http://localhost:18080/api/v1                               |
| React/Nginx         | http://localhost:15173/login                                |
| Publicación web     | Solo 127.0.0.1                                              |
| PostgreSQL nuevo    | Red interna, sin puerto publicado                           |
| Volumen PostgreSQL  | kitchenware-delivery-15ef2c2662a2_kitchenware_postgres_data |
| Volumen de imágenes | kitchenware-delivery-15ef2c2662a2_kitchenware_covers_data   |

El PostgreSQL previo infra-postgres-1, puerto 127.0.0.1:5432 y volumen
infra_kitchenware_postgres_data no se conectó a la nueva API. No se consultaron ni
modificaron sus tablas. El verificador comparó identidad, arranque, reinicios,
puertos y montajes de los otros contenedores, metadatos de volúmenes y huellas de
api/.env e infra/.env en memoria: las comparaciones pasaron. Esto prueba preservación
de esos metadatos, no una auditoría del contenido de la base anterior.

No se ejecutaron git add/commit/push, cambios de rama, alteraciones de fechas,
Docker down/rm/prune, eliminación de volúmenes, db:wipe ni migrate:fresh.
Solo se reiniciaron los tres servicios nuevos de esta auditoría para probar
persistencia. Los contenedores y volúmenes previos se conservaron.

## Integración comprobada

El comando combinado construyó los tres servicios y todos alcanzaron healthy.
La preparación existente de Laravel creó desde una base vacía el esquema kitchenware,
las seis tablas de negocio y migrations, seis migraciones, las cinco categorías
y el administrador tomado del entorno. Se consultaron metadatos para confirmar
las tablas y las restricciones ck_article_total_positive y ck_user_role.
Se corrigió únicamente su clasificación desactualizada en data-model.md a Motor;
no se cambiaron requisitos ni migraciones.

El login emitió JWT admin de 28800 segundos. La contraseña inicial se verificó
contra BCrypt sin imprimirla ni imprimir el hash. Nginx sirvió React sin root y
reenvió /api/v1 a Laravel. Se comprobó rechazo 401 sin JWT y CORS de origen exacto.

Una imagen se subió por PUT multipart a través de Nginx, obtuvo clave opaca y
permisos de directorio 0700/archivo 0600. La descarga autenticada conservó bytes;
sin token respondió 401. /storage/<clave> no entrega la imagen: Nginx devuelve el
HTML público de la SPA. El primer intento del verificador esperaba 404 como en
la API directa; se corrigió esa expectativa, no el producto, y se repitió la revisión.

Después de stop/start del proyecto nuevo persistieron datos, imagen, JWT y la
inicialización sin duplicar categorías ni administrador. No se acredita aquí una
restauración de backup ni recuperación tras pérdida del host.

El navegador recorrió React compilado/Nginx/Laravel/PostgreSQL: login, imagen PNG,
reemplazo JPG, errores, eliminación, reporte histórico, creación de operador y
rechazos 403. Dos pruebas adicionales en escritorio/móvil abrieron el login real
de ese React desde una copia estática temporal de page/, sin consultar la API ni
almacenar datos en la página pública. page/ no se añadió como servicio Docker.

## Resultados de pruebas y comandos

| Comprobación ejecutada en esta auditoría                                    | Resultado                                                                            |
| --------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| api/: composer test                                                         | 188 pruebas, 1201 aserciones, 0 fallidas; SQLite en memoria                          |
| composer validate --no-check-publish                                        | Aprobado                                                                             |
| composer check-platform-reqs                                                | Aprobado                                                                             |
| composer audit --locked --no-plugins --format=json                          | Sin avisos ni paquetes abandonados en la consulta                                    |
| Pint --test en app/bootstrap/config/routes/tests/factories/seeders          | Aprobado, sin modificaciones                                                         |
| app/: npm test                                                              | 148 pruebas, 5 archivos, 0 fallidas                                                  |
| app/: npm run build y npm run lint                                          | Aprobados; compilación incluye TypeScript                                            |
| page/: npm test                                                             | 12 pruebas, 0 fallidas                                                               |
| page/: npm run check y npm run build                                        | Aprobados                                                                            |
| page/: npm run test:e2e                                                     | 8 pruebas, 0 fallidas; Chromium escritorio/móvil, teclado, movimiento reducido y axe |
| page/: acceso a React/Nginx real mediante playwright.integration.config.mjs | 2 pruebas, 0 fallidas                                                                |
| tool/: python3 -m unittest discover -s tests -t . -v                        | 27 pruebas, 0 fallidas                                                               |
| infra/: verificador final con --existing --restart-owned --browser          | 23 comprobaciones, 0 fallidas; incluye 1 prueba real de navegador                    |
| tool/: seed y verify contra el nuevo proyecto propio                        | Salida 0; 40 artículos, 10 vecinos, 15 préstamos y 16 líneas históricas propias      |
| tool/: overdue inmediatamente después                                       | Salida 2 esperada: 0 vencidas, 3 pendientes; no es prueba positiva de vencidos       |
| Sondeo de cuerpo >3 MiB al proxy                                            | HTTP 413 text/html: incumplimiento pendiente del formato uniforme                    |

El primer intento de integración falló por la expectativa 404 mencionada arriba;
no se cuenta como aprobado. Se conservó el proyecto creado, se corrigió el verificador
y se retomó sin reconstruir ni reemplazar sus recursos. La revisión final pasó.
El sondeo 413 identifica una limitación del producto y no se oculta entre los éxitos.

No se repitió la batería PostgreSQL costosa ni el perfil HTTP de 5000 artículos:
no se modificó código API, y se revisaron evidencias recientes existentes:

- BACKEND_AUDIT.md: 80 pruebas PostgreSQL, 798 aserciones, 0 fallidas. Cuatro casos
  críticos ADR-002 con conexiones independientes y bloqueos observados: última unidad
  201/409; mismo vecino 201/422; devolución 200/409; atomicidad sin cambios parciales.
- tool/VERIFICATION.md y .runs/kitchenware-tool-test-19de03b2c5a0/results.json:
  5000 artículos creados por HTTP, diez búsquedas paginadas, mediana 35,936 ms y
  máximo/p95 60,633 ms; todas inferiores a 300 ms. La evidencia JSON se leyó de nuevo.
- Los informes app/VERIFICATION.md y page/VERIFICATION.md conservan los recorridos
  anteriores por bloque. Sus listas antiguas de pendientes son históricas.

Los contadores checks de herramientas/verificadores no son aserciones PHPUnit.
Las bibliotecas de Chromium faltaban en el host: se descargaron y extrajeron en
/tmp/kitchenware-delivery-libs y Chromium en /tmp/kitchenware-delivery-browsers.
Se empleó LD_LIBRARY_PATH, sin instalar ni actualizar paquetes del sistema.

## Contrato: 21 endpoints

Rutas relativas a /api/v1. V = ruta y permisos cotejados y pruebas funcionales del
backend ejecutadas; PG = evidencia PostgreSQL anterior revisada, no repetida.
Ambos significa admin/operator. Los dos endpoints públicos no necesitan token.

| Método | Ruta                                    | Acceso  | Estado / evidencia                                        |
| ------ | --------------------------------------- | ------- | --------------------------------------------------------- |
| GET    | /health                                 | Público | V; HTTP real por Nginx                                    |
| POST   | /auth/login                             | Público | V/PG; login real                                          |
| POST   | /users                                  | Admin   | V/PG; creación y prohibición reales en navegador          |
| GET    | /categories                             | Ambos   | V/PG; cinco categorías por HTTP                           |
| GET    | /articles                               | Ambos   | V/PG; consultas del sembrador                             |
| GET    | /articles/{id}                          | Ambos   | V/PG; consulta real                                       |
| POST   | /articles                               | Admin   | V/PG; registro real                                       |
| PUT    | /articles/{id}                          | Admin   | V/PG; snapshot comprobado por sembrador/UI                |
| DELETE | /articles/{id}                          | Admin   | V/PG; baja lógica en recorrido UI                         |
| PUT    | /articles/{id}/cover                    | Admin   | V/PG; multipart real                                      |
| DELETE | /articles/{id}/cover                    | Admin   | V/PG; eliminación en UI                                   |
| GET    | /articles/{id}/cover                    | Ambos   | V/PG; bytes y permisos reales                             |
| GET    | /neighbors                              | Ambos   | V/PG; consultas reales                                    |
| GET    | /neighbors/{id}                         | Ambos   | V/PG; detalle real por sembrador                          |
| POST   | /neighbors                              | Ambos   | V/PG; datos sintéticos propios                            |
| POST   | /loans                                  | Ambos   | V/PG; préstamos y restricciones reales                    |
| GET    | /loans                                  | Ambos   | V/PG; consulta real                                       |
| GET    | /loans/{id}                             | Ambos   | V/PG; historial real                                      |
| POST   | /loans/{loan_id}/items/{item_id}/return | Ambos   | V/PG; devoluciones y repetición reales                    |
| GET    | /loans/overdue                          | Ambos   | V/PG; consulta real aún vacía, positivo anterior en tests |
| GET    | /reports/most-borrowed                  | Admin   | V/PG; reporte real, también rechazo de operador           |

ApiContractTest pasó dentro de las 188 pruebas: verifica el conjunto exacto de
21 rutas, middlewares y JSON uniforme en las 19 protegidas sin token. No se agregó
/auth/me ni ningún endpoint adicional. La conformidad de errores del proxy conserva
la salvedad 413 que se describe abajo.

## Reglas y requisitos académicos

| Regla                                               | Estado y evidencia                                                                                |
| --------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| RN-1 Inventario entre cero y total                  | Verificada en suite actual, sembrador real y evidencia PG/concurrencia                            |
| RN-2 Tres días y máximo tres pendientes             | Verificada en suite, sembrador y evidencia PG; no se adelantaron fechas reales                    |
| RN-3 Bloqueo por vencidos                           | Pruebas del backend/evidencia PG aprobadas; demostración natural nueva pendiente                  |
| RN-4 Snapshots históricos                           | Suite, reporte y cambio de catálogo reales aprobados                                              |
| RN-5 Historial no eliminable y baja lógica          | Rutas, pruebas y recorrido UI; limpieza HTTP conserva historia                                    |
| RN-6 UTC, identificadores inglés y mensajes español | Código/documentación y pruebas; conexión nueva confirma UTC                                       |
| RNF-1 <300 ms con 5000 artículos                    | Acreditado para el perfil local del sembrador ya medido; no para cualquier red/carga              |
| RNF-2 Última unidad concurrente                     | Evidencia PostgreSQL ADR-002 revisada; no se repitió en esta auditoría                            |
| RNF-3 Contraseñas protegidas                        | BCrypt real, pruebas y revisión de logs del proyecto aislado; no certifica todo despliegue futuro |
| RNF-4 Errores uniformes                             | Parcial: Laravel pasa; Nginx devuelve HTML en HTTP 413 al exceder 3 MiB                           |
| RNF-5 Arranque de servicios con un comando          | Verificado para PostgreSQL/API/React con Compose combinado y configuración inicial previa         |

Hay 40 archivos *Test.php en api/tests: 38 excluyendo los dos ExampleTest, distribuidos
entre dominio, casos de uso, HTTP, PostgreSQL y arquitectura. Superan el mínimo de
15 archivos; no se confundió ese requisito con el número de métodos. Hay además
cinco archivos unitarios de app/ y tres de page/, más suites de navegador y herramientas.
ArchitectureTest pasó; se revisaron entidades, objetos de valor, servicios, puertos,
adaptadores y composición. No se prueba formalmente todo SOLID mediante un test.

| Tareas                         | Estado consolidado                                                                                                  |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------- |
| T-01 a T-15                    | Implementadas, revisión de documentos/código, suite actual y evidencia PostgreSQL/infra existente                   |
| T-16 Adaptador HTTP            | 21 rutas y errores Laravel verificados; salvedad del proxy 413 pendiente                                            |
| T-17 Composición/arranque      | Verificado desde base nueva y administrador por entorno                                                             |
| T-18 Restricciones adicionales | Confirmadas en migraciones y metadatos PG nuevo; clasificación documental corregida                                 |
| T-19 Arquitectura              | Suite actual aprobada y revisión de dependencias                                                                    |
| T-20 Compose                   | Tres servicios saludables e integración real verificadas                                                            |
| T-21 Sembrador                 | Parcial: cantidades y reporte acreditados; tres vencidas naturales aún no                                           |
| T-22 React                     | Implementado; suite de 148 pruebas, build/lint y recorrido Docker real aprobados; evidencias anteriores conservadas |
| T-23 Página pública            | Implementada; móvil/escritorio/accesibilidad y enlace al React real comprobados; no requiere Docker para funcionar  |

## Historial Git: carpetas y días

Se consultó git log filtrado exclusivamente por la raíz Kitchenware, tanto fechas
de autor como de committer, sin alterarlas. El repositorio no es superficial.
85 commits únicos afectan Kitchenware. El recuento por carpeta puede contar un
mismo commit en más de una carpeta cuando las modifica juntas.

| Carpeta | Commits que la afectan | Con prefijo propio |
| ------- | ---------------------- | ------------------ |
| docs    | 10                     | 10 docs:           |
| api     | 44                     | 43 api:            |
| infra   | 8                      | 6 infra:           |
| app     | 16                     | 15 app:            |
| page    | 4                      | 4 page:            |
| tool    | 4                      | 4 tool:            |

Se revisaron asuntos y separación temática de configuración, código, pruebas y
documentación. Las seis carpetas superan o alcanzan cuatro commits significativos;
no se cuentan archivos sin commit ni se crea historial para satisfacer la condición.

| Fecha          | Commits por día UTC | Commits por día America/Bogota |
| -------------- | ------------------- | ------------------------------ |
| 2026-11-12     | 11                  | 11                             |
| 2026-11-13     | 2                   | 5                              |
| 2026-11-14     | 15                  | 12                             |
| 2026-11-15     | 0                   | 16                             |
| 2026-11-16     | 22                  | 6                              |
| 2026-11-17     | 0                   | 7                              |
| 2026-11-18     | 7                   | 8                              |
| 2026-11-19     | 28                  | 20                             |
| Días distintos | 6                   | 8                              |

Autor y committer coinciden en estos recuentos. Los siete commits que aparecen el
18 UTC corresponden al 17 en Colombia. La condición de ocho días está acreditada
en America/Bogota; no lo está si el instructor exige ocho fechas UTC. Debe presentarse
esta diferencia sin modificar timestamps ni afirmar que existen ocho días UTC.

## Iniciar y demostrar de forma segura

Desde la raíz Kitchenware, consultar infra/README.md antes de crear otra instalación.
No copiar .env.example encima del .env local existente ni regenerar sus claves.
Los usuarios/contraseñas de esta instalación están solo en el archivo privado o el
gestor de secretos del responsable; no se incorporan al informe ni a comandos.

Desde infra/, con el archivo privado ya configurado para el proyecto propio:

```sh
docker compose -f compose.yaml -f compose.app.yaml config --quiet
docker compose -f compose.yaml -f compose.app.yaml ps
docker compose -f compose.yaml -f compose.app.yaml up --build -d --wait --wait-timeout 180
curl --fail http://localhost:18080/api/v1/health
curl --fail http://localhost:15173/api/v1/health
```

Abrir http://localhost:15173/login; en Codespaces reenviar ese puerto con visibilidad
privada. El acceso remoto con la sesión personal GitHub requiere revisión manual;
solo se acreditó localhost. No usar -p infra ni publicar PostgreSQL.

Para la página pública independiente, desde page/:

```sh
KITCHENWARE_APP_URL=http://localhost:15173/login PAGE_PORT=14174 npm run dev
```

Abrir http://localhost:14174. Este puerto es una propuesta de ejecución, no un
servicio que haya quedado arrancado por la auditoría; verificar que esté libre.
La integración automatizada utilizó un servidor temporal con puerto aleatorio.
Para compilar, usar la misma KITCHENWARE_APP_URL con npm run build. No publicar
esa dirección local como URL de un despliegue remoto.

Para pruebas rápidas: composer test en api/, npm test en app/ y page/, y
python3 -m unittest discover -s tests -t . -v en tool/. Los verificadores Docker
anteriores tienen su propio ciclo de recursos; esta auditoría empleó verify-delivery.py
para conservar contenedores y volúmenes. No repetir pruebas costosas sin necesidad.

## Evidencia pendiente y limitaciones de entrega

1. RNF-4: normalizar en el proxy el HTTP 413, que hoy es text/html. No se cambió
   app/nginx.conf ni el contrato para esconder el hallazgo. Solicitudes normales y
   errores de Laravel conservan code/message/details. La validación de imagen sigue
   siendo 2 MiB; el límite de transporte Nginx de 3 MiB admite el multipart.
2. T-21: se dejó un conjunto propio persistente en este stack con tres líneas
   pendientes. El recibo privado está en tool/.runs/delivery-kitchenware-delivery-15ef2c2662a2.jsonl.
   La comprobación positiva debe realizarse después de 2026-11-23T00:59:56Z
   (22 de noviembre, 19:59:56 en America/Bogota). Las credenciales permanecen en
   infra/.env; mantenerlas estables. Seguir tool/README.md, cargar sus variables
   desde un entorno privado y ejecutar overdue y overdue --apply con ese recibo.
   No ejecutar cleanup antes de demostrarlo, no cambiar el reloj ni editar fechas SQL.
3. Verificar con el instructor el criterio de zona horaria de los ocho días.
4. Se reejecutó Pint global y no aprobó por estilo previo en tres migraciones:
   2026_11_14_025611_create_user_table.php, 2026_11_14_025755_create_loan_table.php y
   2026_11_14_025923_create_loan_item_table.php. No se reescribieron por cosmética.
   El Pint acotado pasó; las seis migraciones se ejecutaron correctamente y la
   validación de sintaxis de 180 archivos PHP no detectó errores.
5. No se acredita publicación externa, TLS de producción, Docker para page/,
   restauración de backups, lectores de pantalla ni rendimiento bajo carga pública.
   Son límites de evidencia; no se añaden como requisitos académicos nuevos.
6. Revisar y publicar los cambios de esta auditoría personalmente. Los informes
   antiguos describen sus fechas; este documento consolida el estado actual sin
   declarar completada toda la entrega mientras persistan las salvedades anteriores.

Evidencias detalladas: [backend](../api/BACKEND_AUDIT.md),
[infraestructura](../infra/VERIFICATION.md), [React](../app/VERIFICATION.md),
[página pública](../page/VERIFICATION.md) y [herramientas](../tool/VERIFICATION.md).

## Adenda: corrección acotada del HTTP 413 de Nginx

La observación RNF-4 anterior corresponde al despliegue auditado. Se corrigió en
app/nginx.conf mediante error_page y una ubicación interna con nombre: los HTTP 413
generados por Nginx mantienen su estado y devuelven application/json; charset=utf-8:

```json
{
  "code": "PAYLOAD_TOO_LARGE",
  "message": "La solicitud supera el tamaño máximo permitido.",
  "details": []
}
```

PAYLOAD_TOO_LARGE identifica este rechazo de transporte; no sustituye el
VALIDATION_ERROR/422 de Laravel ni añade un endpoint. No se habilita intercepción
de errores del upstream. Se conserva client_max_body_size 3m y la validación de
imágenes de Laravel de 2 MiB. No se modificaron reglas, contrato ni archivos .env.

La regresión infra/tests/test_nginx_413.py usa dos contenedores nuevos, Nginx real
con el archivo fuente actualizado y un upstream PHP simulado, en una red exclusiva.
Reutiliza imágenes locales sin descargarlas ni reconstruir el stack. No inicia ni
conecta PostgreSQL. Comprueba 4 MiB por POST/PUT, límite exacto 3 MiB, rechazo a
3 MiB + 1, campos JSON/UTF-8/ausencia de redirección y conservación de errores 422.
Los tres métodos de prueba aprobaron. La primera ejecución detectó que faltaba
declarar application/json entre charset_types; se corrigió y se repitió la suite.
nginx -t pasó. Se compararon metadatos de contenedores anteriores, existencia de
volúmenes y huellas privadas de los .env: sin cambios. Solo se detuvieron los
contenedores nuevos, conservando sus recursos.

También se ejecutó composer test -- --filter ArticleCoverTest: 13 pruebas,
126 aserciones, 0 fallidas, en SQLite en memoria. No se repitieron pruebas ajenas
a esta corrección ni se modificaron migraciones o código Laravel.

Reproducción desde la raíz Kitchenware, con Docker y las imágenes locales indicadas
(ajustar sus nombres si se utiliza otra instalación compatible):

```sh
NGINX_TEST_IMAGE=kitchenware-delivery-15ef2c2662a2-app:latest \
PHP_TEST_IMAGE=kitchenware-delivery-15ef2c2662a2-api:latest \
python3 infra/tests/test_nginx_413.py
```

Había 1,9 GiB libres en el volumen del proyecto; el test exige al menos 256 MiB.
La corrección está verificada **en aislamiento**, no aplicada al servicio del puerto 15173. Actualizarlo requiere reconstruir/recrear su contenedor app, operación que
no se ejecutó por la prohibición de reemplazar contenedores existentes. PostgreSQL
del puerto 5432 y los tres servicios de entrega permanecen intactos. El cierre del
hallazgo en ese despliegue queda pendiente de aplicar el cambio con autorización;
esta adenda no declara resueltos otros posibles errores del proxy ni cambia los
demás pendientes académicos del informe.
