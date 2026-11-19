# Evidencia del frontend — bloque 8.1

Fecha local: 2026-11-18, America/Bogota. Rama main y Git limpio al iniciar.
app/ no existía. Se revisaron especificación, plan, arquitectura, contrato, tareas,
ADR, autenticación real, rutas Laravel, CORS y documentación de infraestructura.

## Implementación verificada

React 19.3.1, TypeScript 6.0.3, Vite 8.3.8 y React Router 8.5.2. Probado con
Node 24.22.2/npm 11.19.1; engines refleja la intersección de requisitos de las
dependencias. Lockfile con versiones exactas y excepción local al ignore global.
Solo React, React DOM y React Router son dependencias de producción.

Login conforme a username/password y respuesta access_token/token_type/expires_in/role.
Usuario normalizado; contraseña sin recortar; ocho horas/exp; JWT en memoria;
sin almacenamiento persistente, cookies de autenticación ni renovación inventada.
Cierre de sesión local, invalidación por 401, expiración y protección frente a
respuestas tardías. Un 403 conserva sesión y comunica falta de permisos.
El backend conserva la verificación de firma y autorización vigente.

Rutas técnicas en inglés conforme a constitución: /login, /home, /articles,
/neighbors, /loans, /overdue, /reports y /users. Etiquetas y mensajes en español.
Admin ve todas; operador no ve administración y recibe restricción visual al
entrar por ruta. Son rutas del frontend; no se agregaron endpoints a Laravel.
Los módulos de negocio muestran su estado pendiente, sin datos ficticios.

## Resultados realmente ejecutados

| Comprobación                                      | Resultado final                                 |
| ------------------------------------------------- | ----------------------------------------------- |
| npm test (Vitest/Testing Library)                 | 39 aprobadas, 0 fallidas, 2 archivos            |
| npm run test:e2e en Chromium, ejecución separada  | 6 aprobadas, 0 fallidas; escritorio y móvil     |
| npm run test:api                                  | 1 prueba de navegador real aprobada, 0 fallidas |
| Total de pruebas frontend                         | 46 aprobadas en las ejecuciones indicadas       |
| npm run typecheck                                 | Aprobado                                        |
| npm run lint                                      | Aprobado, cero advertencias                     |
| npm run format:check                              | Aprobado                                        |
| npm run build                                     | Aprobado; archivos estáticos en dist/           |
| npm audit --audit-level=high                      | 0 vulnerabilidades notificadas                  |
| Sintaxis Python del verificador; git diff --check | Aprobados                                       |

La cobertura incluye los doce escenarios solicitados: renderizado, campos
obligatorios, login exitoso simulado con contrato real, credenciales incorrectas,
red, carga y duplicados, navegación autenticada, rutas privadas, roles, logout,
token inválido/vencido y pérdida de sesión al recargar. Además: 422 por campo,
500 sin trazas/detalles internos, timeout, URLs inseguras, respuestas incompatibles
y 401 tardío de una sesión anterior sin invalidar otra posterior.

Chromium comprobó teclado, foco, cierre del menú móvil con Escape, ausencia de
desbordamiento horizontal en 1440x1000 y 390x844, rutas, roles, logout y recarga.
axe comprobó login e inicio con reglas WCAG 2 A/AA y 2.1 A/AA, sin infracciones
detectadas en esas ejecuciones. Se corrigieron contrastes encontrados inicialmente.
No constituye certificación WCAG ni una revisión con lector de pantalla real.

## Integración real y preservación del entorno

La última prueba real usó kitchenware-infra-test-6eb5d3506a2c, credenciales generadas
en ejecución, PostgreSQL/Laravel independientes y Vite en puerto libre. Se reutilizó
el verificador de infra/ sin cambiar sus fuentes; no se usó api/.env para configurar
la prueba. Chromium consumió React y el proxy: salud, login real, Bearer sobre
categorías, 401 sin token, 422 de validación, preflight CORS con origen permitido,
403 al operador sobre reporte y cierre de sesión. El operador se creó por HTTP
únicamente en la base de pruebas.

Después se retiraron solo sus servidores/contenedores/redes, conservando sus
volúmenes. Los metadatos de contenedores/volúmenes previos y las huellas internas
de .env permanecieron sin cambios detectados. No se consultó ni modificó la base
de desarrollo. No se imprimieron tokens ni contraseñas; las trazas de navegador
real están desactivadas. No se cambiaron puertos a públicos.

Chromium y las bibliotecas faltantes se prepararon en /tmp, usando índices APT y
extracción también temporales. No se instalaron paquetes del sistema ni se cambió
el Codespace. No se modificó código de API, infraestructura, page/ o tool/.

## Límites y pendientes

- Se observó un timeout intermitente de primera carga al ejecutar simultáneamente
  las suites de navegador y API real. Las ejecuciones separadas pasaron; ejecutar
  esos comandos secuencialmente. Se separaron las cachés Vite por modo/puerto,
  pero no se declara acreditada la estabilidad de las suites concurrentes.
- El proxy fue verificado en el Codespace. No se probó el acceso remoto privado
  con la sesión GitHub personal del usuario ni todos los despliegues CORS posibles.
- No se implementan catálogo, imágenes, vecinos, préstamos, devoluciones,
  vencidos, reportes ni gestión de operadores en la UI. Tampoco Docker de React,
  page/ o tool/. T-22 y el frontend completo siguen pendientes.
- La lectura de JWT en frontend es para la UX, sin validar su firma. Logout no
  revoca copias del token en el servidor. Recargar requiere iniciar sesión de nuevo;
  un cambio de rol en persistencia puede requerir reingreso para actualizar el menú.

Todos los archivos fuente creados están en app/. No se modificaron requisitos,
secretos reales, ramas ni historial. No se ejecutó git add, git commit ni git push.
