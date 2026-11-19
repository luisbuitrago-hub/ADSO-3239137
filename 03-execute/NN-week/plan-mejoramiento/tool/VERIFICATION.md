# Evidencia de herramientas Kitchenware — bloque 10

Fecha: 2026-11-19, America/Bogota. Git limpio al comenzar; tool/ no existía.
Se revisaron spec.md, tasks.md, api-contract.md, BACKEND_AUDIT.md y las solicitudes,
entidades y errores reales del backend, además del aislamiento de infraestructura.
Los módulos terminados se conservan; solo se crean archivos en tool/.

## Diseño y seguridad revisados

Python y biblioteca estándar. El cliente usa JSON/JWT por endpoints existentes, TLS
normal o HTTP loopback, sin proxies del entorno ni redirecciones. No hay conexión SQL,
PDO, fixtures insertados en tablas, modificación de migraciones, reloj o secretos reales.
Las credenciales son variables de entorno; token y respuestas de login solo en memoria.
La creación de la base en el stack nuevo corresponde a la inicialización existente
de Laravel; el sembrador no duplica DDL ni se conecta a PostgreSQL.

Sin destino configurado no hay ejecución; sin doble confirmación no hay escrituras.
Cada ejecución tiene prefijo propio y recibo exclusivo 0600 con bloqueo. La URL del
recibo debe coincidir con la API. Solo se guardan UUID/fechas y resultados controlados;
las respuestas brutas no se publican. Una intención sin confirmación bloquea nuevos
POST/PUT/DELETE, sin reintentos. No se sobrescriben recibos ni se truncarían resultados
inciertos para intentar reparar automáticamente. Los recursos se comprueban por
identidad/namespace antes de iniciar limpieza.

## Pruebas rápidas

La suite unittest cubre configuración, ausencia de destino de desarrollo implícito,
confirmaciones, URL/credenciales/proxies/redirecciones, cabecera Bearer, fecha del
servidor, errores sanitizados, archivos privados, locks, symlinks, corrupción y
UUID de rutas. Incluye intención repetida después de una confirmación anterior.

El doble HTTP en memoria comprueba el conjunto de 40/10/15, payloads sin fechas ni
cantidades inventadas, inventario, restricciones, atomicidad, snapshots, devoluciones,
recibo parcial, pertenencia, planes de limpieza, preservación de historia y reintentos
inciertos bloqueados. Sus pruebas de fecha avanzan únicamente una variable del doble,
no el sistema operativo ni PostgreSQL. Ese caso **no acredita** vencidos reales.

## Recorrido real aislado

El verificador crea un proyecto Compose nuevo y solo dos servicios propios con puerto
API aleatorio, volúmenes exclusivos y credenciales generadas en memoria. No usa archivos
.env para proporcionarlas. Antes valida servicios, nombres de volúmenes y ausencia de
montajes de directorios reales. Rechaza reutilizar un proyecto existente.

Ejecuta el CLI real contra Laravel y PostgreSQL: seed 40/10/15, verificaciones de
inventario y errores, reporte histórico, tres pendientes no vencidos, repetición
bloqueada y limpieza en consulta/aplicada/repetida. Después si se solicita --performance
crea otro conjunto de 5000 artículos por HTTP, vuelve a comprobarlo y realiza diez
búsquedas paginadas tras un calentamiento. No se preparan datos por SQL ni se publican
respuestas de login, JWT o contraseñas.

El cierre es solo Docker Compose stop sobre el proyecto exclusivo. No ejecuta down,
rm, prune ni elimina contenedores, redes o volúmenes. Comprueba metadatos/estado de
contenedores previos, volúmenes y huellas de .env en memoria. El constructor propio de
esta ejecución es kitchenware-tool10-verification; no se limpia el constructor previo.

## Resultados ejecutados

| Comprobación                                             | Resultado real                                                      |
| -------------------------------------------------------- | ------------------------------------------------------------------- |
| unittest: configuración, recibos, HTTP y flujos          | 27 pruebas aprobadas; 0 fallidas                                    |
| Laravel/PostgreSQL: recorrido completo con perfil 5000   | Aprobado; salida 0                                                  |
| Laravel/PostgreSQL: segunda ejecución con proyecto nuevo | Aprobado; salida 0                                                  |
| Conjunto básico                                          | 40 artículos, 10 vecinos, 15 préstamos, 16 líneas históricas        |
| Pendientes tras seed                                     | 3 líneas; todavía no vencidas                                       |
| Limpieza aplicada y repetida                             | 0 artículos activos, 0 pendientes; 16 líneas históricas conservadas |
| Perfil ampliado                                          | 5000 artículos activos creados y comprobados por HTTP               |
| Diez búsquedas HTTP con 5000 coincidencias               | Mediana 35,936 ms; p95/máximo 60,633 ms; todas <300 ms              |
| Recursos Docker previos y archivos .env                  | Metadatos/huellas conservados en ambas integraciones                |
| Black, compilación Python y whitespace Git               | Aprobados                                                           |
| Tres vencidas reales y bloqueo posterior                 | Pendiente del transcurso real de 72 horas                           |

Proyectos exclusivos: kitchenware-tool-test-19de03b2c5a0 (perfil ampliado) y
kitchenware-tool-test-31cd23114de6 (repetición básica). La evidencia estructurada
queda en .runs/<proyecto>/results.json y los recibos asociados, con permisos privados
e ignorada por Git. No contiene contraseñas ni JWT. unittest no informa un contador
de aserciones; los contadores checks del CLI son comprobaciones propias, no ese dato.

En el primer proyecto, overdue inicial devolvió salida 2, cero vencidas propias y
Date del servidor 2026-11-19T14:58:59Z. Las tres líneas del perfil ampliado tendrán
su margen de comprobación después de 2026-11-22T15:02:04Z. Esto no acredita aún su
vencimiento; las credenciales efímeras de integración se descartaron. Para demostrar
esa parte se debe seguir el procedimiento persistente del README con credenciales
conservadas por el responsable. Las líneas del conjunto básico se devolvieron como
parte de la prueba de limpieza y ya no sirven para demostrar vencidos.

## Vencimientos: alcance real

No existe un endpoint documentado para fijar fechas de préstamo. Se dejan tres líneas
pendientes, con due_at proporcionado por Laravel y plazo validado de tres días.
verify informa el instante UTC recomendado para una consulta posterior. overdue usa
la respuesta del endpoint y el encabezado Date del servidor; no el reloj del cliente.

La integración inicial debe devolver código 2 y cero vencidos propios. La demostración
positiva de tres vencidas necesita el paso real del tiempo en un entorno aislado con
recibo/credenciales conservados por su responsable. No se altera la base de desarrollo
ni se agrega un reloj falso al backend para adelantarla. El procedimiento está completo,
pero esa evidencia real de T-21 permanece pendiente hasta después del plazo. No se
declaran tres vencidos PostgreSQL como aprobados mediante el doble en memoria.

## Límites

No se ejecutó en desarrollo ni producción. La confirmación por entorno es una barrera
manual, no una prueba automática de aislamiento para cualquier URL. El CLI no verifica
la firma del JWT: es responsabilidad del servidor. No se garantiza recuperación automática
frente a respuestas perdidas porque el contrato no ofrece idempotencia para escrituras.
La limpieza es lógica: conserva vecinos, préstamos, devoluciones y reporte histórico.
Las medidas HTTP son locales y acotadas al perfil, consulta, tamaño y muestras ejecutadas;
no sustituyen una evaluación del despliegue real ni las pruebas de concurrencia del backend.
