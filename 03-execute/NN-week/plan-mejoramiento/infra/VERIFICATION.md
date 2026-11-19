# Evidencia de infraestructura — bloque 7

La primera verificación se conserva a continuación. La ampliación solicitada el
2026-11-18 y sus resultados actualizados están al final de este documento.

Fecha local: 2026-11-17 (America/Bogota; los logs de contenedores usan UTC).
Estado inicial de Git limpio. Se leyó documentación, ADR, configuración Laravel,
README y auditoría del backend antes de implementar. No había app/ ni page/.

## Entorno y aislamiento

- Docker Engine 29.9.2-2; Compose v5.6.1.
- Imagen construida con PHP 8.4.27; PostgreSQL 16.16 de la imagen oficial 16.
- pdo_pgsql y Sodium cargados. La imagen no contiene .env ni DB_PASSWORD incorporada.
- La instancia previa infra-postgres-1, puerto 127.0.0.1:5432 y volumen
  infra_kitchenware_postgres_data permanecieron intactos. No se conectaron pruebas
  a esa base ni se recreó/reinició su contenedor.
- La verificación final utilizó proyecto kitchenware-infra-test-92c357c3422d,
  base/usuario kitchenware_verify, credenciales aleatorias efímeras y puerto API
  aleatorio en localhost. Los otros intentos también usaron proyectos únicos.
- Se retiraron contenedores/redes de prueba, conservando todos sus volúmenes.
  Seis proyectos de verificación dejaron doce volúmenes con prefijo
  kitchenware-infra-test-*. No se borraron volúmenes, imágenes ni datos reales.

## Resultados ejecutados

| Comprobación | Resultado final |
|---|---|
| Construcción runtime y testing | Aprobada, dependencias del lock instaladas |
| python3 infra/tests/verify-stack.py | 27 comprobaciones aprobadas, 0 fallidas |
| composer test dentro de kitchenware-api-tests | 188 pruebas, 1.201 aserciones, 0 fallidas |
| composer test:integration desde api/ | 80 pruebas, 798 aserciones, 0 fallidas; PostgreSQL temporal |
| Total pruebas API | 268 pruebas, 1.999 aserciones, 0 fallidas |
| sh -n de ambos entrypoints | Aprobado |
| php -l de preflight.php y healthcheck.php | Aprobado |
| Compilación sintáctica de verify-stack.py | Aprobada |
| git diff --check | Aprobado |

Las 27 comprobaciones incluyen configuración Compose, red interna, volúmenes
aislados, acceso PostgreSQL opcional limitado a localhost, construcción/arranque,
salud HTTP y PostgreSQL, seis migraciones, cinco categorías, administrador y JWT
de ocho horas, consulta de categorías, creación de artículo y PUT multipart real.

También comprueban archivos privados 0600, bytes descargados, exactamente 2 MiB
aceptados, 2 MiB + 1 rechazados con JSON uniforme, reemplazo, rechazo sin JWT,
ausencia de publicación directa, CORS, proceso web UID 33 y ausencia de .env.
Reinicio y recreación conservan datos, imágenes y validez JWT. La preparación se
repite sin duplicar categorías, migraciones ni administrador y conserva inventario.

Los logs generados no contienen las contraseñas, APP_KEY, JWT_SECRET ni tokens
conocidos de la prueba. Se incluyó una contraseña temporal en la query de un login
fallido para verificar que el access log no la registre. APP_KEY inválida, JWT
corto y origen comodín impiden el arranque sin mostrar valores sensibles.
Esta comprobación no afirma que todo log de cualquier despliegue futuro sea seguro.

La integración PostgreSQL repitió las cuatro evidencias del ADR-002:

| Escenario | Evidencia |
|---|---|
| Última unidad | HTTP 201/409; dos conexiones bloqueadas observadas; stock 0; una línea pendiente |
| Mismo vecino | HTTP 201/422; dos conexiones bloqueadas observadas; tres pendientes |
| Devolución duplicada | HTTP 200/409; dos conexiones bloqueadas observadas; stock 1; una devolución |
| Atomicidad | HTTP 409; inventario original; cero préstamos y líneas parciales |

## Fallos encontrados y corregidos

El primer arranque no iniciaba Apache después de bajar privilegios desde un
entrypoint root: se corrigió ejecutando el contenedor directamente como www-data
y preparando permisos del volumen en la imagen. Se añadió el reenvío de
Authorization para conservar JWT al resolver rutas mediante Apache.

Dos pruebas rápidas dependían implícitamente de las claves del .env del equipo:
el target testing ahora genera claves exclusivamente de prueba al iniciar cada
contenedor, sin modificar código API ni incluir secretos en capas de imagen.
La comprobación CORS se ajustó al contrato existente: un único origen permitido
puede aparecer como cabecera fija; no autoriza a otro origen porque no coincide.
No se cambió CORS ni sus requisitos para satisfacer la prueba.

La revisión automática bloqueó inicialmente el build por riesgo de incluir .env.
Se incorporó el .dockerignore explícito en la raíz y las construcciones posteriores
fueron autorizadas y verificadas sin .env dentro de las imágenes.

## Alcance y pendientes

RNF-5 está acreditado para los servicios hoy existentes: PostgreSQL y API se
construyen, preparan e inician con docker compose up --build -d tras configurar
secretos una sola vez. T-20 incluye React y sigue parcial; el arranque del producto
completo debe verificarse cuando exista app/. page/ y tool/ siguen pendientes.
No se cambiaron requisitos ni estados académicos para declarar completada esa tarea.

README documenta instalación, respaldo de base/imágenes, recuperación en proyecto
nuevo y revisión conservadora de huérfanos. No se ejecutó restauración completa de
backup, simulación de pérdida de host, proxy TLS, rotación de claves ni despliegue
público. No se promete atomicidad distribuida de base y archivos ni multirréplica.
Persistencia no sustituye respaldos externos. El rendimiento con el sembrador HTTP
y los demás pendientes de la auditoría previa mantienen su propio ámbito.

Todos los cambios están en infra/ excepto .dockerignore en la raíz del proyecto,
necesario para proteger el contexto de build. No se modificó código API, migraciones,
configuración real de secretos, ramas ni historial. No se ejecutó git add/commit/push.

## Revalidación y protección del Codespace — 2026-11-18

Fecha local America/Bogota. Al comenzar esta ampliación había dos archivos
modificados y catorce nuevos del bloque anterior, todos conservados. Rama main.
Se revisaron otra vez los documentos, ADR, contrato y configuración real; app/,
page/ y tool/ siguen ausentes. No se reimplementaron las funcionalidades existentes.

El inventario de solo lectura encontró infra-postgres-1 con ID 628a6f7c6818,
saludable, puerto 127.0.0.1:5432 y volumen infra_kitchenware_postgres_data.
Se revisaron también los demás puertos en escucha, sin detener sus procesos.
Los doce volúmenes de pruebas anteriores permanecieron conservados.

La prueba ahora captura metadatos antes de cualquier arranque y los compara
después de retirar su propio stack: identidad, fecha de arranque, reinicios,
estado, puertos y montajes de los contenedores previos; identidad de volúmenes;
y huellas de api/.env e infra/.env. No solicita entornos completos de docker inspect
ni imprime/guarda huellas o valores de secretos. Si no puede inspeccionar estos
recursos, no llega al arranque. No intenta reparar recursos previos si detecta cambios.

| Comprobación repetida | Resultado observado |
|---|---|
| Build runtime y arranque con Compose | Aprobado en kitchenware-infra-test-60f46a37dff4 |
| verify-stack.py ampliado | 33 comprobaciones aprobadas, 0 fallidas |
| Tablas y esquema | Las seis tablas de negocio y migrations en kitchenware |
| Entorno de ejecución | PHP 8.4, pdo_pgsql, Sodium y conexión UTC verificados |
| Protección del Codespace | Contenedores, volúmenes y .env previos sin cambios detectados |
| Build testing y composer test en Docker | 188 pruebas, 1.201 aserciones, 0 fallidas |
| composer test:integration en PostgreSQL temporal | 80 pruebas, 798 aserciones, 0 fallidas |
| Total API | 268 pruebas, 1.999 aserciones, 0 fallidas |
| Sintaxis Shell, PHP y Python; git diff --check | Aprobados |

Se volvieron a comprobar healthchecks, JWT, CORS, upload/descarga/reemplazo,
permisos privados, límites de 2 MiB, no exposición pública, reinicio, recreación,
idempotencia y logs sin los secretos de prueba. Las cuatro evidencias de concurrencia
del ADR-002 también se repitieron con resultados 201/409, 201/422, 200/409 y
reversión completa, respectivamente. El runner de integración conserva su ciclo
de vida sobre datos desechables en tmpfs, sin volúmenes de desarrollo.

El nuevo stack dejó dos volúmenes de pruebas adicionales, conservados. Hay siete
proyectos históricos de verificación con catorce volúmenes aislados en total.
Los contenedores y redes de estas pruebas se retiraron. La instancia de desarrollo
siguió ejecutándose y ninguna prueba consultó ni escribió su base.
La comparación de metadatos no equivale a una auditoría del contenido de esa base:
no se abrió una conexión a ella para demostrarlo.

README incorpora inspección previa, elección de puertos libres, acceso privado
mediante Ports de Codespaces y estrategia para tool/. No se verificó apertura
remota con una sesión de navegador del usuario; sí HTTP desde el Codespace.
Se mantienen las limitaciones anteriores: restauración completa no ejecutada,
TLS público pendiente y T-20 parcial hasta integrar React. RNF-5 se acredita para
PostgreSQL y API, no para un frontend aún inexistente.

En esta ampliación solo cambiaron README.md, verify-stack.py y este informe dentro
de infra/. .dockerignore raíz se conserva del trabajo anterior, necesario para
excluir secretos del build. No se modificaron requisitos, código API, migraciones,
secretos reales, ramas ni historial; no se ejecutó git add, git commit o git push.
