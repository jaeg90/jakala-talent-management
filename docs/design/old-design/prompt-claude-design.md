# Prompt para Claude Design — evolución UX/UI de JTM

> **Cómo usarlo**: Claude Design no conoce JTM por sí solo; entrégale el estado actual así:
>
> 1. **Adjunta las capturas** de `docs/design/capturas/` (01-login … 05-proyectos) al primer
>    mensaje, junto con este documento. Son la referencia visual exacta de la UI actual.
> 2. **Conecta el código del repo**: en claude.ai/design con Import → GitHub (el repo de JTM);
>    o desde Claude Code con `/design-sync`, que extrae tu sistema de diseño del código para
>    que los prototipos se construyan sobre tus componentes y estilos reales.
> 3. Pega este documento completo como primer mensaje.

---

Eres mi diseñador/a de producto. Te doy el contexto completo de JTM: qué es, cómo funciona hoy, qué lenguaje visual tiene y hasta dónde quiero llevar el diseño. Trabaja conmigo, no para mí: pregunta antes de asumir y dame opciones cuando haya decisiones de gusto.

## 1. Qué es JTM

JTM (Jakala Talent Management) es una herramienta web interna para que los managers de Jakala hagan el seguimiento de las personas de su equipo: 1-to-1s, cambios de proyecto, incidencias y objetivos. Es un Trabajo Fin de Máster; todos los datos son ficticios.

**El problema que resuelve**: hoy ese seguimiento vive disperso (correo, notas sueltas y memoria). Los objetivos anuales están en otra plataforma de la empresa que no permite hacer seguimiento. No existe un lugar único donde consultar el historial de cada persona ni qué quedó pendiente de la última conversación.

**La idea**: un lugar único y privado donde cada manager registra y consulta el seguimiento de sus mentees. El historial pertenece a la persona: si hay traspaso de manager, el nuevo lo hereda completo.

**Quién lo usa**: un único rol, el **manager**. Inicia sesión con email y contraseña y solo ve los datos de su equipo. Las mentees no inician sesión; son el dato, no usuarias.

**Norte del diseño**: el momento crítico de uso es *"¿dónde centro mi atención hoy y cómo preparo mi siguiente 1-to-1?"*. Esa pregunta debe poder responderse de un vistazo en la primera pantalla.

## 2. Vocabulario canónico (la UI habla exactamente así)

| Término | Significado | Nunca digas |
|---|---|---|
| **Manager** | Persona que inicia sesión y hace el seguimiento. Único rol de usuario | jefe, supervisor, usuario |
| **Mentee** | Persona cuyo seguimiento gestiona un manager. Es dato; no inicia sesión | colaborador, mentorizado, empleado, talento |
| **Equipo** | Conjunto de mentees de un manager | plantilla, staff |
| **Traspaso** | Paso de una mentee a otro manager; el nuevo hereda el historial completo | transferencia, reasignación |
| **1-to-1** | Conversación registrada: fecha, notas por tema y acuerdos | reunión individual, catch-up |
| **Tema** | Asunto que se trata en los 1-to-1s. Genérico (plantilla común) o propio (de la mentee; persiste hasta retirarse) | campo, pregunta |
| **Acuerdo** | Compromiso que nace de un 1-to-1; queda pendiente hasta cumplirse | tarea, action item |
| **Proyecto** | Proyecto de cliente en el que trabaja una mentee; tiene uno actual o ninguno | cuenta, cliente |
| **Cambio de proyecto** | Paso a otro proyecto (o a ninguno), con fecha y motivo | movimiento, rotación |
| **Incidencia** | Suceso extraordinario (baja, conflicto, retraso, situación personal con impacto); nace abierta y se resuelve con nota | problema, alerta |
| **Objetivo** | Meta anual SMART: título, descripción, fecha límite; en curso → cumplido / no cumplido | meta, KPI |

Toda la UI está en español. El copy es material de diseño: cuida la redacción de botones, vacíos y mensajes como cuidarías el espaciado. Los botones dicen lo que hacen ("Marcar cumplido", no "OK") y un mismo concepto se llama igual en toda la herramienta.

## 3. El producto hoy (MVP funcional completo)

Stack: React 19 + Vite + TypeScript, CSS global plano (sin Tailwind, sin librería de componentes, sin iconos). Sin router todavía: la navegación es estado interno de React, aún no hay URLs por pantalla. Servidor Express + SQLite con semilla ficticia.

### Pantallas (5)

1. **Login** — `h1` "JTM", subtítulo "Jakala Talent Management", email + contraseña, error en texto rojo.
2. **Mi equipo** — header con acciones "Incidencias", "Proyectos", nombre del manager y "Cerrar sesión". Lista del equipo: nombre de cada mentee + proyecto actual (o "Sin proyecto"). Estados: cargando / vacío / lista. Al pinchar una mentee se abre su ficha.
3. **Ficha de mentee** — el corazón del producto. Hoy es una sola columna con 8 secciones apiladas, en este orden: Acuerdos pendientes → Temas propios → Objetivos anuales → Incidencias → Cambios de proyecto → Traspaso → Registrar 1-to-1 → Historial de 1-to-1s. El formulario de 1-to-1 trae automáticamente los temas genéricos ("¿Cómo estás?", "¿Qué tal el proyecto?", "¿Qué tal los objetivos?") y los propios de la mentee, con un input de nota por tema y una lista de acuerdos nuevos.
4. **Incidencias abiertas** — vista global del equipo: cada incidencia con mentee, fecha y descripción, y resolución con nota obligatoria.
5. **Proyectos** — catálogo de proyectos (con alta) y "Quién está en cada proyecto": agrupación de mentees por proyecto actual, incluido el grupo "Sin proyecto".

### Estados del dominio que la UI refleja

- Acuerdo: pendiente → cumplido (se marca, no se desmarca).
- Tema propio: vigente → retirado (desaparece del formulario del siguiente 1-to-1).
- Objetivo: en curso → cumplido / no cumplido (sin reapertura; solo editable en curso).
- Incidencia: abierta → resuelta con nota (sin reapertura; queda en historial).
- Cambio de proyecto y traspaso: irreversibles, con fecha y motivo; dejan historial.

### Semilla de demo (datos ficticios reales)

Manager de ejemplo: **Marta Manager** (`manager@jakala.example`), con equipo de 3: **Ana Alonso** (Atlas Bank), **Beatriz Blanco** (Retail Nova), **Carla Cano** (Aurora Health). Otros managers: Diego Domínguez (David Duarte, Elena Estévez, Fernando Fuentes) y Lucía López (Gabriela Gómez, Hugo Herrera — sin proyecto). Proyectos: Atlas Bank, Retail Nova, Aurora Health, Campus EdTech, Green Energy.

Ojo: la semilla actual no incluye historial (1-to-1s, acuerdos, objetivos, incidencias), así que las pantallas reales arrancan vacías. Para los diseños, rellena con contenido ficticio verosímil del estilo de:

- Acuerdos pendientes: "Pedir acceso a la plataforma de formación", "Hablar con el líder de Atlas Bank sobre su carga".
- Objetivos: "Certificación Azure AZ-900 antes de junio", "Liderar una sesión técnica interna cada trimestre".
- Incidencias: "Baja por gripe (septiembre)", "Conflicto de prioridades con el líder técnico del proyecto".
- Notas de 1-to-1: breves, en primera persona, tono de conversación real de trabajo.

## 4. Lenguaje visual actual (punto de partida; no es techo)

Hoy es deliberadamente austero, "formulario de intranet mínimo":

- **Tipografía**: `system-ui` genérica; jerarquía solo con tamaños por defecto del navegador.
- **Color** (todo hardcoded, sin variables): texto `#1a1a2e`, fondo `#f5f5fa`, tarjeta blanca, primario indigo `#4338ca` (hover `#3730a3`), error `#b91c1c`, gris secundario `#666`, éxito `#15803d`, bordes `#eee`/`#ccc`.
- **Layout**: una única columna centrada de 40rem (tarjeta blanca, radius 8px, sombra suave). Cero media queries: el diseño móvil no existe.
- **Estados de UI**: "Cargando…" en texto plano; vacíos tipo "Sin acuerdos pendientes."; errores como texto rojo bajo el formulario.
- **Sin identidad**: sin logo (solo el "JTM" del login), sin iconos, sin badges (los estados son texto plano: "Estado: en curso"), fechas ISO crudas (`2026-09-27`).

**Fortalezas a conservar**: HTML semántico limpio (`main`, `header`, `section` con `aria-label`, labels envueltas, `lang="es"`); el vocabulario del dominio respetado al pie de la letra; cero ruido: cada pantalla hace una cosa.

## 5. Contratos que el diseño debe respetar

1. **La semántica accesible es un contrato de tests.** Los E2E (Playwright) localizan los elementos por rol, label y regiones con `aria-label` (`getByLabel`, `getByRole('region', …)`). Cada elemento interactivo del diseño debe tener nombre accesible; cada sección de la ficha debe seguir siendo una región identificable.
2. **Los tokens deben ser variables CSS** (custom properties). El CSS es plano, sin build de estilos: el sistema de diseño que propongas debe materializarse como variables CSS + clases, no como dependencias pesadas. Si crees que hace falta una librería nueva (router, iconos), propónla explícitamente y justifícala.
3. **Alcance funcional cerrado.** El MVP no incluye: notificaciones ni recordatorios, calendario o programación de 1-to-1s, adjuntos, exportaciones o informes, progreso de objetivos por hitos o porcentajes, rol mentee/RRHH. Diseña dentro de este alcance; si algo se te antoja fuera, márcalo siempre como "exploración futura", separado del diseño implementable.
4. **Densidad de herramienta interna, no landing page.** El manager vive aquí varias veces por semana: prioriza escaneo rápido, jerarquía clara y calma sobre espectacularidad. El hero de este producto es la lista del equipo.

## 6. Adónde quiero llevar el diseño (prioridades, de mayor a menor)

### P1 — Identidad visual y sistema de diseño
JTM no tiene identidad. Quiero **2–3 direcciones de identidad visual** en paralelo (paleta con nombres, pareja tipográfica con carácter —nada de Inter/Roboto/system-ui como identidad—, escala de espaciado, radios, sombras, badges de estado, tratamiento de fechas) para elegir una, no una cerrada. Es un TFM: me interesa una identidad defendible y con personalidad de herramienta profesional serena, no un template. El indigo actual puede evolucionar o desaparecer.

### P2 — "Mi equipo" como panel de atención
La historia de usuario más importante y aún sin implementar: *"ver indicadores por mentee (acuerdos pendientes, incidencias abiertas, objetivos en curso) para saber dónde centrar mi atención"*. Convierte la lista en un panel que responda de un vistazo: ¿quién necesita atención hoy y por qué? Explora orden, agrupación y señal visual por mentee; también qué **no** mostrar para no generar ruido. La antigüedad del último 1-to-1 es una señal válida (la fecha ya existe).

### P3 — Reorganizar la ficha de mentee
Hoy es un monolito de 8 secciones en una columna. Diseña una arquitectura de la información que:
- ponga "preparar el siguiente 1-to-1" arriba y de un vistazo (acuerdos pendientes, objetivos en curso, incidencias abiertas, último 1-to-1);
- trate "Registrar 1-to-1" como la acción más frecuente y la haga prominente;
- convierta los historiales (1-to-1s, cambios de proyecto, incidencias, traspasos) en una lectura cronológica agradable (explora un timeline);
- use badges de estado y fechas legibles en lugar de texto plano;
- añada confirmación a las acciones irreversibles (traspaso, cambio de proyecto);
- valore si pestañas, anclas o sub-navegación mejoran el escaneo frente a la columna única.

### P4 — Estados de UI de verdad
Skeletons o indicadores con criterio; vacíos que inviten a actuar (no solo "Sin acuerdos pendientes."); errores accionables; fechas legibles ("hace 3 semanas", "27 sept 2026").

### P5 — Responsive y foco
Desktop primero (es una herramienta de trabajo), pero define el comportamiento en móvil (hoy el header puede desbordar). Foco visible para teclado y contraste cuidado (el gris `#666` actual sobre blanco queda justo).

### Exploraciones futuras (concepto, fuera del MVP — márcalo siempre así)
- Vista "preparar el siguiente 1-to-1": agregado por mentee de lo que hay que repasar antes de la conversación.
- Visualización del recorrido de una mentee (proyectos por los que ha pasado, traspasos).

## 7. Cómo quiero trabajar contigo: skills y momentos

Tienes instaladas las skills de `designer-skills` y el plugin oficial `frontend-design`, además del propio Claude Design. Úsalas en este orden. Todos los documentos que generes van en español, dentro de `.design/` (los identificadores de skills y comandos, en inglés).

**Fase 0 — Sincroniza con mi código.** Antes de diseñar nada: `/design-sync` (o Import del repo en Claude Design). Quiero que los prototipos usen mis componentes y estilos reales, no genéricos.

**Fase 1 — Entrevístame.** `/designer-skills:grill-me`. Este documento es tu punto de partida: no me preguntes lo que ya está respondido en las secciones 1–6; pregúntame lo que falte (gustos estéticos, prioridades entre P1 y P5, qué señales **no** mostrar en el panel de atención, si el dark mode entra en el MVP o queda como preparación).

**Fase 2 — Consolida el brief.** `/designer-skills:design-brief`: convierte este documento + la entrevista en un design brief estructurado. Respeta el alcance cerrado de la sección 5.

**Fase 3 — Arquitectura de la información.** `/designer-skills:information-architecture`: navegación, jerarquía de contenidos, patrones de URL (hoy no hay router; proponer URLs es bienvenido) y flujos de usuario. Es la skill clave para P2 (panel de atención) y P3 (reorganizar la ficha).

**Fase 4 — Tokens.** `/designer-skills:design-tokens`: sistema completo (color, tipografía, espaciado, motion) materializado **como variables CSS** — contrato de la sección 5. Genera también la paleta oscura, aunque decidamos en la fase 1 que no se implementa en el MVP: que quede preparada, no bloqueada.

**Fase 5 — Explora en el lienzo de Claude Design.** (Desde Claude Code: `/design`; en la web, el proyecto ya estará sincronizado.) Wireframes baratos primero para comparar estructuras; luego las 2–3 direcciones de identidad en paralelo (P1) para elegir una; luego la elegida, pantalla a pantalla: Mi equipo → ficha de mentee → Incidencias → Proyectos → Login, con copy exacto en español y el vocabulario de la sección 2. Itera con comentarios inline y controles directos del lienzo.

**Fase 6 — Implementación en código.** Si construimos pantallas en Claude Code, trabajará contigo `/designer-skills:frontend-design` (con su filosofía estética) y se activará solo el plugin oficial `frontend-design` (guardarraíles anti-estética-genérica). Ambos se someten a los tokens de la fase 4: **los tokens mandan** sobre cualquier estética que propongan.

**Fase 7 — Crítica.** `/designer-skills:design-review`: crítica estructurada contra el brief, por capturas cuando haya algo renderizado. Comprueba en especial: jerarquía del panel de atención, nombres accesibles en todo elemento interactivo (contrato de la sección 5.1), contraste y estados de UI (P4/P5).

Dos matices importantes:
- **No uses** `/designer-skills:brief-to-tasks`: el desglose en tareas lo haremos en el repo con su propio workflow (issues de GitHub + orquestador), no como checklist local.
- `/designer-skills:design-flow` puede encadenarte las fases 1–4 con confirmaciones entre pasos; este documento le sirve de contexto. Si algo del flow choca con este documento, gana el documento.

**Entregables finales** (todo en `.design/`, en español): sistema de **tokens como variables CSS**, **especificación por pantalla** (layout, jerarquía, estados, copy exacto) y **criterios de accesibilidad** por componente.

**Y recuerda**: esto acabará en un handoff a Claude Code para implementarlo sobre React + CSS plano; diseña pensando en que se pueda materializar sin heroísmos.
