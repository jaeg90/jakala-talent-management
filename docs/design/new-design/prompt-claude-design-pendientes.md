# Prompt para Claude Design — pantallas y formularios pendientes de Lino (issue #13)

> **Cómo usarlo**: Claude Design no conoce JTM por sí solo, y esta sesión además continúa un diseño ya cerrado. Prepara el primer mensaje así:
>
> 1. **Adjunta los cinco documentos del paquete Lino** de `docs/design/new-design/`: `decisiones.md`, `especificacion-pantallas.md`, `componentes.md`, `accesibilidad.md` y `tokens.css`. Son la fuente de verdad de lo existente; este prompt añade solo el encargo.
> 2. **Adjunta las capturas** de `docs/design/new-design/referencias/capturas/` (01–08, 09a–09f): son la referencia visual exacta de Lino tal y como está pintado.
> 3. **Conecta el código del repo**: en claude.ai/design con Import → GitHub (el repo de JTM); o desde Claude Code con `/design-sync`, para que los prototipos se construyan sobre tus componentes y estilos reales.
> 4. Pega este documento completo como primer mensaje.

---

Eres mi diseñador/a de producto. JTM ya tiene sistema de diseño —«Lino»— y 14 pantallas especificadas. **Esta no es una sesión de identidad: es una sesión de continuación.** El paquete dejó huecos señalados expresamente («crear issue de diseño, no inventar») y los vas a cerrar tú, dentro del lenguaje existente: sin proponer direcciones estéticas nuevas, sin retocar tokens que no lo necesiten, sin reabrir decisiones ya tomadas. Trabaja conmigo, no para mí: pregunta antes de asumir y dame opciones cuando haya decisiones de producto abiertas.

## 1. Qué es JTM (lo mínimo que necesitas)

JTM (Jakala Talent Management) es una herramienta web interna para que los managers de Jakala hagan el seguimiento de las personas de su equipo: 1-to-1s, cambios de proyecto, incidencias y objetivos. Es un Trabajo Fin de Máster; todos los datos son ficticios.

- **Un único rol**: el manager inicia sesión (email + contraseña) y solo ve a su equipo. Las mentees no inician sesión; son el dato, no usuarias.
- **La idea**: un lugar único y privado donde registrar y consultar el seguimiento de cada mentee. El historial pertenece a la persona: si hay traspaso de manager, el nuevo lo hereda completo.
- **Norte del diseño**: el momento crítico es *"¿dónde centro mi atención hoy y cómo preparo mi siguiente 1-to-1?"*. Esa pregunta se responde de un vistazo en la primera pantalla.
- **Tono**: herramienta de trabajo interna, densa y serena, sin espectacularidad. El manager vive aquí varias veces por semana.

## 2. Lino: lo que ya existe (y manda)

Identidad cerrada: **Figtree** 400–800 · tema claro «Lino» (fondo lino, acento Ciruela, atención Terracota, éxito Salvia, texto Café) y oscuro «Tueste» (derivado de los tokens) · **todo valor visual vive en `tokens.css` como variables CSS** · sin iconografía: los únicos glifos son ←, ↑, ↓, ✓, ▾ en texto.

Pantallas ya especificadas (secciones de `especificacion-pantallas.md`): 01 Login · 02 Mi equipo (panel de atención) · 03 Resumen · 04 Registrar 1-to-1 · 05 Objetivos · 06 Incidencias · 07 Historial · 08 Ajustes de la mentee · 09a–09f Ajustes (Perfil y contraseña, Apariencia, Plantilla de 1-to-1, Mentees, Managers, Proyectos).

La ficha de mentee es un **shell con sidebar** (Resumen · 1-to-1s · Objetivos · Incidencias · Historial · Ajustes de la mentee). Los huecos a diseñar viven, en principio, dentro de ese shell. Las URLs ya están asignadas en `decisiones.md` (react-router).

**Regla de oro**: ante cualquier duda de estilo, la respuesta está en el paquete (`tokens.css`, `componentes.md`, las secciones §01–§08). Agótalo antes de inventar; y si un patrón nuevo es inevitable, especifícalo para `componentes.md`.

## 3. El encargo: los huecos a cerrar

Son los «Huecos pendientes de diseño» de `decisiones.md`. Cada uno llega con preguntas de producto **abiertas**: ciérralas conmigo en la entrevista (fase 1) y quédalas por escrito.

### A. Lista de 1-to-1s — `/mentees/:id/1-to-1s`

La sección «1-to-1s» del sidebar, hoy sin diseño (en la app existe solo un componente puente provisional; tu diseño lo sustituye). Ancla el volumen real: con 1-to-1s quincenales, una mentee acumula ~26 al año.

- ¿Filtros? ¿Paginación o lista completa?
- Anatomía de fila: ¿fecha, nº de temas, nº de acuerdos, inicio de nota?
- Cuidado con la **diferencia con el Historial** (§07): allí los 1-to-1s ya aparecen como eventos del timeline. Esta lista debe justificarse por sí misma (probablemente: solo 1-to-1s, más detalle por fila, y entrada al detalle).

### B. Detalle de un 1-to-1 registrado — `/mentees/:id/1-to-1s/:fecha`

Llegan aquí dos enlaces que ya existen: «Ver 1-to-1 completo» (Resumen §03) y el clic en un 1-to-1 del Historial (§07).

- **¿Editable o solo lectura?** Si es editable, ¿qué se puede tocar (notas, acuerdos, fecha) y hasta cuándo? Cualquier edición es un cambio de dominio y hay que anotarlo. Si es solo lectura, se diseña como documento, sin edición «por si acaso».
- **¿Se direcciona por fecha o por id?** La tabla de URLs propone `:fecha`; ¿puede haber dos 1-to-1s el mismo día? Decide, y si manda el id, actualiza la tabla.
- Cómo se presentan las notas por tema y los acuerdos con su estado al día de hoy (¿se puede marcar un acuerdo cumplido desde aquí, como ya permite el Resumen?).
- Es la versión de lectura de «Registrar 1-to-1» (§04): que se note el parentesco, sin llegar a confundirse con el formulario. Pista de copy ya canónica: «1-to-1 del {fecha}» (así aparece en el aviso de guardado de §04).

### C. Formulario «Registrar incidencia» (pantalla Incidencias, §06)

El botón «Registrar incidencia» ya está especificado; su comportamiento, no.

- ¿Diálogo o pantalla? Precedentes: «Resolver incidencia» es un diálogo; «Registrar 1-to-1», pantalla completa por ser un documento. ¿Cuánto pesa este formulario?
- Campos del dominio: descripción y fecha. ¿La fecha es editable (p. ej. registrar hoy la baja de la semana pasada) o siempre es hoy?
- Copy de validación y estados P4.

### D. Formularios «Nuevo objetivo» / «Editar objetivo» (pantalla Objetivos, §05)

Se llega desde el botón «Nuevo objetivo» (en Objetivos y en el vacío de «Objetivos en curso» del Resumen §03) y desde el enlace «Editar» (solo en objetivos en curso, regla de dominio).

- ¿Diálogo o pantalla?
- Campos del dominio: título, descripción, fecha límite. Validaciones y su copy. Al editar: qué se permite tocar y cómo queda la fila («hasta … · quedan n meses», §05).
- La edición nunca llega a objetivos cerrados: no diseñes edición de cumplidos/no cumplidos.

### E. Tema propio: alta y retirada desde la ficha

El patrón «+ Añadir tema propio» ya existe dentro de Registrar 1-to-1 (§04) y los chips de temas propios viven en el Resumen (§03). Falta poder gestionarlos **fuera** del formulario.

- ¿Dónde vive la acción en la ficha? (¿junto a los chips del Resumen? ¿en la sección de 1-to-1s?)
- ¿Diálogo o edición en línea? ¿La retirada pide confirmación? Hoy «Retirar tema» (§04) no la pide: decide con criterio y sé coherente.
- Regla de dominio inquebrantable: un tema propio retirado no altera los 1-to-1s ya registrados; persiste hasta que se retira.

### Pregunta transversal a C/D/E

¿Diálogo o pantalla completa? Explícame el criterio (peso del formulario, frecuencia de uso, precedentes del paquete) y aplícalo con consistencia. Los tres heredan los estados P4 del paquete (§ Estados): error al guardar conservando lo escrito, botón en gerundio al enviar, etc.

## 4. Datos de ejemplo (ficticios, coherentes con lo ya pintado)

Las capturas existentes usan la semilla: **Marta Manager** y su equipo — **Ana Alonso** (Atlas Bank), **Beatriz Blanco** (Retail Nova), **Carla Cano** (Aurora Health). Lo ya pintado de Ana: último 1-to-1 «20 sept» («Vuestro último 1-to-1 fue hace 9 días»), acuerdos pendientes «del 20 sept» («Pedir acceso a la plataforma de formación», «Hablar con el líder de Atlas Bank sobre su carga»), incidencia «Abierta el 12 sept 2026 · hace 17 días», objetivo «hasta 30 jun 2027», temas genéricos «¿Cómo estás?», «¿Qué tal el proyecto?», «¿Qué tal los objetivos?».

Para la lista y el detalle necesitas **historia**: inventa 1-to-1s previos verosímiles (p. ej. cadencia quincenal desde primavera de 2026), con notas por tema breves, en primera persona y tono de conversación real de trabajo, y acuerdos hoy pendientes o cumplidos. La cronología debe cuadrar con lo ya pintado: el 20 sept es el último 1-to-1 de Ana.

Formatos de fecha del paquete: relativas en listas y señales («hace 3 semanas»), exactas en detalle y timeline («20 sept», «12 sept 2026» — año solo si no es el actual), `<time datetime>` en el HTML.

## 5. Contratos que el diseño debe respetar

1. **Los tokens mandan.** Todo valor visual sale de `tokens.css`; si falta uno, se añade ahí (y se lista como entrega). Nunca hex/oklch sueltos ni estilos genéricos del lienzo.
2. **Copy exacto en español.** Los botones dicen lo que hacen («Marcar cumplido», no «OK») y un mismo concepto se llama igual en toda la herramienta. Vocabulario canónico de `CONTEXT.md`:

   | Término | Nunca digas |
   |---|---|
   | Manager | jefe, supervisor, usuario |
   | Mentee | colaborador, mentorizado, empleado, talento |
   | Equipo | plantilla, staff |
   | Traspaso | transferencia, reasignación |
   | 1-to-1 | reunión individual, catch-up |
   | Tema (genérico / propio) | campo, pregunta |
   | Acuerdo | tarea, action item |
   | Proyecto | cuenta, cliente |
   | Cambio de proyecto | movimiento, rotación |
   | Incidencia | problema, issue, alerta |
   | Objetivo | meta, KPI |

3. **La semántica accesible es contrato de tests E2E.** `accesibilidad.md` es la vara: cada interactivo con nombre accesible, secciones como `region` con `aria-label`, diálogos `<dialog>` con foco inicial en «Cancelar», Esc cierra y el foco vuelve al disparador, botones repetidos desambiguados («Retirar tema: Formación en curso»). Lo que diseñes, los tests de Playwright lo localizarán por rol y label.
4. **Estados P4 obligatorios** en cada pantalla y formulario (§ Estados): skeleton si tarda > 300ms, vacío con invitación a actuar, error de carga con «Reintentar», error al guardar conservando lo escrito, envío en gerundio.
5. **Alcance funcional cerrado.** Nada de lo marcado «exploración futura» en `decisiones.md`; nada de notificaciones, exportaciones, roles/permisos. Si algo se te antoja fuera, dilo y márcalo «exploración futura», separado del diseño implementable.
6. **Herramienta interna, no landing.** Densidad de trabajo, escaneo rápido, calma. Sin iconos ni imágenes: solo los glifos ←, ↑, ↓, ✓, ▾. Si crees que hace falta una dependencia nueva, propónla explícitamente con justificación; partimos de que no.

## 6. Cómo quiero trabajar contigo: skills y momentos

Tienes instaladas las skills de `designer-skills` y el plugin `frontend-design`, además del lienzo de Claude Design. Todos los documentos que generes van en español (identificadores de skills y comandos, en inglés); los documentos de trabajo pueden ir en `.design/`, pero los entregables finales llevan el formato del paquete (§7).

**Fase 0 — Sincroniza.** `/design-sync` (o Import → GitHub en la web). Los prototipos se montan sobre `tokens.css` y los componentes reales del paquete, no sobre estilos genéricos.

**Fase 1 — Entrevístame.** `/designer-skills:grill-me`. Este documento y el paquete son tu punto de partida: no me re-preguntes lo que ya responden; cierra conmigo solo las preguntas abiertas de §3 (y las que vayas descubriendo). No generes un brief aparte: las respuestas se consolidan como entradas nuevas de `decisiones.md`.

**Fase 2 — Diseña en el lienzo.** `/design`. **Directo a hi-fi en Lino**: la identidad está cerrada, no se exploran direcciones. Única excepción: si para la lista de 1-to-1s ves dos estructuras serias que valgan, compáralas antes en wireframe barato. Orden sugerido: lista → detalle → formularios (incidencia → objetivo → tema propio). Copy exacto en español desde el primer prototipo; itera con comentarios inline y controles del lienzo.

**Fase 3 — Crítica.** `/designer-skills:design-review`, por captura. Comprueba en especial: ¿esto se siente Lino? (coherencia con componentes y patrones existentes); jerarquía y escaneo de la lista; distinción lista ↔ Historial y detalle ↔ formulario; accesibilidad (nombres accesibles, foco, contraste); estados P4 completos; copy exacto y vocabulario canónico.

**Fase 4 — Entrega en formato de paquete.** El entregable no son pantallas sueltas: son extensiones de los ficheros existentes, listas para integrarse in situ (§7). Aquí no se codea la app: los prototipos del lienzo son referencias; si exportas HTML, sigue el patrón de `referencias/` (estilos inline + `support.js`), nunca código React.

**Skills que NO uses** (y por qué):

- `/designer-skills:design-brief`: el paquete ya es el brief; las decisiones van a `decisiones.md`.
- `/designer-skills:design-tokens`: el sistema existe; solo se amplía puntualmente si falta un token.
- `/designer-skills:information-architecture`: la IA ya está decidida (URLs en `decisiones.md`); solo queda la pregunta fecha-vs-id del detalle, que se cierra en la entrevista.
- `/designer-skills:brief-to-tasks`: los tickets ya existen en el repo (#21, #22, #30, #31, #32) y esperan este diseño; no generes checklists de tareas.
- `/designer-skills:frontend-design` y el plugin `frontend-design`: solo aplican escribiendo código de la app, y en esta sesión no se escribe.
- `/designer-skills:design-flow` puede encadenar fases; si algo choca con este documento, gana el documento.

## 7. Entregables finales (formato paquete, para volver al repo)

El resultado vuelve a mi repo, donde se integra **in situ** en `docs/design/new-design/` (nunca una carpeta paralela). Si esta sesión corre en Claude Code con acceso de escritura, aplica tú mismo los cambios en el paquete; si corre en el lienzo web, entrega los documentos listos para pegar. En ambos casos, el formato es este:

1. **`especificacion-pantallas.md`** — secciones nuevas gemelas de las §01–§08 (mismo formato y nivel de detalle: layout con grids/paddings/gaps, tamaños y pesos tipográficos, componentes por su clase de `componentes.md`, estados P4 y todo el copy entrecomillado tal y como debe verse). Una sección por pieza; si un formulario se resuelve como diálogo de una pantalla ya especificada, extiende esa sección (como hace §06 con «Resolver incidencia»).
2. **`decisiones.md`** — entradas nuevas que cierren los huecos: decisiones de producto (en «Decisiones de producto confirmadas»), ajustes de la tabla de URLs si cambia el `:fecha`, y cambios de dominio si algo los implica (p. ej. un 1-to-1 editable). La sección «Huecos pendientes de diseño» queda reducida a lo que siga abierto, o eliminada si ya no queda nada.
3. **Ajustes puntuales a secciones existentes**, si el nuevo diseño los obliga, claramente separados de lo nuevo. Ejemplo real: si el alta de tema propio llega a la ficha, el vacío del Resumen («Sin temas propios. Puedes añadirlos al registrar un 1-to-1.») puede quedar desfasado y necesitar otro copy.
4. **Capturas 1280×800 en claro**, numeración correlativa a partir de 10, nombres kebab-case coherentes con los existentes (p. ej. `10-lista-1-to-1s.png`, `11-detalle-1-to-1.png`, `12-registrar-incidencia.png`, `13-nuevo-objetivo.png`…), cada una con su contexto real: shell de ficha o pantalla completa según dónde viva la pieza, y los diálogos sobre su pantalla. Oscuro solo si el diseño lo pide; el resto se deriva de los tokens.
5. **`componentes.md` / `accesibilidad.md`** — solo si aparecen componentes o criterios nuevos (p. ej. un patrón de formulario, o cómo se anuncian en `aria-live` el alta y la retirada de temas propios).
6. **`README.md`** — el índice actualizado con las capturas nuevas.
7. **Prototipos exportados** (si el lienzo lo permite) como HTML de referencia en el formato de `referencias/`, para añadirse a los existentes o como fichero nuevo siguiendo su nomenclatura.

**Y recuerda**: esto vuelve al repo, donde agentes de código con contexto fresco implementarán los tickets bloqueados (#21 Objetivos, #22 Incidencias, #30 Lista de 1-to-1s, #31 Detalle, #32 Temas propios) leyendo **solo el paquete**; esta conversación no les llega. Nada de «como hablamos»: cada decisión, medida, estado y copy tiene que estar escrito. Diseña pensando en que se materialice en React 19 + CSS plano con variables CSS, sin heroísmos y sin que nadie tenga que inventar nada por el camino.
