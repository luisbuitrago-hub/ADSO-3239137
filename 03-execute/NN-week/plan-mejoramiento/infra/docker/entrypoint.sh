#!/bin/sh
set -eu
umask 077

# No ejecutar comandos administrativos del operador como parte del arranque web.
if [ "${1:-}" != apache2-foreground ]; then
    exec "$@"
fi

mkdir -p /var/lib/kitchenware/covers \
    storage/framework/cache/data storage/framework/sessions storage/framework/views storage/logs
chmod 700 /var/lib/kitchenware/covers
php /usr/local/lib/kitchenware/preflight.php

# Los comandos de Laravel son la única autoridad del esquema y administrador.
# No volcar excepciones SQL/entorno al log del contenedor si falla el arranque.
if ! php artisan kitchenware:prepare-database --force --no-interaction >/dev/null 2>&1; then
    echo 'No fue posible preparar la base; revisar conexión y estado de migraciones.' >&2
    exit 1
fi
if ! php artisan kitchenware:initialize-admin --force --no-interaction >/dev/null 2>&1; then
    echo 'No fue posible inicializar el administrador; revisar configuración y usuarios existentes.' >&2
    exit 1
fi
echo 'Kitchenware: esquema, migraciones y administrador preparados.'
exec "$@"
