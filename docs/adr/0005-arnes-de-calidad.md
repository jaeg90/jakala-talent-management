# 0005: Arnés de calidad — Stryker, SonarQube, OpenTelemetry y Sentry

Para el arnés determinista del TFM se completan las cuatro piezas de calidad exigidas por el máster (ADR-0001): mutation testing con Stryker, análisis estático con SonarQube, trazas con OpenTelemetry y captura de errores con Sentry. Todo se ejecuta con un único comando (`npm run quality`) que resume el estado, y cada pieza se puede ejecutar por separado.

La regla rectora es la del resto del repo: **determinista y sin red externa por defecto**. Las herramientas que necesitan un servicio local (SonarQube, un colector de trazas o el DSN real de Sentry) no bloquean: si el servicio no está, la puerta informa `SKIP` en lugar de `FAIL`.

## Piezas

- **Stryker** muta solo las reglas puras del dominio (`server/src/domain`), no la infraestructura ni la aplicación, porque ahí es donde viven las invariantes (reglas de negocio). El umbral de mutantes sobrevivientes se fija con `thresholds.break: 85` (puntuación de mutación mínima); por debajo, el comando falla. Excluye los archivos de solo tipos (`model.ts`, `ports.ts`).
- **SonarQube** analiza los tres paquetes (`server/src`, `web/src`, `piloto/src`). Se usa `@sonar/scan`, que descarga su propio JRE y motor, de modo que no hace falta instalar Java; solo se necesita un servidor SonarQube local (`docker-compose.sonar.yml`) y un `SONAR_TOKEN`. La puerta espera el verdicto con `sonar.qualitygate.wait=true`.
- **OpenTelemetry** instrumenta la API con auto-instrumentación (HTTP/Express) de `@opentelemetry/sdk-node`. Por defecto exporta a consola (trazas visibles sin levantar nada); con `OTEL_EXPORTER_OTLP_ENDPOINT` exporta a un colector OTLP/HTTP.
- **Sentry** captura los errores del servidor (`@sentry/node`, con `setupExpressErrorHandler` y la ruta de depuración `/api/debug/sentry-error`) y del cliente (`@sentry/react`). El DSN es configurable por entorno y, sin DSN, Sentry queda inactivo (no-op), de modo que el arnés sigue siendo determinista.

## Opciones consideradas

- **Stryker sobre todo el `src`**: más superficie, pero ralentiza el ciclo y muta código de adaptadores donde la relación mutante↔invariante es débil. Descartado: se acota al dominio.
- **SonarScanner de Java (`sonar-scanner-cli`)**: requiere instalar y mantener un JRE en el repo. Se descarta en favor de `@sonar/scan`, que autoaprovisiona el JRE y el motor.
- **Exportar trazas solo a un colector (Jaeger/OTLP)**: obliga a levantar infraestructura para ver una traza. Descartado: consola por defecto, OTLP opcional.
- **Sentry activo siempre**: lanza errores de arranque cuando no hay DSN y rompe el determinismo. Descartado: activación condicionada al DSN.