# AGENTS.md

JTM (Jakala Talent Management) — herramienta web interna para que los managers hagan el seguimiento de las personas de su equipo: 1-to-1s, cambios de proyecto, incidencias y objetivos. Trabajo Fin de Máster (TFM) de Desarrollo con IA; todos los datos son ficticios.

## Idioma

Toda la documentación y los artefactos del proyecto (issues, ADRs, glosario, especificaciones, mensajes de commit, comentarios) se escriben en **español**. Los archivos internos de las skills, los identificadores de etiquetas y los comandos se mantienen en inglés.

## Agent skills

### Issue tracker

Las tareas se registran en los GitHub Issues de este repo mediante `gh`. Ver `docs/agents/issue-tracker.md`.

### Triage labels

Se usan tal cual las cinco etiquetas de triage por defecto. Ver `docs/agents/triage-labels.md`.

### Domain docs

Single-context: `CONTEXT.md` en la raíz + `docs/adr/`. Ver `docs/agents/domain.md`.

## Arnés de calidad

Además de las puertas (typecheck, lint, tests, E2E), el repo tiene un arnés de calidad determinista (ADR-0005). El comando que lo ejecuta todo y resume el estado es:

```bash
npm run quality
```

Imprime una tabla con `PASS`/`FAIL`/`SKIP` por pieza y el veredicto final (`VERDE`/`ROJO`). Cada pieza se ejecuta también por separado:

| Comando | Qué comprueba |
|---|---|
| `npm run test:mutation` | Stryker muta el dominio; umbral `break: 85` (≤15% de mutantes sobrevivientes) |
| `npm run sonar` | SonarQube analiza el proyecto con `sonar.qualitygate.wait=true` (sin issues bloqueantes) |
| `npm run test:otel` | Las peticiones a la API generan trazas OpenTelemetry (exportador en memoria) |
| `npm run test:sentry` | Un error simulado llega a Sentry como envelope con el DSN por entorno |

### Stryker

Corre sobre `server/src/domain` (reglas puras), excluyendo los archivos de solo tipos. El umbral está en `server/stryker.config.mjs`; el informe HTML queda en `server/reports/mutation/mutation.html`.

### SonarQube (única pieza que necesita un servicio local)

Sin Java: `@sonar/scan` autoaprovisiona el JRE y el motor. Solo hace falta el servidor:

```bash
docker compose -f docker-compose.sonar.yml up -d   # http://localhost:9000 (admin/admin)
export SONAR_TOKEN=<token>                          # token creado en SonarQube
export SONAR_HOST_URL=http://localhost:9000         # opcional
npm run sonar
```

Si el servidor no está o falta `SONAR_TOKEN`, la puerta informa `SKIP` (no `FAIL`) para no romper el determinismo.

### OpenTelemetry (trazas de la API)

Arranca con el servidor (`npm start`). Por defecto las trazas salen por consola (visibles sin infraestructura); para exportarlas a un colector OTLP/HTTP:

```bash
OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318 npm start
```

### Sentry (errores de servidor y cliente, DSN configurable)

Sentry solo se activa si hay DSN; sin DSN es un no-op. Variables de entorno:

- Servidor: `SENTRY_DSN`, `SENTRY_ENVIRONMENT` (opcional).
- Cliente (Vite): `VITE_SENTRY_DSN`, `VITE_SENTRY_ENVIRONMENT` (opcional; se pueden poner en `web/.env`).

Ruta de depuración para simular un error de servidor: `GET /api/debug/sentry-error`.
