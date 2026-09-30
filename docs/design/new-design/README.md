# JTM · Diseño «Lino» — paquete de handoff (v2)

Paquete autocontenido para que agentes de código (Claude Code u otros) implementen el rediseño de JTM sobre el stack actual (React 19 + Vite + TS, CSS plano). En el repo vive en `docs/design/new-design/`: sustituye la versión anterior **in situ**, sin carpetas paralelas. Léelo en este orden:

| Fichero | Para qué |
|---|---|
| `README.md` | Este índice, qué cambia en v2 y reglas de uso |
| `decisiones.md` | Decisiones de producto/IA, URLs, cambios de dominio, vocabulario nuevo y huecos que siguen abiertos |
| `tokens.css` | Tokens como variables CSS (claro + oscuro). **Mandan sobre cualquier estética**. v2 no añade tokens |
| `especificacion-pantallas.md` | Por pantalla: layout, jerarquía, componentes, estados P4 y copy exacto. §01–§09 existentes (ajustes marcados **[v2]**) + §10–§15 nuevas |
| `componentes.md` | Componentes → clases CSS sugeridas (sección «Añadidos en v2») |
| `accesibilidad.md` | Criterios de accesibilidad por componente, contrato de los E2E (sección «Añadidos en v2») |
| `referencias/` | Prototipos HTML de referencia (ver abajo) |
| `referencias/capturas/` | PNG 1280×800 de cada pantalla. Cítalas en las issues |

`prompt-claude-design-pendientes.md` es el prompt con el que se abrió la sesión de diseño que produjo este paquete v2 (resolvió #13); queda como registro. No forma parte del handoff a agentes.

## Qué cambia en v2
**Nuevo** (§10–§15): lista de 1-to-1s con búsqueda · detalle de 1-to-1 (lectura, edición durante 7 días, «Cambios») · diálogo «Registrar incidencia» · diálogos «Nuevo / Editar objetivo» · temas propios en Ajustes de la mentee · varios proyectos por mentee.

**Ajustes a lo existente** (marcados [v2] en la especificación):
- Sidebar de ficha: ya no muestra proyectos bajo el nombre.
- §02 Mi equipo: columna «Proyectos», uno por línea.
- §03 Resumen: «Proyectos actuales»; «Gestionar temas propios»; vacío de temas propios con otro copy.
- §04 Registrar 1-to-1: «Retirar tema» pide confirmación.
- §07 Historial: eventos «1-to-1 … editado», «Entra en …» / «Sale de …» (sustituye «Cambio de proyecto»).
- §08 Ajustes de la mentee: tarjetas Temas propios + Proyectos + Traspaso.
- 3b Mentees: varios proyectos al dar de alta. 3f Proyectos: copy y recuento.
- URL del detalle: `/mentees/:id/1-to-1s/:unoAUnoId` (por id, no por fecha).
- Vocabulario: «Cambio de proyecto» sale del canon (ver `decisiones.md` → Vocabulario). **Actualizar `CONTEXT.md` del repo.**

## Capturas (`referencias/capturas/`)
| Nº | Fichero | Pantalla |
|---|---|---|
| 01 | `01-login.png` | Login · error |
| 02 | `02-mi-equipo.png` · `oscuro-02-mi-equipo.png` | Mi equipo **[v2]** |
| 03 | `03-resumen.png` · `oscuro-03-resumen.png` | Resumen **[v2]** |
| 04 | `04-registrar-1-to-1.png` | Registrar 1-to-1 |
| 05 | `05-objetivos.png` | Objetivos |
| 06 | `06-incidencias.png` | Incidencias + Resolver |
| 07 | `07-historial.png` | Historial **[v2]** |
| 08 | `08-ajustes-de-la-mentee.png` | Ajustes de la mentee + traspaso **[v2]** |
| 09a–09f | `09a-…` a `09f-…` | Ajustes (perfil, apariencia, plantilla, mentees **[v2]**, managers, proyectos **[v2]**) |
| 10 | `10-lista-1-to-1s.png` | Lista de 1-to-1s |
| 10b | `10b-lista-1-to-1s-busqueda.png` | Lista · búsqueda activa |
| 11 | `11-detalle-1-to-1.png` | Detalle · lectura, fuera de plazo, cambios |
| 11b | `11b-detalle-1-to-1-edicion.png` | Detalle · modo edición |
| 12 | `12-registrar-incidencia.png` | Diálogo Registrar incidencia |
| 13 | `13-nuevo-objetivo.png` | Diálogo Nuevo objetivo · error |
| 13b | `13b-editar-objetivo.png` | Diálogo Editar objetivo · enviando |
| 14 | `14-temas-propios.png` | Temas propios en Ajustes de la mentee |
| 14b | `14b-retirar-tema-propio.png` | Confirmación de retirada |
| 15 | `15-sacar-del-proyecto.png` | Varios proyectos + «Sacar del proyecto» |

## Sobre los ficheros de diseño
Los HTML de `referencias/` son **referencias de diseño**, no código de producción. Usan estilos inline y un runtime propio (`support.js`) solo para poder previsualizarse. La tarea es **recrearlos en la app React existente** con CSS plano + las variables de `tokens.css` + clases semánticas; no copiar el HTML. Si una referencia y la especificación discrepan, **manda la especificación**.

## Fidelidad
**Alta fidelidad (hi-fi)**: colores, tipografía, radios, sombras, espaciado y copy son finales. Las medidas de marco (1280×800) son de lienzo; la app debe ser fluida (responsive en `decisiones.md`).

## Reglas para los agentes
1. Todo valor visual sale de `tokens.css`. Si falta un token, se añade ahí; nunca hex/oklch sueltos en componentes.
2. El copy es exacto y en español. Vocabulario canónico: Manager, Mentee, Equipo, Traspaso, 1-to-1, Tema (genérico / propio), Acuerdo, Proyecto, Entrada / Salida de proyecto, Incidencia, Objetivo, Edición / Cambios. No se cambia.
3. La semántica accesible es contrato de tests (`accesibilidad.md`): cada elemento interactivo con nombre accesible, cada sección de ficha como `region` con `aria-label`.
4. Estados P4 obligatorios en cada pantalla y formulario (§ Estados).
5. Alcance funcional cerrado: lo marcado como «exploración futura» no se implementa.
6. Dependencia nueva propuesta: un router (`react-router`) para las URLs de `decisiones.md`. Sin librería de iconos: los únicos glifos son ←, ↑, ↓, ✓, ▾, ▴ en texto.
7. Datos de ejemplo (seed): Marta Manager; Ana Alonso (Atlas Bank), Beatriz Blanco (Retail Nova), Carla Cano (Aurora Health · Nexo Seguros · Portal Interno). Traspaso Diego Domínguez → Marta el 10 ene 2025. Proyectos vigentes: Atlas Bank, Aurora Health, Green Energy, Nexo Seguros, Portal Interno, Retail Nova; retirado: Campus EdTech. Ana: 1-to-1s quincenales en 2026 (último 20 sept, editado el 22 sept).

## Cómo abrir las referencias
Abre los `.dc.html` en un navegador con `support.js` al lado y conexión (Google Fonts). Son lienzos con zoom:
- `JTM Lino.dc.html`: turno **3** (Ajustes) y turno **2a** (pantallas 01–09 + oscuro), actualizados a v2.
- `JTM Lino huecos.dc.html`: turno **4** (pantallas 10–15).
- `wireframe-1-to-1s.dc.html` (lista vs. maestro-detalle; elegida 1a) y `wireframe-proyectos.dc.html` (varios proyectos): wireframes de decisión, baja fidelidad.
- `wireframe-a-*.dc.html`: wireframes de estructura del primer paquete.
