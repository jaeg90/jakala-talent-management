# JTM - Jakala Talent Management

Herramienta web interna para que los managers de Jakala hagan el seguimiento de su equipo: 1-to-1s, cambios de proyecto, incidencias y objetivos.

TFM del Máster de Desarrollo con IA.

> **Estado: en construcción. Todos los datos son ficticios.**

## Puesta en marcha

Requisitos: Node.js 24+ y npm. Desde un clon limpio:

```bash
npm install
npm run build
npm start          # http://localhost:3001
```

Manager semilla (ficticio): `manager@jakala.example` / `secreta123`.

## Arnés (todos deterministas, sin red externa)

```bash
npm run typecheck   # TypeScript en server y web
npm run lint        # ESLint (typescript-eslint, config plana)
npm test            # Vitest: unitarios e integración (SQLite temporal)
npm run test:e2e    # Playwright: construye, arranca el servidor y recorre la UI
```

Los E2E recorren el camino del esqueleto: login → vista de equipo → logout.

## Monorepo

- `server/` — Express con arquitectura hexagonal: `src/domain` (modelo y puertos), `src/application` (casos de uso) y `src/infrastructure` (adaptadores: HTTP, SQLite, sesiones). La autenticación vive tras un puerto (ADR-0002).
- `web/` — React + Vite: login, vista de equipo y cierre de sesión.
- `e2e/` — pruebas Playwright contra la app construida y servida en un único puerto.
