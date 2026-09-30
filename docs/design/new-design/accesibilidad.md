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
| Secciones de ficha | Cada bloque es `<section aria-label="…">`: «Para vuestro siguiente 1-to-1», «Acuerdos pendientes», «Temas propios», «Último 1-to-1», «Proyecto actual», «Incidencias abiertas», «Objetivos en curso», «Objetivos cumplidos», «Objetivos no cumplidos», «Incidencias resueltas», «Historial», «Cambio de proyecto», «Traspaso» |
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
