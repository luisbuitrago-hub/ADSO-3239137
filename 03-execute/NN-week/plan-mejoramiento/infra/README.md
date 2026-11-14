# Infraestructura PostgreSQL de Kitchenware

## Desarrollo

`compose.yaml` conserva el servicio PostgreSQL 16 y su volumen persistente.
Si ya está funcionando, no necesitas recrearlo ni reconstruir la base.

Para una instalación nueva, configura `POSTGRES_PASSWORD` localmente y ejecuta
desde `infra/`:

```bash
docker compose up -d --wait
```

Configura la conexión Laravel a esa instancia y, desde `api/`, ejecuta:

```bash
php artisan kitchenware:prepare-database
```

Laravel administra el esquema y las tablas. No se duplican instrucciones de
creación del esquema en scripts de inicialización de Docker. El procedimiento
funciona también con una base PostgreSQL nueva creada fuera de Docker.

## Integración aislada

Desde `infra/`:

```bash
bash test-api-postgres.sh
```

También puedes usar `composer test:integration` desde `api/`. Para filtrar casos:

```bash
bash test-api-postgres.sh --filter CategoriesTest
```

El script utiliza únicamente `compose.test.yaml`, con un nombre de proyecto
único por ejecución, base y usuario `kitchenware_test`, puerto aleatorio ligado
a `127.0.0.1` y `tmpfs`. No utiliza el volumen de desarrollo ni su puerto 5432.
La credencial del contenedor de pruebas es pública y descartable.

Al finalizar, incluso si PHPUnit falla, el script ejecuta `down` exclusivamente
para su proyecto temporal. No ejecutes comandos de borrado sobre `compose.yaml`
para realizar estas pruebas. Una interrupción no capturable, como `SIGKILL`,
puede dejar el proyecto temporal activo; identifícalo por su nombre
`kitchenware-tests-*` antes de realizar cualquier limpieza manual.
