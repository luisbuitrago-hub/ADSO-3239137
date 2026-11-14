#!/usr/bin/env bash
set -euo pipefail

infra_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
test_project="kitchenware-tests-$$-${RANDOM}"
compose=(docker compose --project-name "$test_project" --file "$infra_dir/compose.test.yaml")

cleanup() {
    # Solo elimina el contenedor efímero de este proyecto único de pruebas.
    "${compose[@]}" down
}
trap cleanup EXIT

"${compose[@]}" up --detach --wait --wait-timeout 60
test_address="$("${compose[@]}" port postgres-test 5432)"
export TEST_DB_PORT="${test_address##*:}"

cd "$infra_dir/../api"
php vendor/bin/phpunit --configuration phpunit.integration.xml --do-not-cache-result "$@"
