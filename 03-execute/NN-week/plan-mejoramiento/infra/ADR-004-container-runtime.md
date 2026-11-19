# ADR-004 — Ejecución reproducible del backend con Docker Compose

Estado: implementado; evidencia de ejecución en VERIFICATION.md.

## Contexto

D-15 exige Compose y RNF-5 un único comando. La API requiere PHP 8.4 para PUT
multipart real, PostgreSQL 16, Sodium, secretos estables e imágenes privadas.
ADR-001 mantiene el esquema en Laravel; ADR-002/003 preservan bloqueos e historial.
Todavía no existen app/ ni page/.

## Decisión

PHP oficial 8.4 Apache y PostgreSQL oficial 16 son los únicos servicios actuales.
La variante Apache evita otro servicio web y ejecuta directamente como www-data
en puerto 8080. Construcción multietapa: Composer sin dev para runtime y target
testing con dev. El .dockerignore raíz excluye secretos y artefactos locales.

Compose espera PostgreSQL saludable. El entrypoint valida entorno/conectividad y
reutiliza los comandos Laravel idempotentes para migraciones y administrador.
Nunca recrea el esquema ni cambia contraseñas existentes. El healthcheck backend
combina HTTP y consulta PostgreSQL. Se presupone una instancia API: no se promete
seguridad de migraciones simultáneas desde varias réplicas.

Volúmenes nombrados separados para PostgreSQL e imágenes. Red interna para la
base; localhost para la API. Publicar PostgreSQL requiere una opción explícita.
No se agregan cachés externas, colas, workers ni SQL de creación duplicado.

El proyecto kitchenware evita reutilizar accidentalmente la instancia histórica
infra: no se migran sus datos automáticamente. Las verificaciones utilizan otro
proyecto único y conservan incluso sus volúmenes de prueba.

## Alternativas y consecuencias

Se descarta artisan serve para servir el stack: Apache está incluido en la imagen
oficial. FPM con otro servidor es válido, pero incorpora otro servicio sin necesidad
actual. No se crean contenedores ficticios para frontend/presentación.

Los secretos se configuran una vez fuera del build y se mantienen entre reinicios.
El entorno del contenedor no protege frente a administradores de Docker. No hay
TLS automatizado ni endurecimiento acreditado para exposición pública.

Tags de imágenes fijan familias/versiones mayores y Composer fija dependencias;
no garantizan builds idénticos byte a byte al actualizar bases/repositorios.
Registrar digests de una entrega si se exige inmutabilidad y mantener actualizaciones
de seguridad. Base y archivos requieren respaldo conjunto: no hay atomicidad
distribuida y una caída física puede dejar huérfanos.

RNF-5 se verifica para servicios existentes; T-20 exige React y sigue parcial hasta
integrarlo. Se registra esta decisión en infra/ para mantener el ámbito del bloque
sin alterar requisitos académicos.
