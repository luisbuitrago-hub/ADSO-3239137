# Infraestructura de Kitchenware

Esta carpeta ejecuta la API existente con PHP 8.4/Apache y PostgreSQL 16.
Laravel conserva la propiedad del esquema, migraciones, categorías y administrador.
No se implementa frontend ni se agregan colas, Redis u otros servicios.

## Requisitos y configuración inicial

Docker Engine y Docker Compose v2 actual con soporte de service_healthy, --wait y
build multietapa. Se necesita acceso a Docker Hub, repositorios Debian y paquetes
Composer durante la construcción. No se necesita PHP/Composer/Node en el equipo
para levantar la API. La verificación completa requiere Python 3 estándar.

Desde `03-execute/NN-week/plan-mejoramiento/infra/`:

```bash
cp .env.example .env
chmod 600 .env
```

Completar `.env` localmente una sola vez, sin reutilizar secretos de desarrollo.
Usar comillas simples en valores sensibles con `$`, `#` o espacios para evitar
interpolación de Compose. No hay contraseñas predeterminadas.

| Variable | Uso |
|---|---|
| POSTGRES_DB / POSTGRES_USER | Base y usuario iniciales; por defecto kitchenware |
| POSTGRES_PASSWORD | Contraseña PostgreSQL obligatoria |
| APP_KEY | base64: seguido de 32 bytes aleatorios codificados en base64 |
| JWT_SECRET | Secreto aleatorio independiente de al menos 32 bytes |
| ADMIN_USERNAME / ADMIN_PASSWORD | Administrador inicial; contraseña de hasta 72 bytes |
| CORS_ORIGIN | Origen exacto del frontend; http://localhost:5173 por defecto |
| APP_URL | URL pública API; http://localhost:8080 por defecto |
| API_BIND_ADDRESS / API_PORT | Publicación en el equipo; 127.0.0.1:8080 por defecto |
| POSTGRES_BIND_PORT | Solo para el archivo opcional de acceso local a PostgreSQL |

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

El proyecto se llama `kitchenware`. Compose espera PostgreSQL saludable. El backend
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

| Servicio | Ejecución | Puerto |
|---|---|---|
| postgres | Imagen oficial postgres:16 | 5432 solo en red interna |
| api | PHP 8.4 Apache, usuario www-data | 8080 interno; 127.0.0.1:8080 en el equipo |

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

## Integración futura de app/, page/ y tool/

Ambas carpetas están ausentes. No se crean servicios vacíos ni funcionalidades
ficticias. Incorporar sus Dockerfiles/servicios cuando existan. El navegador usará
la URL pública API (no DNS interno api) y su origen coincidirá con CORS_ORIGIN.
page/ servirá contenido estático sin acceso a PostgreSQL ni imágenes privadas.

tool/ tampoco existe. Cuando se implemente, podrá ejecutarse como tarea puntual
contra la API saludable por HTTP (http://api:8080 dentro de la red de Compose o la
URL pública desde el equipo). No tendrá acceso a PostgreSQL ni a sus volúmenes.
Sus credenciales se suministrarán en ejecución; no se incorporará al arranque normal
para evitar duplicar datos de demostración. No se crea ahora un servicio ficticio.

RNF-5 se verifica para los servicios actuales (PostgreSQL + API). T-20 y el despliegue
completo siguen parciales hasta integrar React y verificar el conjunto. No se
cambia la definición académica de terminado.

Referencias técnicas: [imagen oficial PHP](https://hub.docker.com/_/php) y
[orden de arranque de Compose](https://docs.docker.com/compose/how-tos/startup-order/).
