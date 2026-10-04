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

### Tickets

Todo ticket lleva su sección «Alcance» (Aplica a / Fuera de alcance) y cita verbatim su porción de spec: las sesiones de contexto fresco del Piloto solo ven el cuerpo del issue (ADR-0011). Al crear, reescribir o partir tickets, ver `.agents/skills/writing-tickets`.

## Sesiones del Piloto

Las sesiones del ciclo (implementadora, reparadora, revisora) leen este archivo. Reglas del paquete Lino, destiladas de los escalados por acumulación (#18 el 3-oct, #22 el 4-oct): el patrón fue hallazgos finos que aparecían en serie, uno por ronda. Estas reglas atajan las clases recurrentes.

**Implementadora y reparadora:**

- **Helpers existentes antes que nuevos**: antes de definir un helper (fechas, nombres, formateos), grepea el repo; si existe uno equivalente, impórtalo. Las copias duplicadas (`hoyISO` ×3, `fechaHace` ×2 en #22) son hallazgo.
- **Valores visuales solo desde tokens**: todo valor visual (colores, radios, paddings, tamaños, alturas) sale de `tokens.css`; si falta el token, se añade allí. Los literales sueltos en `lino.css`/componentes son hallazgo (clase serial del 5-oct: una ronda entera por ticket).
- **Clases de la spec verificadas**: la clase que la spec nombra (`.tarjeta--plana`, `.badge--retirado`) debe existir en `lino.css` con sus valores, y los botones con aspecto de enlace (`.accion`) anulan el fondo heredado de `button`.
- **Estado asíncrono compartido**: si una petición actualiza estado que vive en otra vista (punto terracota del sidebar, contadores), usa el mecanismo de descarte del contenedor (token/`solicitud`); una respuesta atrasada nunca puede sobrescribir el estado de otra mentee.
- **Acciones que vacían listas**: toda acción que quita un elemento (Resolver, Retirar, Marcar) cubre en E2E el elemento en medio, el último y la lista que queda vacía, con el destino de foco verificado en cada caso.
- **CTAs en estados de carga/error**: un botón que no puede completar su acción durante skeleton o error va deshabilitado (o no se renderiza); nunca habilitado e inerte.
- **La cascada no degrada lo pintado**: los valores que la spec pinta (min-heights, paddings) deben ganar la cascada; cuando el componente compite con una regla genérica (`.campo textarea` vs la clase propia), verifica el computed style en E2E.
- **E2E sin contaminación**: los E2E corren contra una base compartida; toda mutación que haga una prueba (datos, eventos derivados, altas de catálogo) se revierte completa antes de terminar o la prueba usa solo datos creados por ella. Restaurar a medias (las asignaciones pero no sus eventos, ni el proyecto retirado) es hallazgo: el spec siguiente hereda una base sucia.

**Revisora**: la tabla «CRITERIO n: OK / HALLAZGO — …» del prompt es innegociable — una línea por CADA criterio del ticket, con la numeración del cuerpo (sin reagrupar, sin bloques resumen tipo «Criterios auditados»). Además de esa tabla, audita en CADA diff de pantalla las clases transversales desde la primera ronda, no cuando el diff ya esté limpio — foco tras desmontar el disparador, CTAs en estados de carga/error, cascada CSS contra los valores pintados, carreras de peticiones al cambiar de mentee, duplicación de helpers, valores visuales fuera de `tokens.css`, y que cada E2E nuevo verifique lo que dice verificar. Un criterio de «sin rastro» de una vista eliminada cubre también su contrato API (rutas y métodos cliente sin consumidores), no solo la ruta UI. Las clases conocidas no se descubren una por ronda.

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
