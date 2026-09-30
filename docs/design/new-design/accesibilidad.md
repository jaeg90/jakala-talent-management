# Criterios de accesibilidad

Contrato con los E2E (Playwright: `getByRole`, `getByLabel`, regiones con `aria-label`). Objetivo WCAG 2.2 AA.

## Globales
- `<html lang="es">`. Estructura `header` / `nav` / `main`. Un solo `h1` por pantalla (título de página o de sección de ficha).
- Contraste: texto ≥ 4.5:1 (`--color-texto-secundario` cumple sobre fondo y superficie en ambos temas). `--color-texto-decorativo` solo para «—» y separadores con equivalente textual (`aria-label="ninguno"` o texto oculto).
- El color nunca es la única señal: «Necesita atención», badges y marcadores del timeline llevan texto.
- Foco visible en todo interactivo (`:focus-visible` → `--foco-anillo`). Orden de tabulación = orden visual.
- Objetivos táctiles ≥ 44px de alto en móvil (botones de reordenar 30px en escritorio → 44px en < 640px).
- `prefers-reduced-motion` respetado (tokens de duración a 0).
- Fechas en `<time datetime="2026-09-20">`.

## Por componente
| Componente | Criterio |
|---|---|
| Cabecera global | `<header>`; «Ajustes» y «Cerrar sesión» son `link`/`button` con ese nombre exacto |
| Tabla Mi equipo | `<table>` real con `<caption>` «Mi equipo» (visualmente oculto) y `<th scope="col">`. Cada fila navega vía enlace en el nombre de la mentee (nombre accesible = nombre). Badges con texto completo («1 incidencia abierta», «último 1-to-1 hace 3 semanas») vía texto oculto |
| Sidebar de mentee | `<nav aria-label="Secciones de Ana Alonso">`; activo con `aria-current="page"`; el punto de incidencias tiene texto oculto «(hay incidencias abiertas)» |
| Secciones de ficha | Cada bloque es `<section aria-label="…">`: «Para vuestro siguiente 1-to-1», «Acuerdos pendientes», «Temas propios», «Último 1-to-1», «Proyectos actuales», «Incidencias abiertas», «Objetivos en curso», «Objetivos cumplidos», «Objetivos no cumplidos», «Incidencias resueltas», «Historial», «Temas propios», «Proyectos», «Traspaso». **[v2]** «Proyecto actual» → «Proyectos actuales» (Resumen); «Cambio de proyecto» → «Proyectos» (Ajustes de la mentee) |
| Checkbox de acuerdo | `<input type="checkbox">` con label = texto del acuerdo. Una vez cumplido: `disabled` + estado anunciado («Cumplido»). En Registrar 1-to-1 el botón es «Marcar cumplido» con `aria-describedby` al texto del acuerdo |
| Campos | `<label>` envolvente (se conserva el patrón actual). Error: `aria-invalid="true"` + `aria-describedby` al mensaje. Requisitos de contraseña en lista vinculada con `aria-describedby` y actualizados en `aria-live="polite"` |
| Botones de acción repetidos | Nombre accesible desambiguado: «Marcar cumplido: Certificación Azure AZ-900», «Retirar tema: Formación en curso», «Retirar proyecto: Green Energy», «Resolver: Conflicto de prioridades…» (`aria-label` o texto oculto) |
| Reordenar temas | `button` «Subir ¿Qué tal el proyecto?» / «Bajar …»; tras mover, anunciar posición en `aria-live` y mantener el foco en el botón |
| Filtros del historial | `role="group" aria-label="Filtrar historial"`; cada filtro `button[aria-pressed]` |
| Timeline | `<ol>` con un `<li>` por evento; mes como encabezado (`h2`/`h3`); marcador decorativo `aria-hidden`; el tipo va en texto |
| Diálogos | `<dialog>` modal (`showModal`), `aria-labelledby` al título. Confirmaciones irreversibles con `role="alertdialog"` y `aria-describedby` al texto. Foco inicial en «Cancelar»; Esc cierra; foco vuelve al disparador |
| Avisos | Éxito `role="status"`; error de login y formularios `role="alert"` |
| Apariencia | `fieldset` + `legend` «Tema» con `input type="radio"`; miniaturas `aria-hidden` |
| Registrar 1-to-1 | Temas como `<textarea>` con label = pregunta. «Descartar» con confirmación si hay cambios. Aviso de salida con borrador sin guardar |
| Skeletons | Contenedor con `aria-busy="true"` y texto oculto «Cargando…»; nunca se anuncian las barras |

## Añadidos en el paquete v2 (§10–§15)
| Componente | Criterio |
|---|---|
| Mi equipo · celda Proyectos | `<ul aria-label="Proyectos de Carla Cano">` con un `<li>` por proyecto; sin proyecto, texto «Sin proyecto». Cabecera `<th>` «Proyectos» |
| Sidebar de mentee | Sin cambios de semántica; ya no incluye proyectos. En el Detalle de 1-to-1 `aria-current="page"` va en «1-to-1s» |
| Lista de 1-to-1s | `<section aria-label="1-to-1s">`; grupos por año con encabezado `h2` «2026» y `<ol>` de filas. Cada fila es un único `<a>` con nombre accesible completo: «1-to-1 del 20 sept, hace 9 días, 3 temas con nota, 2 acuerdos pendientes» (+ «, registrado por Diego Domínguez») |
| Buscador | `<search>` (o `role="search"`) con `input type="search"` y label «Buscar en los 1-to-1s de Ana» (visualmente oculto; placeholder no sustituye al label). Contador de resultados en `aria-live="polite"` («3 1-to-1s contienen «formación»» / «Ningún 1-to-1 contiene …»). «Borrar búsqueda» es `button`; tras borrar, foco al campo. Esc en el campo borra |
| Coincidencias | `<mark>` (se anuncia como resaltado). El «En «…»» forma parte del nombre accesible de la fila |
| Detalle de 1-to-1 | `h1` «1-to-1 del 20 sept»; tarjetas como `<section aria-label="Temas">`, `<section aria-label="Acuerdos">`. Cada tema: `h2` con la pregunta + párrafo. Acuerdos: checkbox con label = texto; «Marcar cumplido: Pedir acceso a la plataforma de formación» |
| «Editado el …» | `button` con `aria-expanded` y `aria-controls` → `<section id="cambios" aria-label="Cambios">`. Al abrir, foco al encabezado de la sección (`tabindex="-1"`) |
| Diff | `<del>` / `<ins>` con texto oculto «Antes: » / «Después: » (los lectores no siempre anuncian del/ins). Cada edición es un `<article>` con encabezado «22 sept, 10:14 · Marta Manager» |
| «Editar 1-to-1» no disponible | `button aria-disabled="true"` (no `disabled`, para que siga siendo enfocable) + `aria-describedby` al motivo. Pulsarlo no hace nada |
| Modo edición | `h1` cambia a «Editar 1-to-1 del 29 sept» y se anuncia (foco al `h1`). Textareas con label = pregunta; inputs de acuerdo con label «Acuerdo 1», «Acuerdo 2»…; «Quitar: {texto}». Acuerdos cumplidos: texto estático, no campo. Salir con cambios → `alertdialog` «¿Descartar los cambios?» (foco en «Seguir editando») |
| Diálogos con formulario (Registrar incidencia, Nuevo/Editar objetivo) | `<dialog>` modal, `aria-labelledby` al título y `aria-describedby` al subtítulo. Foco inicial en «Cancelar» (contrato del paquete); Esc cierra si no hay cambios, y si los hay pide descartar. Errores por campo con `aria-invalid` + `aria-describedby`; al enviar con errores, foco al primer campo inválido. Error de guardado en `role="alert"` |
| Selector de fecha | `input type="date"` con label visible («Fecha de apertura», «Fecha límite», «Fecha») y `max`/`min` según regla; ayuda vinculada con `aria-describedby` |
| Temas propios (Ajustes de la mentee) | `<section aria-label="Temas propios" id="temas-propios">`. Vigentes y retirados como `<ul>` con `aria-label` «Temas propios en uso» / «Temas propios retirados». Botones «Retirar tema: {nombre}» y «Volver a usar: {nombre}». Input con label «Nuevo tema propio». Alta, retirada y reactivación se anuncian en una región `aria-live="polite"` de la tarjeta: «Tema «…» añadido.» / «Tema «…» retirado.» / «Tema «…» vuelve a estar en uso.». Tras retirar, foco al siguiente «Retirar» o al input |
| Confirmación de retirada de tema | `alertdialog` «Retirar tema propio»; mismo componente desde §04 y §14; foco inicial en «Cancelar» |
| Proyectos (Ajustes de la mentee) | `<section aria-label="Proyectos">`; actuales en `<ul aria-label="Proyectos actuales">`; botones «Sacar del proyecto: Nexo Seguros». Alta: grupo con encabezado «Añadir a un proyecto» |
| Confirmación «Sacar del proyecto» | `alertdialog` con campos «Fecha» y «Motivo» dentro; foco inicial en «Cancelar»; el botón de acción queda `disabled` hasta que haya motivo y lo explica con `aria-describedby` («Escribe el motivo para continuar.», oculto) |
| Chips-casilla (Ajustes · Mentees) | `<fieldset>` + `<legend>` «Proyectos» con `input type="checkbox"` reales (label = nombre del proyecto); el ✓ es decorativo (`aria-hidden`) |
| Resumen · «Gestionar temas propios» | `link` con ese nombre exacto → `/mentees/:id/ajustes#temas-propios`; al llegar, foco en la sección |
