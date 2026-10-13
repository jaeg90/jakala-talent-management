# JTM - Jakala Talent Management

Herramienta web interna para que los managers de Jakala hagan el seguimiento de su equipo: 1-to-1s, cambios de proyecto, incidencias y objetivos.

TFM del Máster de Desarrollo con IA.

> **Estado: MVP v1 terminado y congelado (13-oct-2026). Todos los datos son ficticios.** El trabajo futuro — tickets pendientes del rediseño Lino y las mejoras definidas en el grill de cierre — vive en el tracker con la etiqueta [`post-mvp`](https://github.com/jaeg90/jakala-talent-management/issues?q=is%3Aissue+label%3Apost-mvp).

## Puesta en marcha

Requisitos: Node.js 24+ y npm. Desde un clon limpio:

```bash
npm install
npm run build
npm start          # http://localhost:3001
```

Managers semilla (ficticios, misma contraseña `secreta123`):

| Email | Nombre | Equipo |
|---|---|---|
| `manager@jakala.example` | Marta Manager | Ana, Beatriz, Carla |
| `diego@jakala.example` | Diego Domínguez | David, Elena, Fernando |
| `lucia@jakala.example` | Lucía López | Gabriela, Hugo (sin proyecto) |

## Arnés (todos deterministas, sin red externa)

```bash
npm run typecheck   # TypeScript en server y web
npm run lint        # ESLint (typescript-eslint, config plana)
npm test            # Vitest: unitarios e integración (SQLite temporal)
npm run test:e2e    # Playwright: construye, arranca el servidor y recorre la UI
npm run quality     # Arnés de calidad: Stryker + SonarQube + trazas + Sentry (resumen final)
```

Los E2E recorren: login y logout, Mi equipo, la ficha con su Resumen, el ciclo completo de un 1-to-1 (registro con notas y acuerdos, lista, detalle, marcar cumplido), temas propios, objetivos, incidencias, historial, traspaso y todos los ajustes (perfil, managers, mentees, plantilla, proyectos, apariencia).

## Monorepo

- `server/` — Express con arquitectura hexagonal: `src/domain` (modelo, reglas y puertos), `src/application` (casos de uso) y `src/infrastructure` (adaptadores: HTTP, SQLite, sesiones). La autenticación vive tras un puerto (ADR-0002).
- `web/` — React + Vite: login, vista de equipo, ficha de mentee con historial de 1-to-1s, acuerdos y objetivos anuales.
- `e2e/` — pruebas Playwright contra la app construida y servida en un único puerto.
