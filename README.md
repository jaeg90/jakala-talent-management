# JTM — Jakala Talent Management

Herramienta web interna para que los managers de Jakala hagan el seguimiento de las personas de su equipo: 1-to-1s, acuerdos, objetivos, incidencias, proyectos e historial de cada persona. Es el Trabajo Fin de Máster (TFM) del Máster de Desarrollo con IA, con dos aportaciones: **el producto** (esta aplicación) y **el proceso con el que se construyó** — sesiones de IA orquestadas por el Piloto, con arnés de calidad, skills y puertas. **Todos los datos son ficticios.**

## Versión entregada

La versión que se evalúa es el tag **`v1.1.0-entrega`**.

`v1.0.0-mvp` (13-oct-2026) congeló el producto. `v1.1.0-entrega` **no cambia la aplicación**: añade documentación, la guía del Piloto (`piloto/README.md`), sus escenarios de simulación, los datos de coste medidos (`docs/costes/`) y la puerta de permisos (ADR-0006, ajuste del 15-oct).

## Demo en línea

**<https://jtm.onrender.com/>** — la demo usa los mismos datos ficticios de la semilla.

Managers semilla (ficticios, misma contraseña `secreta123`):

| Email | Nombre | Equipo |
|---|---|---|
| `manager@jakala.example` | Marta Manager | Ana, Beatriz, Carla |
| `diego@jakala.example` | Diego Domínguez | David, Elena, Fernando |
| `lucia@jakala.example` | Lucía López | Gabriela, Hugo (sin proyecto) |

## Dónde está cada parte

| Pieza | Dónde | Qué es |
|---|---|---|
| Aplicación (backend) | `server/` | Express con arquitectura hexagonal: dominio, casos de uso y adaptadores |
| Aplicación (frontend) | `web/` | React + Vite: login, equipo, ficha de mentee, historial |
| El Piloto | `piloto/` | El orquestador determinista del proceso; guía en `piloto/README.md` |
| Instrucciones para las sesiones de IA | `AGENTS.md` | Convenciones, reglas y guardarraíles que leen las sesiones |
| Permisos de las sesiones | `opencode.json` | Reglas `deny` (ADR-0006), con su test en `piloto/test/permisos.test.ts` |
| Skills de terceros (24) | `.agents/skills/` | Skills vendored, reescritas con evidencia del repo |
| Skills propias (2) | `.opencode/skills/` | `piloto-supervision` y `piloto-cierre-jornada` |
| Puertas y calidad | `scripts/`, `e2e/`, `.github/workflows/` | Arnés determinista, E2E y CI |
| Decisiones de arquitectura (13 ADRs) | `docs/adr/` | De ADR-0001 (stack) a ADR-0013 (modelos por tipo) |
| Glosario del dominio y del Piloto | `CONTEXT.md` | Vocabulario único del proyecto |
| Investigación | `docs/research/` | Sondas y fuentes (OpenCode V2, permisos, procesos) |
| Diseño | `docs/design/` | Especificaciones de pantallas (hecho con Claude Design) |
| Costes medidos de las sesiones de IA | `docs/costes/` | Sesiones del Piloto (CSV), resumen de totales, el export de OpenRouter (229,52 USD en total) y la conciliación entre ambos; generados con `npm run costes` |
| Trabajo futuro | issues con la etiqueta `post-mvp` | Las mejoras #46–#55 recogen propuestas del feedback de compañeros managers que probaron la herramienta |

## Puesta en marcha local

Requisitos: Node.js 24 (la versión de la CI) y npm.

```bash
npm ci
npm run build
npm start          # http://localhost:3001
```

Para reiniciar la base de datos: borra `jtm.db*` de la raíz; la semilla se recrea al arrancar. La ruta se puede cambiar con la variable `JTM_DB` (`server/src/main.ts`).

## Verificación

```bash
npm run typecheck   # TypeScript en server, web y piloto
npm run lint        # ESLint (typescript-eslint, config plana) + puerta de literales CSS
npm test            # Vitest: unitarios e integración del servidor y del Piloto
npm run test:e2e    # Playwright: construye, arranca el servidor y recorre la UI
npm run quality      # Arnés de calidad: Stryker + SonarQube + trazas OTel + Sentry (resumen final)
```

Los E2E recorren: login y logout, Mi equipo, la ficha con su Resumen, el ciclo completo de un 1-to-1 (registro con notas y acuerdos, lista, detalle, marcar cumplido), temas propios, objetivos, incidencias, historial, traspaso y todos los ajustes (perfil, managers, mentees, plantilla, proyectos, apariencia).

Para los E2E en un equipo nuevo, el paso previo es `npx playwright install chromium` — sin él fallan (no hay navegador).

Medición del 15-oct-2026 (resumen del runner):

| Suite | Tests | Comando |
|---|---|---|
| Servidor | 388 | `npm test --workspace server` |
| Piloto | 74 | `npm test --workspace piloto` |
| E2E | 98 | `npm run test:e2e` |
| **Total** | **560** | |

La CI ejecuta typecheck, lint, tests y build en cada push a main: <https://github.com/jaeg90/jakala-talent-management/actions>.

`npm run quality` necesita SonarQube local (`docker-compose.sonar.yml`). Sin servidor o sin `SONAR_TOKEN`, esa pieza informa `SKIP` y no `FAIL` (ADR-0005), para no romper el determinismo.

## El Piloto en un minuto

El Piloto es el orquestador determinista del proceso: una máquina de estados en TypeScript que coge tickets de GitHub y los hace implementar, revisar y reparar por sesiones de IA de contexto fresco. Ninguna sesión se autoevalúa; solo las puertas del arnés firman verde. Guía completa en [`piloto/README.md`](piloto/README.md).

```bash
npm run piloto -- --simular=reparacion        # un hallazgo, una reparadora, verde a la segunda
npm run piloto -- --simular=escalado          # reintentos agotados: el ticket escala al humano
npm run piloto -- --simular=devolucion-revisora   # una DUDA devuelve el ticket al humano
```

## Monorepo

- `server/` — Express con arquitectura hexagonal: `src/domain` (modelo, reglas y puertos), `src/application` (casos de uso) y `src/infrastructure` (adaptadores: HTTP, SQLite, sesiones). La autenticación vive tras un puerto (ADR-0002).
- `web/` — React + Vite: login, vista de equipo, ficha de mentee con historial de 1-to-1s, acuerdos y objetivos anuales.
- `e2e/` — pruebas Playwright contra la app construida y servida en un único puerto.
- `piloto/` — el orquestador determinista (núcleo puro + adaptadores detrás de puertos, ADR-0003/0004).
- `scripts/` — las puertas del arnés que no son tests: literal CSS, SonarQube y el resumen de calidad.