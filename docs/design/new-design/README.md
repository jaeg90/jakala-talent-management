# JTM · Diseño «Lino» — paquete de handoff

Paquete autocontenido para que agentes de código (Claude Code u otros) implementen el rediseño de JTM sobre el stack actual (React 19 + Vite + TS, CSS plano). Pensado para leerse en este orden:

| Fichero | Para qué |
|---|---|
| `README.md` | Este índice, fidelidad y reglas de uso |
| `decisiones.md` | Decisiones de producto/IA tomadas, alcance, cambios de dominio y huecos pendientes |
| `tokens.css` | Sistema de tokens como variables CSS (claro + oscuro). **Mandan sobre cualquier estética** |
| `especificacion-pantallas.md` | Especificación por pantalla: layout, jerarquía, componentes, estados y copy exacto |
| `componentes.md` | Catálogo de componentes reutilizables → clases CSS sugeridas |
| `accesibilidad.md` | Criterios de accesibilidad por componente (contrato de tests E2E) |
| `referencias/` | Prototipos HTML de referencia (abrir `JTM Lino.dc.html` en un navegador) |
| `referencias/capturas/` | PNG 1280×800 de cada pantalla (01–08, 09a–09f Ajustes, oscuro-*). Cítalas en las issues |

## Sobre los ficheros de diseño
Los HTML de `referencias/` son **referencias de diseño**, no código de producción. Usan estilos inline y un runtime propio (`support.js`) solo para poder previsualizarse. La tarea es **recrearlos en la app React existente** con CSS plano + las variables de `tokens.css` + clases semánticas; no copiar el HTML.

## Fidelidad
**Alta fidelidad (hi-fi)** para identidad Lino: colores, tipografía, radios, sombras, espaciado y copy son finales. Las medidas de marco (1280×800) son de lienzo; la app debe ser fluida (ver responsive en `decisiones.md`).

## Reglas para los agentes
1. Todo valor visual sale de `tokens.css`. Si falta un token, se añade ahí; nunca hex/oklch sueltos en componentes.
2. El copy es exacto y en español. El vocabulario canónico (Manager, Mentee, Equipo, Traspaso, 1-to-1, Tema, Acuerdo, Proyecto, Cambio de proyecto, Incidencia, Objetivo) no se cambia.
3. La semántica accesible es contrato de tests (`accesibilidad.md`): cada elemento interactivo con nombre accesible, cada sección de ficha como `region` con `aria-label`.
4. Alcance funcional cerrado: lo marcado como «exploración futura» no se implementa.
5. Dependencia nueva propuesta: un router (`react-router`) para las URLs de `decisiones.md`. Sin librería de iconos: los únicos glifos son ←, ↑, ↓, ✓, ▾ en texto.

## Cómo abrir las referencias
`referencias/JTM Lino.dc.html` necesita `support.js` al lado y conexión (Google Fonts). Es un lienzo con zoom: turno **3** (Ajustes reorganizado, arriba) y turno **2a** (9 pantallas + oscuro). `wireframe-a-*.dc.html` son los wireframes de estructura (baja fidelidad).
