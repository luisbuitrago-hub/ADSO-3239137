# Kitchenware — Herramientas HTTP

Sembrador reproducible de T-21 y comprobaciones de demostración. Python 3.11+ en
Linux/Codespaces, sin paquetes externos. Verifica instalación con `python3 --version`.
No requiere PHP, Node ni un cliente SQL en el equipo. El backend sigue siendo quien
valida, genera UUID, fechas y snapshots, calcula existencias y persiste los registros.

Se revisaron docs/spec.md, tasks.md, api-contract.md y api/BACKEND_AUDIT.md. La
última auditoría es histórica: sus pendientes de infraestructura/interfaz no se usan
para reimplementar módulos ya terminados. No hay cambios fuera de tool/.

## Conjunto de demostración

El comando seed crea por HTTP:

- 40 artículos por defecto, repartidos entre las cinco categorías existentes.
- 10 vecinos con nombres/documentos sintéticos y prefijo exclusivo de ejecución.
- 15 préstamos con 16 líneas: uno contiene dos artículos distintos y los demás uno.
- 13 devoluciones válidas, conservando tres líneas pendientes para vencimiento natural.
- Resultado inicial: 40 artículos activos, 10 vecinos, 13 préstamos cerrados y dos
  abiertos; el reporte histórico cuenta 16 líneas.

Cada artículo tiene tres unidades totales, salvo el primero, que tiene una. El
perfil es reproducible en estructura y escenarios; UUID, prefijo y fechas cambian
por ejecución/servidor. El prefijo KW-* evita colisiones con datos existentes. No
se reutilizan ni actualizan registros previos por coincidencia de nombre/documento.

El sembrador comprueba respuestas y lecturas posteriores para:

| Escenario                                        | Contrato esperado                                  |
| ------------------------------------------------ | -------------------------------------------------- |
| Registro válido                                  | 201; disponibilidad inicial igual al total         |
| Referencia y documento propios repetidos         | 409 REFERENCE_TAKEN / DOCUMENT_TAKEN               |
| Última unidad ya prestada                        | 409 ARTICLE_NOT_AVAILABLE                          |
| Préstamo de dos artículos con uno sin stock      | 409; sin préstamo ni descuento parcial             |
| Cuarto artículo pendiente                        | 422 NEIGHBOR_LIMIT_EXCEEDED                        |
| Artículo repetido en una solicitud               | 422 DUPLICATE_ARTICLE_IN_LOAN                      |
| Baja de un artículo propio prestado              | 409 ARTICLE_HAS_OPEN_LOANS                         |
| Consulta sin JWT                                 | 401                                                |
| Cambio de nombre/categoría de un artículo propio | Los snapshots del préstamo no cambian              |
| Devolución                                       | 200; repone exactamente una unidad                 |
| Devolución repetida                              | 409 ITEM_ALREADY_RETURNED; no vuelve a sumar stock |

La actualización de nombre/categoría y todas las operaciones negativas se limitan
a registros creados en esa misma ejecución. No se envía quantity, fechas, estado ni
identificadores de usuario en POST /loans. No se crean administradores u operadores.
No se incorporan endpoints fuera del contrato.

## Configuración y protecciones

No se cargan automáticamente archivos .env. Proporcionar variables desde el entorno
autorizado o gestor de secretos. No escribir valores sensibles en comandos compartidos,
archivos ni logs. Desactivar shell tracing si está activo: `set +x`.

| Variable                   | Uso                                                                            |
| -------------------------- | ------------------------------------------------------------------------------ |
| KITCHENWARE_API_URL        | Obligatoria: origen real y /api/v1; sin valor predeterminado                   |
| KITCHENWARE_STATE          | Obligatoria: ruta de un recibo nuevo/exclusivo para seed                       |
| KITCHENWARE_ADMIN_USERNAME | Cuenta administrativa del entorno autorizado                                   |
| KITCHENWARE_ADMIN_PASSWORD | Contraseña de esa cuenta, solo en el entorno                                   |
| KITCHENWARE_CONFIRM_TARGET | Para escribir: debe coincidir exactamente con API_URL normalizada, sin / final |
| KITCHENWARE_WRITE_ACK      | Para escribir: isolated-demo                                                   |
| KITCHENWARE_ARTICLE_COUNT  | De 40 a 5000; predeterminado 40                                                |
| KITCHENWARE_HTTP_TIMEOUT   | Segundos por solicitud: 1–120; predeterminado 15                               |

La doble confirmación es una protección contra errores, **no demuestra por sí sola
que la API esté aislada ni sustituye la autorización para modificar un entorno**.
No ejecutar seed ni cleanup --apply en desarrollo sin autorización expresa. En este
bloque solo se ejecutaron contra un proyecto Docker de pruebas exclusivo.

HTTP se admite únicamente en loopback; otros destinos requieren HTTPS con validación
normal del certificado. Se rechazan credenciales, parámetros y fragmentos en la URL.
No se siguen redirecciones y se ignoran proxies del entorno para no reenviar JWT.
Los errores publicados son mensajes controlados/códigos conocidos, sin cuerpos
brutos de respuesta, contraseñas, tokens ni trazas. JWT queda solo en memoria; cada
invocación autentica de nuevo y exige admin/Bearer/28800 segundos del contrato.

Ejemplo local, después de identificar un **puerto propio de una API aislada**:

```sh
cd 03-execute/NN-week/plan-mejoramiento/tool
export KITCHENWARE_API_URL="http://127.0.0.1:${DEMO_API_PORT:?Define el puerto de tu API aislada}/api/v1"
export KITCHENWARE_STATE="$PWD/.runs/mi-demostracion.jsonl"
# Ingresar las credenciales sin incluir sus valores en el historial:
read -r -p 'Administrador del entorno aislado: ' KITCHENWARE_ADMIN_USERNAME
read -r -s -p 'Contraseña: ' KITCHENWARE_ADMIN_PASSWORD
export KITCHENWARE_ADMIN_USERNAME KITCHENWARE_ADMIN_PASSWORD
python3 kitchenware.py plan
```

plan no abre conexiones ni crea el recibo. Revisar su destino antes de autorizar:

```sh
export KITCHENWARE_CONFIRM_TARGET="$KITCHENWARE_API_URL"
export KITCHENWARE_WRITE_ACK=isolated-demo
python3 kitchenware.py seed
python3 kitchenware.py verify
```

seed se ejecuta una sola vez por recibo. Otro seed con el mismo archivo se rechaza,
sin sobrescribirlo ni añadir otro conjunto. Para una nueva demostración autorizada,
escoger otro recibo; se generará un prefijo distinto, no se actualizará el anterior.
No hay reintentos automáticos de POST, PUT, DELETE o devolución.

## Recibo, interrupciones y reconciliación

El recibo JSONL es privado (0600), se crea de forma exclusiva y se bloquea con flock
para impedir dos comandos simultáneos. Antes de cada escritura registra y sincroniza
una intención; después registra el estado HTTP y solo UUID/fechas mínimos del recurso.
No contiene nombres/documentos de vecinos, contraseñas, JWT, respuestas de login ni
cuerpos de errores. Se rechazan enlaces simbólicos, recibos públicos, truncados o
corruptos y destinos distintos del original.

Una escritura sin respuesta confirmada queda pendiente. Las escrituras siguientes y
la limpieza se bloquean. No editar/truncar el recibo ni repetir el POST para intentar
repararlo. Reconciliar primero mediante las consultas HTTP autorizadas: buscar el
prefijo propio con GET /articles?q= o GET /neighbors?q=; consultar préstamos por
neighbor_id y su detalle. En préstamos usar los IDs y líneas del recibo confirmado,
no coincidencias de nombres. El contrato no ofrece clave de idempotencia ni búsqueda
por identificador del cliente. Por eso no se promete recuperación automática tras
una respuesta perdida; una operación puede haberse guardado y necesitar revisión
administrativa. Un recibo parcial nunca se presenta como demostración completa.
No trasladar manualmente UUID de otro entorno ni cambiar la URL del recibo.

## Vencimientos reales, sin cambiar fechas

La API **no permite enviar loaned_at ni due_at**. Las tres líneas reservadas vencen
naturalmente a las 72 horas. No hay modo de adelantarlas por HTTP respetando el contrato.

1. Preparar el conjunto en un entorno aislado persistente con credenciales conocidas
   por su responsable y puerto estable. Conservar el recibo y sus volúmenes.
2. seed/verify muestran overdue_ready_after_utc: la mayor fecha límite pendiente más
   un segundo. Esperar hasta después de ese instante real. No dejar el programa
   dormido ni modificar el reloj, filas SQL, snapshots o configuración del backend.
3. Mantener o reiniciar los servicios del mismo entorno con los mismos secretos y
   datos. Si se detienen, las fechas siguen transcurriendo; no deben recrearse los datos.
4. Recargar las credenciales desde el gestor de secretos y ejecutar:

```sh
python3 kitchenware.py overdue
python3 kitchenware.py overdue --apply
```

El primer comando solo consulta. Usa Date del servidor y GET /loans/overdue, filtra
las líneas del recibo y muestra conteos, nunca información ajena. El segundo, cuando
ya existen tres líneas propias vencidas, intenta un préstamo de un artículo propio
con stock al vecino afectado y exige 409 NEIGHBOR_HAS_OVERDUE. Antes del plazo devuelve
código 2 y **no intenta ese préstamo**. Date tiene precisión de segundos; el endpoint
es quien decide el vencimiento estricto. Una fecha exactamente igual todavía no
acredita vencimiento; se recomienda el margen de un segundo indicado en el resumen.

Las pruebas rápidas simulan el paso del tiempo solo en un doble HTTP en memoria;
no son evidencia de vencimientos positivos sobre Laravel/PostgreSQL. La integración
real comprueba el estado todavía no vencido. La evidencia real de tres vencidas queda
pendiente hasta transcurrir tres días; no se declara cumplida anticipadamente esa
parte de T-21. Ejecutar cleanup --apply antes de ese plazo cancela la demostración
futura al devolver las líneas reservadas.

### Preparar el entorno persistente de espera

Reutilizar ../infra/compose.yaml, sin modificarlo. El responsable debe elegir un
nombre de proyecto nuevo con prefijo kitchenware-demo- y un puerto libre diferente
del desarrollo; verificar que no existan contenedores/volúmenes con ese nombre.
Proporcionar por entorno POSTGRES_PASSWORD, APP_KEY, JWT_SECRET, ADMIN_USERNAME y
ADMIN_PASSWORD, además de POSTGRES_DB/POSTGRES_USER exclusivos, API_BIND_ADDRESS=127.0.0.1
y API_PORT con ese puerto estable. No escribir un .env ni imprimir los secretos.

Desde tool/, con esas variables y DEMO_PROJECT definidos para ese entorno propio:

```sh
docker compose --env-file /dev/null --project-name "${DEMO_PROJECT:?Define un proyecto nuevo exclusivo}" --file ../infra/compose.yaml up --build -d --wait --wait-timeout 180
```

El comando configura PostgreSQL/API mediante los mecanismos existentes de Laravel.
No ejecutarlo sobre el proyecto de desarrollo ni reutilizar sus nombres o volúmenes.
Si se necesita detener temporalmente la demostración, usar solo stop sobre el mismo
proyecto propio, conservando sus recursos. Reiniciar ese mismo entorno y esperar
healthy antes de consultar vencidos. No regenerar secretos de una base persistente:
cambiar variables no cambia contraseñas ya almacenadas. Esta preparación manual de
espera prolongada no se ejecutó en desarrollo durante este bloque.

## Limpieza segura por contrato

```sh
python3 kitchenware.py cleanup
python3 kitchenware.py cleanup --apply
python3 kitchenware.py verify
```

Sin --apply solo muestra el plan. Con --apply necesita ambas confirmaciones, verifica
la pertenencia de **todos** los recursos y devuelve únicamente líneas propias pendientes;
después realiza la baja lógica de artículos propios. Una repetición no duplica
retornos ni repone stock dos veces. La API protege bajas con préstamos pendientes.
Las solicitudes HTTP de limpieza no forman una transacción global: un cambio concurrente
puede detener el proceso después de completar parte de la limpieza propia. Revisar
el recibo y el estado autorizado antes de continuar; no se intenta una purga global.

No elimina vecinos, préstamos, devoluciones, categorías, usuarios ni historial. Esos
endpoints de eliminación no existen. No borra físicamente artículos ni limpia SQL,
volúmenes o Docker. El recibo permanece como evidencia; active_articles puede ser 0
mientras articles_created conserva la cantidad histórica creada. No es una restitución
física de la base vacía. Si otro usuario modificó identidades o incorporó préstamos,
la comprobación debe detenerse y revisarse antes de continuar.

## Perfil de 5000 artículos y medición RNF-1

Para otro conjunto aislado con recibo nuevo:

```sh
export KITCHENWARE_STATE="$PWD/.runs/rendimiento.jsonl"
export KITCHENWARE_ARTICLE_COUNT=5000
python3 kitchenware.py plan
python3 kitchenware.py seed
python3 kitchenware.py benchmark
```

Genera los 5000 artículos **por POST /articles**, no SQL. Mantiene los diez vecinos y
quince préstamos del perfil. benchmark no modifica datos: hace un calentamiento y
diez búsquedas HTTP paginadas (size=20), buscando el prefijo de ese conjunto en un
catálogo con al menos 5000 coincidencias activas. Informa mediana, p95, máximo y si
**todas** las muestras fueron inferiores a 300 ms. Mide HTTP completo del cliente,
no únicamente la consulta SQL. No atribuir estos tiempos a otro servidor, red,
catálogo, consultas, arranque frío o carga concurrente sin repetir la medición.

## Pruebas automatizadas

Desde tool/:

```sh
python3 -m unittest discover -s tests -t . -v
python3 tests/integration.py
python3 tests/integration.py --performance
```

Las pruebas unitarias usan stdlib y dobles; algunas abren un HTTP loopback temporal.
La integración requiere Docker Engine/Compose y acceso a imágenes/paquetes de build.
Crea un proyecto aleatorio kitchenware-tool-test-*, credenciales nuevas solo en memoria,
puerto API loopback aleatorio y volúmenes propios. No escribe archivos de credenciales,
no usa el .env real y no llama SQL/PDO/psql para preparar ni comprobar datos demo.
Todo el conjunto y la limpieza se verifican mediante HTTP.

El recorrido real prueba 40/10/15, tres líneas pendientes, errores y atomicidad,
repetición de seed bloqueada, limpieza en plan/aplicada/repetida e historial preservado.
--performance añade un conjunto nuevo de 5000 artículos y la medición. Se comparan
metadatos de los recursos Docker previos y huellas de .env sin mostrar valores.
Al terminar se usa únicamente **stop** para los servicios de ese proyecto; no hay
Docker down/rm/prune, eliminación de redes o volúmenes. Los recibos y results.json
quedan privados bajo .runs/ e ignorados en Git. Las credenciales efímeras de la
integración se descartan al terminar; esos recibos no son el procedimiento manual
de espera de tres días con credenciales conservadas por su responsable.

Si se necesita un constructor propio para evitar la caché dañada del entorno, usar
BUILDX_BUILDER con un constructor exclusivo autorizado. Se prepara antes de capturar
la referencia de servicios y datos previos; esto permite reutilizar su caché detenida.
No limpiar cachés existentes.
La integración tarda más con --performance: genera y comprueba miles de registros
por HTTP y aplica fsync a cada confirmación. Resultados: [VERIFICATION.md](VERIFICATION.md).

## Códigos de salida y límites

- 0: comando comprobado; revisar los conteos/estado de su resumen.
- 1: configuración, seguridad, red, contrato o comprobación fallida. No repetir
  escrituras sin revisar recibo y datos autorizados.
- 2: condición aún no acreditada: vencidos antes del plazo, recibo parcial en verify,
  o benchmark con alguna muestra de 300 ms o más. No se oculta como éxito.

Los recibos no sustituyen una copia de seguridad ni permiten reconstruir credenciales.
No hay importación de datos personales, purga global, edición de fechas, simulación
acelerada de vencidos en PostgreSQL ni reintento automático tras una escritura incierta.
La medición local no acredita rendimiento del despliegue público. El caso de concurrencia
real de ADR-002 pertenece a la batería existente del backend y no se repite aquí.
Los commits/publicación quedan a cargo del usuario; no se ejecuta git add/commit/push.
