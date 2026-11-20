# Infraestructura de Kitchenware

Esta carpeta ejecuta la API existente con PHP 8.4/Apache y PostgreSQL 16.
Laravel conserva la propiedad del esquema, migraciones, categorías y administrador.
El archivo base conserva esos dos servicios. El complemento opcional compose.app.yaml
añade React compilado con Nginx, descrito al final. No se agregan colas ni Redis.

## Requisitos y configuración inicial

Docker Engine y Docker Compose v2 actual con soporte de service_healthy, --wait y
build multietapa. Se necesita acceso a Docker Hub, repositorios Debian y paquetes
Composer durante la construcción. No se necesita PHP/Composer/Node en el equipo
para levantar los servicios. El verificador de API requiere Python 3 estándar;
las pruebas de navegador añaden Node y dependencias de app/, incluido Chromium
(ver app/README.md).

Desde `03-execute/NN-week/plan-mejoramiento/infra/`:

```bash
cp --no-clobber .env.example .env
chmod 600 .env
```

Completar `.env` localmente una sola vez, sin reutilizar secretos de desarrollo.
Compose carga `infra/.env` al ejecutarlo desde esta carpeta; no utiliza `api/.env`
para interpolar sus variables. Un `.env.example` no se carga automáticamente.
Incluso `ps` requiere interpolar los cinco valores obligatorios. No ejecutar `config`
sin `--quiet` en una terminal compartida, porque muestra los secretos resueltos.

Para coexistir con otra instalación, definir `COMPOSE_PROJECT_NAME` con un nombre
nuevo y elegir `API_PORT` y `APP_PORT` libres. No usar `-p infra` ni apuntar a sus
volúmenes. La auditoría local utiliza un proyecto `kitchenware-delivery-*`, API en
18080 y React en 15173, ambos en loopback, con PostgreSQL sin puerto host. Los valores
privados no se versionan. Nunca sobrescribir un `.env` existente para repetirla.
Usar comillas simples en valores sensibles con `$`, `#` o espacios para evitar
interpolación de Compose. No hay contraseñas predeterminadas.

| Variable                        | Uso                                                           |
| ------------------------------- | ------------------------------------------------------------- |
| POSTGRES_DB / POSTGRES_USER     | Base y usuario iniciales; por defecto kitchenware             |
| POSTGRES_PASSWORD               | Contraseña PostgreSQL obligatoria                             |
| APP_KEY                         | base64: seguido de 32 bytes aleatorios codificados en base64  |
| JWT_SECRET                      | Secreto aleatorio independiente de al menos 32 bytes          |
| ADMIN_USERNAME / ADMIN_PASSWORD | Administrador inicial; contraseña de hasta 72 bytes           |
| CORS_ORIGIN                     | Origen exacto del frontend; http://localhost:5173 por defecto |
| APP_URL                         | URL pública API; http://localhost:8080 por defecto            |
| API_BIND_ADDRESS / API_PORT     | Publicación en el equipo; 127.0.0.1:8080 por defecto          |
| POSTGRES_BIND_PORT              | Solo para el archivo opcional de acceso local a PostgreSQL    |

Se puede generar APP_KEY con `openssl rand -base64 32` (anteponer `base64:`) y
JWT_SECRET con `openssl rand -hex 32`. Guardarlos en el archivo privado y en el
gestor de secretos. No publicarlos en capturas ni comandos compartidos.
Mantener las claves estables. Cambiar POSTGRES_DB/USER/PASSWORD sobre un volumen
inicializado no cambia automáticamente su base, usuario o contraseña.

## Un comando de arranque

Desde `infra/`, después de completar la configuración inicial:

```bash
docker compose up --build -d
```

Por defecto el proyecto se llama `kitchenware`; COMPOSE_PROJECT_NAME puede elegir
otro nombre para una instalación independiente. Compose espera PostgreSQL saludable. El backend
valida configuración/conexión y ejecuta los comandos Laravel existentes:
`kitchenware:prepare-database --force` y `kitchenware:initialize-admin --force`.
Luego inicia Apache. No borra esquemas, no carga datos de demostración y no cambia
contraseñas existentes. La preparación es para una única instancia API.

`-d` vuelve antes de que necesariamente termine la preparación. Para esperar:

```bash
docker compose up --build -d --wait --wait-timeout 180
docker compose ps
curl --fail http://localhost:8080/api/v1/health
```

La respuesta es `{"status":"ok"}`. El healthcheck del contenedor comprueba también
PostgreSQL; el endpoint HTTP existente por sí solo no prueba la conexión.

| Servicio | Ejecución                        | Puerto                                    |
| -------- | -------------------------------- | ----------------------------------------- |
| postgres | Imagen oficial postgres:16       | 5432 solo en red interna                  |
| api      | PHP 8.4 Apache, usuario www-data | 8080 interno; 127.0.0.1:8080 en el equipo |

La red database es interna. La API pertenece además a http para publicar su puerto.
La variante oficial PHP/Apache evita introducir un tercer servicio HTTP.
Se instala pdo_pgsql y se comprueba Sodium; SQLite/PCNTL permiten pruebas aisladas.
Composer instala el lock sin dependencias dev en runtime. No se montan fuentes.

Para acceso local explícito a PostgreSQL, usando un puerto libre:

```bash
docker compose -f compose.yaml -f compose.db-access.yaml up --build -d
```

Ese archivo publica 127.0.0.1:55432 por defecto. Mantener los mismos archivos y
nombre de proyecto en los comandos posteriores de esa instalación.

## Instancia de desarrollo existente

La configuración anterior usaba proyecto implícito `infra`, puerto 5432 y volumen
`infra_kitchenware_postgres_data`. La instalación nueva usa proyecto `kitchenware`
y volúmenes `kitchenware_kitchenware_postgres_data` y `kitchenware_kitchenware_covers_data`.
La instancia anterior puede seguir funcionando: no se conecta, importa, cambia ni
elimina automáticamente su información. No ejecutar esta configuración con `-p infra`
ni reutilizar su volumen sin un plan de respaldo/migración revisado. Esta instalación
independiente no transfiere los datos del entorno anterior.

Antes de arrancar una instalación, identificar contenedores, volúmenes y puertos
ocupados con comandos de solo lectura:

```bash
docker ps -a --format '{{.Names}} {{.Status}} {{.Ports}}'
docker volume ls
ss -ltn
```

Si 8080 está ocupado, elegir otro API_PORT libre. No detener procesos ajenos para
liberar puertos. La prueba automatizada asigna un puerto libre mediante Docker,
comprueba que su nombre de proyecto no exista y compara metadatos antes/después.
Verifica identidad, arranque, reinicios, puertos y montajes de contenedores previos,
identidad de volúmenes y huellas de api/.env e infra/.env sin imprimirlas. Si algo
cambia, informa fallo: no intenta restaurar ni modificar recursos previos.
Esa comparación no consulta ni audita el contenido de la base de desarrollo.

## Uso en GitHub Codespaces

Ejecutar el mismo comando desde infra/ en la terminal del Codespace. Primero
verificar salud con curl en localhost. En la pestaña **Ports**, añadir el API_PORT
elegido y abrir su dirección reenviada; conservar visibilidad privada.
El dominio habitual tiene la forma `https://CODESPACENAME-PORT.app.github.dev`.
No cambiar el protocolo del servicio local a HTTPS: este stack sirve HTTP y la
URL reenviada de Codespaces ofrece el acceso remoto correspondiente.
Procedimiento de referencia: [reenvío de puertos de GitHub Codespaces](https://docs.github.com/en/codespaces/developing-in-a-codespace/forwarding-ports-in-your-codespace).

Configurar APP_URL con la dirección externa al usarla; CORS_ORIGIN debe coincidir
con el origen exacto del frontend futuro, no necesariamente con la URL de la API.
No reenviar PostgreSQL para usar la API. El puerto privado remoto añade el control
de acceso de GitHub: una redirección a login de GitHub no implica fallo de JWT.
Para las pruebas desde terminal usar localhost y evitar publicar tokens GitHub.
Este bloque no modifica .devcontainer ni automatiza la publicación de puertos.
Se verificó HTTP desde el Codespace; la apertura por navegador del puerto reenviado
requiere la sesión de GitHub del usuario y no se declara comprobada automáticamente.

## Persistencia y seguridad

Los volúmenes nombrados sobreviven al ciclo de vida de contenedores. La API arranca
como www-data, con puerto no privilegiado, no-new-privileges y fuentes no escribibles
por ese usuario. El volumen privado se inicializa con dueño www-data y modo 0700;
los archivos tienen 0600. No se monta en public/ ni se ejecuta storage:link.
Solo los endpoints autenticados sirven imágenes.

El .dockerignore de la raíz es imprescindible para excluir del contexto .env,
credenciales, claves, logs, dependencias y cachés locales. No hay secretos como
build args ni en las capas de imagen. Se inyectan como entorno: administradores
del daemon Docker pueden inspeccionarlos. No compartir docker inspect ni la salida
completa de docker compose config; validar con `docker compose config --quiet`.

Localhost es el único acceso publicado por defecto. Acceso remoto exige configurar
deliberadamente dirección, CORS y HTTPS. Aquí no se instala un proxy TLS ni se
acredita endurecimiento para exposición pública en Internet.

## Logs, diagnóstico y detención

```bash
docker compose config --quiet
docker compose logs --tail 100 api postgres
docker compose exec api php /usr/local/lib/kitchenware/healthcheck.php
docker compose exec api php artisan migrate:status
docker compose stop
```

Laravel registra en stderr. Apache registra método, ruta sin query string, estado
y tamaño, sin Authorization ni cuerpo. Errores de preparación son genéricos para
no mostrar SQL/credenciales. No activar trazas de shell con secretos.

- Variables ausentes: completar .env; no hay fallback de contraseñas.
- Preflight: revisar formato APP_KEY, longitud JWT y origen CORS exacto.
- PostgreSQL: revisar logs e identidad del volumen; el entorno no cambia usuarios existentes.
- Administrador: conservar el nombre inicial; no se elevan operadores ni reinician contraseñas.
- Imágenes: revisar propietario UID 33 y permisos; no corregir automáticamente volúmenes ajenos.
- Un healthcheck fallido no provoca reinicio automático. unless-stopped reinicia procesos que terminan.

`docker compose stop` conserva contenedores/volúmenes. `docker compose down` retira
contenedores/redes y conserva volúmenes si no se solicita eliminarlos. No usar
opciones de eliminación de volúmenes ni operaciones de borrado de base.
El próximo arranque conserva datos y aplica solo migraciones pendientes.

## Respaldo y recuperación

Respaldar base, imágenes y una copia segura de claves/configuración. Para una copia
consistente detener escrituras API y evitar cambios manuales en la base. Desde infra/:

```bash
umask 077
mkdir -p backups
docker compose stop api
docker compose exec -T postgres sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc' > backups/database.dump
docker compose run --rm --no-deps --entrypoint tar api -C /var/lib/kitchenware/covers -cf - . > backups/covers.tar
docker compose start api
```

Comprobar códigos de salida e integridad; ante un fallo conservar originales y
volver a iniciar API. backups/ está ignorado por Git. Transferir las copias a un
destino protegido. Guardar secretos con controles adecuados.

Restaurar solo en un proyecto Compose NUEVO con volúmenes vacíos y claves originales.
Iniciar únicamente postgres y restaurar con pg_restore sin opciones de limpieza en
esa base vacía; restaurar un tar confiable al volumen privado conservando propiedad
y permisos; iniciar API y verificar login, conteos y descarga autenticada antes de
cambiar tráfico. Nunca ensayar sobre desarrollo. La verificación de persistencia
no acredita una restauración completa ni recuperación ante pérdida del host.

Una caída puede dejar archivos huérfanos después del commit (BACKEND_AUDIT.md).
No se limpian automáticamente: detener escrituras, respaldar ambos volúmenes,
obtener cover_key de todos los artículos incluidos desactivados y comparar con los
archivos. Revisar discrepancias y poner candidatos en cuarentena antes de cualquier
eliminación manual. No borrar por antigüedad ni por nombre original.

## Pruebas reproducibles

Desde infra/:

```bash
python3 tests/verify-stack.py
```

Genera credenciales temporales y proyecto kitchenware-infra-test-* sin cargar el
.env real como configuración; solo calcula su huella en memoria para preservarlo.
Construye y prueba HTTP, conexión, migraciones, categorías, administrador, JWT, CORS,
imágenes, reinicio, recreación de contenedores, idempotencia y secretos en logs.
Al finalizar retira solo sus contenedores/redes y conserva incluso sus volúmenes de
pruebas; muestra el nombre del proyecto para identificarlos. No borra volúmenes.

Para pruebas rápidas dentro de la imagen testing, desde infra/:

```bash
docker build -f docker/api.Dockerfile --target testing -t kitchenware-api-tests ..
docker run --rm kitchenware-api-tests composer test
```

La imagen testing añade dependencias dev, genera claves efímeras por ejecución sin
leer .env local y usa SQLite en memoria. Runtime no incluye
PHPUnit. La integración anterior se conserva: desde api/, con PHP/Composer locales
y dependencias instaladas, `composer test:integration`; o desde infra/,
`bash test-api-postgres.sh`. Usa compose.test.yaml, base kitchenware_test, puerto
aleatorio localhost y tmpfs, sin volúmenes de desarrollo.

Evidencia real: [VERIFICATION.md](VERIFICATION.md).
Decisiones: [ADR-004-container-runtime.md](ADR-004-container-runtime.md).

### Auditoría de entrega con configuración local privada

`python3 tests/verify-delivery.py --browser` verifica una instalación **nueva** con
`infra/.env` privado 0600 y un `COMPOSE_PROJECT_NAME` nuevo con formato
`kitchenware-delivery-` seguido de doce caracteres hexadecimales. Rechaza reutilizar
contenedores/volúmenes por defecto. Lee secretos en memoria, suprime salidas sensibles
y valida que los tres servicios y sus volúmenes estén aislados antes de construir.

Reutiliza el cliente HTTP y la inspección de metadatos del verificador existente,
sin ejecutar su limpieza ni recreación de contenedores. Hace stop/start únicamente
de los servicios que acaba de crear para verificar persistencia, y los deja saludables.
No elimina ningún recurso. `--browser` requiere Chromium y bibliotecas compatibles
con las dependencias Playwright existentes de app/.

Para retomar una revisión del proyecto aislado ya creado existe `--existing`:
no construye, inicia ni reinicia servicios, pero crea fixtures HTTP propios.
`--restart-owned` autoriza explícitamente stop/start de ese proyecto aislado para
comprobar persistencia; nunca utilizar estas opciones con una instalación de trabajo.
La suite UI utiliza nombres de demostración y debe ejecutarse sobre un conjunto
nuevo o revisado, no repetirse automáticamente sobre datos acumulados.

En esta auditoría las bibliotecas de navegador se extrajeron en /tmp y se usaron
por LD_LIBRARY_PATH; no se instalaron paquetes del sistema. La primera comprobación
de /storage se corrigió para reconocer el HTML público de la SPA, sin confundirlo
con una publicación de los bytes de la imagen. Ver resultados y pendientes en
[DELIVERY_AUDIT.md](../docs/DELIVERY_AUDIT.md).

## Integración de app/, page/ y tool/

React ya está implementado y el complemento de abajo lo ejecuta con Nginx junto a
PostgreSQL y Laravel. page/ es estática, independiente de la API, con destino React
configurable; su alojamiento Docker sigue como estrategia documentada, no como
servicio verificado. tool/ ya incluye el sembrador exclusivamente HTTP, sin acceso
SQL ni carga automática al iniciar servicios. Consultar sus README y evidencias.

El estado consolidado de RNF-5, T-20 y las limitaciones de entrega se documenta en
[la auditoría final](../docs/DELIVERY_AUDIT.md). Los informes de cada bloque conservan
su alcance y fecha; sus listas antiguas de carpetas ausentes no describen el estado actual.

Referencias técnicas: [imagen oficial PHP](https://hub.docker.com/_/php) y
[orden de arranque de Compose](https://docs.docker.com/compose/how-tos/startup-order/).

## React estático — complemento del bloque 8.4

El archivo compose.app.yaml añade únicamente el servicio app. Se conservan intactos
compose.yaml, sus redes, PostgreSQL, API y nombres de volúmenes persistentes.
Después de completar la configuración privada inicial, desde infra/, en una
instalación autorizada:

```sh
docker compose -f compose.yaml -f compose.app.yaml up --build -d --wait --wait-timeout 180
```

Es un solo comando para los tres servicios. No usarlo para reemplazar ni detener
instancias de desarrollo activas. Revisar nombre de proyecto y puertos antes de un
arranque manual; las pruebas descritas abajo usan otro proyecto y puertos aleatorios.
El comando original docker compose up --build -d sigue disponible para API/PostgreSQL.

| Variable pública opcional | Valor por defecto | Uso                                   |
| ------------------------- | ----------------- | ------------------------------------- |
| APP_BIND_ADDRESS          | 127.0.0.1         | Interfaz de publicación de React      |
| APP_PORT                  | 5173              | Puerto del frontend; elegir uno libre |

No se añaden secretos ni es necesario modificar .env para usar esos valores.
React espera API saludable. Nginx sirve la SPA en 8080 sin privilegios y reenvía
/api/v1 a api:8080 por la red http. PostgreSQL permanece solo en database. app no
monta fuentes, imágenes privadas ni volúmenes de datos. Conserva Authorization y
las cabeceras/bodies de las imágenes; el navegador usa URLs blob: después de una
lectura autenticada. El límite Nginx es 3 MB para admitir el sobrecoste multipart;
Laravel conserva la validación de archivos de 2 MB. No hay caché de proxy.

La compilación multietapa usa el lock de app/ y npm ci; runtime contiene únicamente
Nginx, dist y configuración pública. app/.dockerignore limita el contexto de build
para excluir secretos, dependencias locales y pruebas. No se necesita Node en el
host ni en runtime. Las etiquetas Docker base son móviles, como las del backend;
no se garantiza reproducción bit a bit ni se incluye terminación TLS pública.

En Codespaces mantener privado el puerto app y abrirlo desde Puertos. El tráfico
API y frontend comparte el origen HTTPS reenviado; no es necesario publicar otro
puerto ni usar Access-Control-Allow-Origin wildcard. El acceso remoto con sesión
GitHub personal requiere verificación manual. Para despliegue público se necesita
HTTPS delante del servicio; no publicar el puerto HTTP sin esa configuración.

Desde app/:

```sh
npm run test:docker
```

El verificador tests/verify-docker.py reutiliza las protecciones de verify-stack.py:
proyecto aleatorio, credenciales efímeras, puertos loopback aleatorios y volúmenes
exclusivos. Comprueba que los tres servicios estén healthy y recorre React compilado,
proxy Nginx, Laravel y PostgreSQL por navegador real. Compara los recursos y archivos
.env anteriores al terminar, sin imprimir secretos. Solo retira sus contenedores y
redes, conservando sus volúmenes; no realiza limpieza global. Las trazas y capturas
de credenciales están desactivadas. Evidencia de ejecución en app/VERIFICATION.md.
