#!/bin/sh
set -eu
# Claves exclusivas de esta ejecución; no leer .env ni heredar secretos reales.
APP_KEY="$(php -r 'echo "base64:".base64_encode(random_bytes(32));')"
JWT_SECRET="$(php -r 'echo bin2hex(random_bytes(32));')"
export APP_KEY JWT_SECRET
export APP_ENV=testing DB_CONNECTION=sqlite DB_DATABASE=:memory: DB_URL=
exec "$@"
