# Componentes → clases CSS sugeridas

Todos consumen `tokens.css`. Nombres en BEM-ligero y español.

| Componente | Clase | Especificación |
|---|---|---|
| Botón primario | `.boton.boton--primario` | fondo `--color-primario`, texto `--color-texto-sobre-primario`, 14–15px/700, padding 12px 20px (13px 22px en cabecera de sección), radio `--radio-l`, sombra `--sombra-primario`; hover `--color-primario-hover` |
| Botón secundario | `.boton.boton--secundario` | fondo transparente, borde interior 1.5px `--color-borde-campo`, 14px/600, padding 11px 18px, radio `--radio-l` |
| Botón irreversible | `.boton.boton--atencion` | fondo `--color-atencion-texto`, texto blanco. Solo en confirmación de traspaso |
| Botón de éxito suave | `.boton.boton--exito` | fondo `--color-exito-badge`, texto `--color-exito-texto`, padding 8px 14px, radio `--radio-m` («Marcar cumplido» en Objetivos) |
| Enlace de acción | `.accion` | 14px/600 `--color-primario-texto`, sin subrayado; variante `.accion--tenue` con `--color-texto-secundario` (Retirar) |
| Tarjeta | `.tarjeta` | fondo `--color-superficie`, radio `--radio-xl`, padding 24px (18px compacta), sombra `--sombra-2` (`--sombra-1` compacta) |
| Tarjeta de atención | `.tarjeta--atencion` | fondo `--color-atencion-fondo`, sin sombra; título 13px/700 `--color-atencion-texto` |
| Tarjeta archivada | `.tarjeta--plana` | sin fondo, borde interior 1px `--color-borde`, radio 14px (cumplidos, resueltas, retirados) |
| Fila hundida | `.fila` | fondo `--color-superficie-hundida`, radio `--radio-m`, padding 10–11px 12–14px, 15px |
| Badge de estado | `.badge.badge--{en-curso|cumplido|no-cumplido|abierta|resuelta|atencion|propio|retirado}` | píldora, 13px/600 (12px en timeline), padding 4px 11px (2–3px 9–10px compacto); colores según mapeo al final de `tokens.css` |
| Chip de tema propio | `.chip` | `--color-primario-suave` / `--color-primario-texto`, 14px/600, padding 5px 12px, píldora |
| Filtro | `.filtro[aria-pressed]` | píldora 14px/600, padding 7px 14px; activo = primario sólido; inactivo = borde interior 1.5px |
| Campo | `.campo` (label envolvente) | etiqueta 14px/700 encima (gap 6px); input borde 1.5px `--color-borde-campo`, radio `--radio-m`, padding 10px 12px, 15px/400. Foco: borde `--foco-borde` + `--foco-anillo`. Error: borde `--color-error` + mensaje 13px/600 `--color-error` debajo |
| Checkbox de acuerdo | `.check` | 18×18, radio `--radio-s`, borde 2px oklch(0.75 0.03 310); marcado: fondo `--color-exito` con ✓ blanco |
| Avatar | `.avatar.avatar--{1..4}` | círculo con iniciales 700; 28px (cabecera, 11px), 38px (listas, 13px), 48–52px (ficha/perfil, 16–17px). Tono = hash del id mod 4 |
| Logo | `.logo` | cuadrado 28px radio 9px (44px/13px en login) fondo primario con «J» 800 blanca + «JTM» 800 18px |
| Nav lateral | `.nav-lateral a[aria-current=page]` | ítems 15px/500, padding 10px 12px, radio `--radio-l`; activo = fondo superficie + texto primario 700 + `--sombra-1`. Títulos de grupo 12px/700 secundario |
| Diálogo | `<dialog>.dialogo` | ancho 520–540px, fondo superficie, radio 20px, padding 28px, gap 14–16px, sombra `--sombra-3`, velo `--color-velo`. Título 21px/800. Acciones alineadas a la derecha: Cancelar (secundario) + acción con verbo explícito |
| Aviso | `.aviso.aviso--{exito|error}` | radio 10–14px, padding 10–12px 12–16px, 14px/600. Éxito: `--color-exito-badge`/`--color-exito-texto` con enlace subrayado. Error: `--color-error-fondo`/`--color-error` |
| Timeline | `.timeline` | grid `96px 28px 1fr`, row-gap 16px dentro de tarjeta; separador de mes 13px/700 primario-texto. Marcadores 12px: 1-to-1 = círculo primario; incidencia abierta = círculo `--color-atencion`; resuelta = círculo hueco borde 2px decorativo; cambio de proyecto = rombo `--color-exito`; traspaso = rombo hueco primario |
| Opción de apariencia | `.opcion-tema` (radio) | tarjeta seleccionable con miniatura 96px, radio 14px; seleccionada = borde interior 2px primario + fondo primario-suave 40% |
| Reordenar | `.boton-icono` | 30×30, radio 8px, borde interior 1.5px; ↑ / ↓ con `aria-label` |

## Añadidos en el paquete v2 (§10–§15)
| Componente | Clase | Especificación |
|---|---|---|
| Buscador | `.buscador` | input `max-width:480px`, fondo superficie, borde 1.5px `--color-borde-campo`, radio `--radio-m`, padding 10px 14px, 15px; foco como `.campo`. A su derecha (gap 14px) `.accion` «Borrar búsqueda» solo con texto |
| Coincidencia | `mark.coincidencia` | fondo `--color-primario-suave`, texto `--color-primario-texto`, 700, radio 4px, padding 0 3px |
| Fila de 1-to-1 | `.fila-1to1` | enlace-bloque; grid `132px minmax(0,1fr) 200px`, gap 24px, padding 12px 16px (14px en búsqueda), radio 12px; hover = fila de Mi equipo |
| Separador de año | `.lista__grupo` | 13px/700 `--color-primario-texto`, padding 12px 16px 6px (mismo estilo que el mes del timeline) |
| Botón deshabilitado con motivo | `.boton[aria-disabled=true]` + `.boton__motivo` | texto `--color-texto-decorativo`, borde interior 1.5px `--color-borde`, sin hover; motivo 13px secundario debajo, alineado con el botón, `max-width:220px` |
| Desplegable de cambios | `.disparador-cambios` | botón con aspecto de enlace 14px/600 primario-texto + « ▾» (« ▴» abierto) |
| Diff | `.diff` | `<del>` tachado `--color-texto-secundario` + `<ins>` sin subrayado color texto, uno bajo otro (gap 2px). Nunca rojo/verde |
| Lista de cambios | `.cambios` | `.tarjeta--plana` padding 18px 22px; por edición: cabecera 14px/700 + grid `200px minmax(0,1fr)` gap 6px 20px, 14px/1.5; ediciones separadas por borde 1px `--color-borde` |
| Selector de fecha | `.campo-fecha` | aspecto chip: fondo `--color-fondo`, borde 1.5px `--color-borde-campo`, radio 10px, padding 9px 12px, 15px/600, `align-self:flex-start`. Nativo `input type=date` estilizado; formato visible «22 sept 2026» |
| Chip-casilla | `.chip-casilla` | `input type=checkbox` + label píldora padding 6px 12px 14px/600, borde interior 1.5px `--color-borde-campo`; `:checked` → fondo `--color-primario-suave`, texto `--color-primario-texto`, borde interior 1.5px `--color-primario`, «✓ » delante. Grupo `flex-wrap`, gap 8px |
| Lista de proyectos | `.lista-proyectos` | `<ul>` sin viñetas, un nombre por línea, gap 2px, interlineado 1.35, orden alfabético (celda de Mi equipo) |
| Fila gestionable | `.fila.fila--gestion` | `.fila` padding 10px 14px: nombre 15px/600 + meta 13px secundario `nowrap` + acción a la derecha (`margin-left:auto`) — temas propios y proyectos en Ajustes de la mentee |
| Alta en línea | `.alta-en-linea` | fila gap 10px: input `flex:1` + botón primario padding 10px 16px |
| Diálogo con formulario | `<dialog>.dialogo.dialogo--formulario` | como `.dialogo`, gap 16px; subtítulo 15px secundario bajo el título (gap 4px); campos `.campo`; aviso de error encima de las acciones |
| Marcadores de timeline nuevos | `.timeline__marca--{editado|entra|sale}` | editado = círculo 12px hueco borde 2px `--color-primario`; entra = rombo 11px `--color-exito` (antes «cambio de proyecto»); sale = rombo 11px hueco borde 2px `--color-exito` |

No hacen falta tokens nuevos: todo sale de los existentes.

## Tipografía
Figtree (Google Fonts, 400–800). Títulos de página 36px/800 tracking −0.02em; título de sección de ficha 30px/800; título de tarjeta 17–18px/800; cuerpo 15px/400–600; meta 13px; etiquetas de grupo 12–13px/700. Interlineado cuerpo 1.5–1.55.

## Fechas
Relativas en listas y señales («hace 9 días», «hace 3 semanas»); exactas en detalle y timeline («20 sept», «12 sept 2026», «3 mar 2025» — año solo si no es el actual). Meses abreviados: ene, feb, mar, abr, may, jun, jul, ago, sept, oct, nov, dic. Tooltip (`title`/`<time datetime>`) con la fecha exacta en las relativas.
