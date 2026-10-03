# Especificación por pantalla

Referencias visuales: `referencias/JTM Lino.dc.html` (§01–§09, id entre corchetes = ancla en el lienzo) y `referencias/JTM Lino huecos.dc.html` (§10–§15, anclas `4-10`…`4-15`). Capturas en `referencias/capturas/`. Datos de ejemplo = semilla ficticia (Marta Manager; Ana Alonso, Beatriz Blanco, Carla Cano). Hoy = 29 sept 2026. Valores → `tokens.css`; componentes → `componentes.md`.

> **Marcas [v2]**: ajustes a secciones ya existentes obligados por el segundo paquete (varios proyectos por mentee, temas propios fuera del 1-to-1, detalle de 1-to-1). Lo nuevo está en §10–§15. Resumen de cambios en `README.md`.

## Esqueletos de layout compartidos

**Cabecera global** (Mi equipo, Ajustes): alto `--alto-cabecera` (64px), padding horizontal 48px, sin borde ni fondo propio. Izquierda: logo. Derecha (gap 24px, 14px, texto secundario): «Ajustes» (primario-texto 700 si activa) · avatar 28px + «Marta Manager» · «Cerrar sesión».

**Ficha de mentee** (Resumen, 1-to-1s, Detalle de 1-to-1, Objetivos, Incidencias, Historial, Ajustes de la mentee): sin cabecera global. Sidebar `--ancho-sidebar` (236px), padding 24px 16px, gap 24px, sobre `--color-fondo`:
1. «← Mi equipo» (14px secundario).
2. Avatar 52px + nombre 19px/800 (margen superior 10px). **[v2] Sin proyectos bajo el nombre** (antes: proyecto actual). Los proyectos viven en Resumen → «Proyectos actuales».
3. Nav: Resumen · 1-to-1s · Objetivos · Incidencias (punto 8px `--color-atencion` a la derecha si hay abiertas) · Historial · [margen 8px] Ajustes de la mentee (texto secundario). El Detalle de 1-to-1 marca activo «1-to-1s».
4. Al pie (margin-top auto, 13px secundario): «Ajustes» · «Marta Manager · Cerrar sesión».

Contenido: `flex:1`, padding 32px 40px 32px 16px, gap 20–22px. Cabecera de sección: título 30px/800 a la izquierda (+ subtítulo 14px secundario opcional), botón primario a la derecha.

**Ajustes**: cabecera global + contenedor padding 16px 120px, gap 16px: «← Mi equipo» + h1 «Ajustes» 36px/800. Debajo, fila gap 40px: nav de ajustes 220px + columna de contenido `max-width: 640px`, gap 16px.
Nav de ajustes (grupos gap 18px; título de grupo 12px/700 secundario):
- **Mi cuenta**: Perfil y contraseña · Apariencia · Plantilla de 1-to-1
- **Personas**: Mentees · Managers
- **Catálogo**: Proyectos

**Proyectos de una mentee [v2]**: una mentee puede estar en 0..n proyectos. Siempre se listan **todos, en orden alfabético**. Sin ninguno → «Sin proyecto» (texto secundario).

---

## 01 · Login [2a-01]
- Fondo `--color-fondo`; tarjeta centrada de **420px de ancho total** (`box-sizing: border-box`: el padding 40px va dentro), radio `--radio-xxl` (20px), `--sombra-2`, gap 20px.
- Logo 44px («J» 20px) · h1 «JTM» 36px/800 · «Jakala Talent Management» 15px secundario.
- Campos «Email», «Contraseña» (type=password).
- Error (`role="alert"`, aviso error): **«Email o contraseña incorrectos. Revísalos e inténtalo de nuevo.»** Aparece entre campos y botón; el foco pasa a Contraseña.
- Botón primario ancho completo: **«Iniciar sesión»** (estado enviando: «Iniciando sesión…», deshabilitado).
- Pie 13px secundario centrado: «Solo para managers de Jakala.»
- Si la cuenta tiene contraseña temporal → tras entrar, redirigir a Perfil y contraseña con aviso «Cambia tu contraseña temporal para continuar.»

## 02 · Mi equipo — panel de atención [2a-02]
- Contenedor padding 32px 120px, gap 24px.
- Saludo «Hola, Marta» 15px secundario + h1 «Mi equipo» 36px/800. A la derecha, 14px secundario: «3 mentees · primero quien necesita atención».
- Tarjeta (padding 8px) con tabla. Columnas `2fr 1.4fr 1fr 1fr 1fr 1.3fr`: Mentee · **Proyectos [v2]** · Acuerdos · Incidencias · Objetivos · Último 1-to-1. Cabecera 13px/600 secundario, padding 12px 16px.
- Fila: padding 14px 16px, radio 12px, 15px, `align-items:center`. Mentee = avatar 38px + nombre 700. Hover: fondo `--color-superficie-hundida` + borde interior 1px `--color-borde`; toda la fila es clicable (enlace en el nombre).
- **Celda Proyectos [v2]**: lista `<ul>` sin viñetas, un proyecto por línea, orden alfabético, gap 2px, interlineado 1.35, sin elipsis. Con varios la fila crece en alto (3 proyectos ≈ 84px frente a ≈ 66px); el resto de celdas sigue centrado en vertical. Ejemplo: Carla Cano → «Aurora Health» / «Nexo Seguros» / «Portal Interno». Sin proyecto → «Sin proyecto» secundario.
- **Fila que necesita atención**: fondo `--color-atencion-fondo`; bajo el nombre «Necesita atención» 12px/600 `--color-atencion-texto`; Incidencias como badge «1 abierta» / «2 abiertas»; Último 1-to-1 como badge atención si > 14 días.
- Valores cero → «—» en `--color-texto-decorativo`. Sin 1-to-1 previo → badge atención «Sin 1-to-1s».
- Orden y criterio: ver `decisiones.md`.
- Vacío: «Aún no tienes mentees en tu equipo.» + botón «Añadir mentee» (→ /ajustes/mentees).

## 03 · Resumen [2a-03]
- Título «Resumen»; subtítulo «Vuestro último 1-to-1 fue hace 9 días» (sin 1-to-1s: «Aún no habéis tenido ningún 1-to-1»). Botón primario **«Registrar 1-to-1»**.
- Grid `1.6fr 1fr`, gap 16px.
- **Izquierda — tarjeta «Para vuestro siguiente 1-to-1»** (etiqueta 13px/700 primario-texto; gap 20px):
  - «Acuerdos pendientes · 2»: filas con checkbox + texto + «del 20 sept» (13px secundario, derecha). Marcar aquí también lo cumple. Vacío: «No hay acuerdos pendientes. Los que acordéis en el próximo 1-to-1 aparecerán aquí.»
  - «Temas propios» **[v2]**: fila título 700 a la izquierda + enlace **«Gestionar temas propios»** (14px/600 primario-texto, → `/mentees/:id/ajustes#temas-propios`) a la derecha. Chips de **solo lectura**. Vacío [v2]: «Sin temas propios. Añádelos en Ajustes de la mentee o al registrar un 1-to-1.» (el enlace se mantiene).
  - «Del último 1-to-1 · 20 sept»: cita de la primera nota no vacía, 15px, interlineado 1.55, color oklch(0.36 0.02 50), entre «». Enlace «Ver 1-to-1 completo» → §11 (`/mentees/:id/1-to-1s/:unoAUnoId`).
- **Derecha** (gap 14px), tarjetas compactas (padding 18px):
  - **«Proyectos actuales» [v2]** (13px secundario) → una fila por proyecto, orden alfabético, gap 10px: nombre 16px/700 + «desde mar 2025» 13px secundario. Vacío: «Sin proyectos. Añádela a uno en Ajustes de la mentee.»
  - Incidencias abiertas (tarjeta atención, solo si hay): «1 incidencia abierta» → descripción 15px → «hace 17 días».
  - «Objetivos en curso» → título 15px/600 + «hasta jun 2027» 13px. Vacío: «Sin objetivos en curso.» + acción «Nuevo objetivo» (abre el diálogo de §13 sobre Objetivos: navega a `/mentees/:id/objetivos?nuevo=1`).

## 04 · Registrar 1-to-1 [2a-04]
Pantalla completa, sin sidebar.
- Barra superior 72px, fondo superficie, `--sombra-1`, padding 0 40px, gap 20px: «← Ana Alonso» · «Nuevo 1-to-1» 19px/800 · selector de fecha (chip: fondo fondo, borde 1.5px, radio 10px, 14px/600, por defecto hoy, formato «29 sept 2026») · derecha: estado 13px secundario («Borrador sin guardar» / «Guardado») · «Descartar» (secundario) · **«Guardar 1-to-1»** (primario).
- Cuerpo grid `1fr 320px`. Columna principal padding 20px 56px, gap 14px, tres tarjetas (padding 20px 22px, etiqueta numerada 13px/700 primario-texto):
  1. **«1 · Repasa los acuerdos del último 1-to-1»**: filas; pendiente → checkbox + texto + acción «Marcar cumplido»; cumplido → check éxito + texto tachado secundario + badge «Cumplido». Si no hay acuerdos pendientes, la tarjeta no aparece.
  2. **«2 · Temas»**: por cada tema genérico (de la plantilla del manager, en su orden) y cada tema propio vigente: label = pregunta 15px/700 + textarea. Temas propios llevan chip «propio» y acción «Retirar tema» (13px/600 secundario). **[v2] «Retirar tema» abre la confirmación de §14** (mismo diálogo y copy); al confirmar, el tema desaparece del formulario y lo escrito en su textarea se pierde (el diálogo lo avisa si hay texto: añade «Lo que has escrito en este tema no se guardará.»). Al final «+ Añadir tema propio».
  3. **«3 · Acuerdos nuevos»**: input (placeholder «p. ej. Revisar la carga con el líder antes del 15 oct») + «Añadir acuerdo» (secundario). Los añadidos se listan encima como filas con acción «Quitar».
- Columna «Contexto de Ana» (padding 28px 24px, borde izquierdo 1px `--color-borde`, gap 16px): último 1-to-1 (fecha + cita) · objetivos en curso · incidencia abierta (tarjeta atención, radio 14px).
- Validación: al menos una nota o un acuerdo para guardar; si no, «Escribe al menos una nota o un acuerdo antes de guardar.» Fecha no futura. Puede haber varios 1-to-1s el mismo día.
- Tras guardar → Resumen con aviso de éxito «1-to-1 del 29 sept guardado.» **[v2]** Desde ese momento corre el plazo de edición de 7 días (§11).

## 05 · Objetivos [2a-05]
- Título «Objetivos»; botón **«Nuevo objetivo»** → diálogo §13.
- Grupos con etiqueta 13px/700 secundario y contador: «En curso · 2», «Cumplidos · 1», «No cumplidos · 0».
- En curso: tarjeta (padding 18px 22px), grid `1fr auto`: título 17px/700 · badge «En curso» / descripción 15px secundario · «hasta 30 jun 2027» 13px (si quedan ≤ 3 meses: «hasta 31 dic 2026 · quedan 3 meses» en `--color-atencion-texto` 600). Acciones (margen 10px): **«Marcar cumplido»** (éxito suave) · **«Marcar no cumplido»** (secundario) · «Editar» (enlace → diálogo §13 en modo edición).
- Marcar cumplido / no cumplido pide confirmación: «¿Marcar «…» como cumplido? No se puede reabrir.»
- Cumplidos / No cumplidos: tarjeta plana, título + badge «Cumplido · 15 may 2025» / «No cumplido · …». Sin «Editar».
- Grupo vacío: «Ningún objetivo cerrado sin cumplir.» / «Aún no hay objetivos cumplidos.» Sin objetivos: «Aún no hay objetivos para Ana. Define el primero para poder seguirlo en los 1-to-1s.» + «Nuevo objetivo».

## 06 · Incidencias [2a-06]
- Título «Incidencias»; botón **«Registrar incidencia»** → diálogo §12.
- «Abiertas · 1»: tarjeta atención (padding 18px 22px): badge «Abierta» + descripción 16px/700 / «Abierta el 12 sept 2026 · hace 17 días» 13px. Botón «Resolver» (fondo superficie, 700, `--sombra-1`).
- «Resueltas · 1»: tarjeta plana: badge «Resuelta» + título / «12 feb → 19 feb 2026 · «nota de resolución»» 14px secundario.
- **Diálogo «Resolver incidencia»**: título · descripción 15px secundario · campo «Nota de resolución (obligatoria)» textarea 96px · aviso 13px «Una incidencia resuelta no se puede reabrir; quedará en el historial.» · «Cancelar» + **«Resolver incidencia»** (deshabilitado mientras la nota esté vacía; enviando: «Resolviendo…»).
- Vacío: «Sin incidencias. Regístrala aquí si ocurre algo extraordinario (una baja, un conflicto, un retraso).»

## 07 · Historial [2a-07]
- Título «Historial». Filtros: Todo · 1-to-1s · Objetivos · Incidencias · Proyectos · Traspasos.
- Tarjeta con timeline (padding 22px 26px), agrupado por mes («Septiembre 2026», «Febrero 2026»; años anteriores agrupados por año: «2025»). Orden descendente.
- Tipos de evento (título 700 + detalle 14px secundario):
  - 1-to-1 → «3 temas · 2 acuerdos · «inicio de nota…»» (clic abre el detalle §11).
  - **[v2] 1-to-1 editado** (filtro «1-to-1s»; marcador círculo hueco borde 2px primario) → título «1-to-1 del 20 sept editado» / detalle con las partes tocadas separadas por « · »: «Notas de ¿Qué tal el proyecto? · 1 acuerdo añadido» (otras: «n acuerdos añadidos», «1 acuerdo reescrito», «1 acuerdo quitado», «Notas de {tema}»). Clic → detalle §11 con «Cambios» desplegado.
  - Incidencia + badge Abierta/Resuelta → descripción.
  - Objetivo cumplido / no cumplido → título del objetivo.
  - **[v2] «Entra en Atlas Bank»** (rombo `--color-exito`) / **«Sale de Green Energy»** (rombo hueco borde 2px `--color-exito`) → «Motivo: …». Filtro «Proyectos». Sustituye a «Cambio de proyecto · A → B».
  - «Traspaso · Diego Domínguez → Marta Manager» → «Historial heredado completo».
- Vacío con filtro: «No hay eventos de este tipo.»

## 08 · Ajustes de la mentee [2a-08] [v2]
- Título «Ajustes de la mentee». Columna gap 18px:
  1. **Tarjeta «Temas propios»** a ancho completo (ver §14). Ancla `#temas-propios`.
  2. Grid 2 columnas, gap 18px: **«Proyectos»** (ver §15; sustituye a «Cambio de proyecto») · **«Traspaso»**.
- Tarjetas padding 22px, título 18px/800.
- **Traspaso** (sin cambios): «El nuevo manager hereda el historial completo.» · «Nuevo manager» (select, excluye al actual) · «Fecha» · «Motivo» · «Traspasar…». Campos obligatorios. Confirmación (`alertdialog`): **«¿Traspasar a Ana Alonso a Diego Domínguez?»** / «Diego heredará su historial completo y Ana dejará de aparecer en tu equipo. No se puede deshacer.» / «Cancelar» + **«Traspasar a Diego Domínguez»** (botón atención). Tras confirmar → Mi equipo con aviso «Ana Alonso se ha traspasado a Diego Domínguez.»

## Ajustes · 3a Perfil y contraseña
- Tarjeta perfil (padding 22px 24px): avatar 48px + «Marta Manager» 17px/800 + «manager@jakala.example · 3 mentees en tu equipo».
- Tarjeta **«Cambiar contraseña»** / «Al guardarla, se cerrará la sesión en los demás navegadores.»: «Contraseña actual» · fila 2 columnas «Nueva contraseña» / «Repite la nueva contraseña» · requisitos 13px/600 en fila: «✓ Mínimo 10 caracteres» (cumplido: `--color-exito-texto`; pendiente: «○», secundario) · «Distinta de la actual» · botón **«Cambiar contraseña»**.
- Errores: «La contraseña actual no es correcta.» (en su campo) · «Las contraseñas no coinciden.» (en el segundo campo). Éxito: aviso «Contraseña cambiada.»

## Ajustes · 3e Apariencia
- Tarjeta «Apariencia» / «Solo cambia cómo ves JTM en este navegador.»
- Radiogroup de 3 opciones en fila (gap 12px): **Claro** «Lino» · **Oscuro** «Tueste» · **Según el sistema** «Sigue a tu ordenador» (por defecto; miniatura partida claro/oscuro). Aplica al instante (`data-tema` en `<html>`), sin botón guardar.

## Ajustes · 3d Plantilla de 1-to-1
- Tarjeta **«Tu plantilla de 1-to-1»** / «Los temas genéricos con los que empieza cada 1-to-1 con tus mentees. Es solo tuya: otros managers tienen la suya. Los cambios se aplican a partir del siguiente 1-to-1; los ya registrados no cambian.»
- Filas: número de orden (13px/700 secundario) · tema 15px/600 · ↑ ↓ · «Editar» · «Retirar» (tenue). Edición en línea (input + «Guardar» / «Cancelar»). Primer ↑ y último ↓ deshabilitados. No se puede retirar el último tema vigente («La plantilla necesita al menos un tema.»).
- Tarjeta **«Añadir tema genérico»** / «Formúlalo como pregunta abierta, igual que los demás.»: campo «Tema» (placeholder «p. ej. ¿Cómo va tu formación?») + **«Añadir tema»**. Se añade al final.
- «Retirados · 1»: tarjeta plana con el tema + «Volver a usar» (vuelve al final).
- Pie 13px: «Cada cuenta nueva de manager empieza con los tres temas iniciales.» + enlace «Restablecer plantilla inicial» (con confirmación: «¿Restablecer tu plantilla? Tus temas actuales pasarán a retirados.»).

## Ajustes · 3b Mentees
- Aviso éxito tras alta: «Hugo Herrera se ha añadido a tu equipo.» + «Abrir su ficha».
- Tarjeta **«Añadir mentee»** / «La mentee entra en tu equipo con el historial vacío. Si viene de otro manager, pídele un traspaso: así conserva su historial.»
- «Nombre y apellidos» (obligatorio, placeholder «p. ej. Irene Iglesias»).
- **[v2] «Proyectos»** a ancho completo: grupo de casillas con aspecto de chip (proyectos vigentes, orden alfabético, `flex-wrap`, gap 8px). Chip: píldora, padding 6px 12px, 14px/600, borde interior 1.5px `--color-borde-campo`; marcado: fondo `--color-primario-suave`, texto `--color-primario-texto`, borde interior 1.5px `--color-primario` y «✓ » delante del nombre. Ayuda 13px secundario: «Puedes marcar varios o ninguno («Sin proyecto»).» Por defecto ninguno.
- «En tu equipo desde» (fecha, por defecto hoy) · **«Añadir a mi equipo»** (enviando: «Añadiendo…»). Cada proyecto marcado genera un evento «Entra en {proyecto}» con fecha = «En tu equipo desde» y motivo «Alta en el equipo».

## Ajustes · 3c Managers
- Tarjeta lista (padding 8px): cabecera «Manager» / «Mentees»; filas con nombre 700 (+ «(tú)») y email 13px secundario; nº de mentees a la derecha.
- Tarjeta **«Crear cuenta de manager»** / «Empezará con el equipo vacío, la plantilla de 1-to-1 inicial y verá solo a sus mentees.»: fila «Nombre y apellidos» / «Email» · bloque hundido «Contraseña temporal» / «JTM genera una al crear la cuenta. Compártela por un canal seguro; tendrá que cambiarla al iniciar sesión.» · **«Crear cuenta»**.
- Error: «Ya existe una cuenta con este email.» · Email no válido: «Escribe un email válido.»
- Éxito: diálogo «Cuenta creada para Julia Jiménez» con la contraseña temporal en texto seleccionable + «Copiar contraseña» + «Hecho». Aviso: «No volverás a verla.»

## Ajustes · 3f Proyectos
- Tarjeta **«Proyectos vigentes · 6»** / **[v2]** «Aparecen al añadir una mentee a un proyecto. Solo se puede retirar un proyecto sin mentees.»: filas nombre 600 · nº de mentees con asignación vigente («1 mentee», «2 mentees», «Sin mentees»; una mentee en varios proyectos cuenta en cada uno) · acción «Retirar» solo si no tiene mentees; si tiene, texto 13px secundario «Tiene mentees». Debajo: campo «Nombre del proyecto» + **«Añadir proyecto»** (error si duplicado: «Ya existe un proyecto con ese nombre.»).
- «Retirados · 1»: fila plana con nombre + badge «Retirado · jun 2026» + «Volver a activar».
- Diálogo: **«¿Retirar Green Energy del catálogo?»** / **[v2]** «Dejará de aparecer al añadir mentees a un proyecto. Las entradas y salidas pasadas que lo mencionan se mantienen en el historial. Puedes volver a activarlo cuando quieras.» / «Cancelar» + **«Retirar proyecto»**.

---

## 10 · Lista de 1-to-1s [4-10, 4-10b] · `/mentees/:id/1-to-1s`
Capturas: `10-lista-1-to-1s.png`, `10b-lista-1-to-1s-busqueda.png`. Shell de ficha, «1-to-1s» activo.

**Qué la distingue del Historial (§07)**: solo 1-to-1s, más señal por fila (acuerdos pendientes/cumplidos hoy, nº de temas con nota, inicio de nota, autor si fue otro manager) y búsqueda en el texto. El Historial cuenta *qué pasó*; esta lista sirve para *encontrar y releer* un 1-to-1.

- Cabecera de sección: título «1-to-1s» 30px/800; subtítulo 14px secundario «32 1-to-1s · el último, hace 9 días» (1: «1 1-to-1 · hace 9 días»). Botón primario **«Registrar 1-to-1»** (→ §04).
- Contenido: columna gap 18px.
- **Buscador** (`.buscador`): `max-width:480px`, fondo superficie, borde 1.5px `--color-borde-campo`, radio `--radio-m`, padding 10px 14px, 15px; placeholder «Buscar en notas y acuerdos». Filtra **al escribir** (debounce 250ms, mínimo 2 caracteres, sin distinguir mayúsculas ni tildes). Con texto: a la derecha del campo (gap 14px) enlace **«Borrar búsqueda»** (14px/600 primario-texto); Esc también la borra.
- **Lista** (`.tarjeta` padding 8px). Agrupada por año, orden descendente: separador 13px/700 primario-texto, padding 12px 16px 6px: «2026 · 12», «2025 · 14», «2024 · 6». Lista completa, sin paginación.
- **Fila** (`.fila-1to1`, enlace a §11, toda clicable): grid `132px minmax(0,1fr) 200px`, gap 24px, padding 12px 16px, radio 12px, `align-items:center`. Hover como Mi equipo (fondo `--color-superficie-hundida` + borde interior 1px `--color-borde`).
  1. Fecha exacta 15px/700 (`<time>`; «20 sept», año solo si no es el actual: «18 nov 2024») + relativa 13px secundario («hace 9 días»).
  2. Inicio de la primera nota no vacía, 15px, color oklch(0.36 0.02 50), una línea con elipsis, entre «». Debajo, 13px secundario: «3 temas con nota» y, **solo si lo registró un manager distinto del actual**, « · Registrado por Diego Domínguez». Si no hay notas (solo acuerdos): «Sin notas» en lugar de la cita.
  3. Acuerdos (derecha, gap 6px, wrap): badge `.badge--en-curso` «2 pendientes» y/o badge `.badge--cumplido` «1 cumplido». Estado **al día de hoy**. Sin acuerdos: «—» decorativo.
- **Búsqueda activa (10b)**: bajo el buscador, contador `aria-live="polite"` 14px secundario «3 1-to-1s contienen «formación»». Desaparece el agrupado por año; filas por fecha descendente con `align-items:start`, padding 14px 16px. La columna 2 cambia a: dónde coincide 13px/600 secundario («En «¿Qué tal los objetivos?»» / «En un acuerdo»; si hay varias, la primera + « · y 2 más») · fragmento 15px interlineado 1.5 con ~60 caracteres de contexto a cada lado, «…» en los cortes y la coincidencia en `<mark>` (`--color-primario-suave` / `--color-primario-texto` 700, radio 4px, padding 0 3px) · meta 13px secundario («3 temas con nota» [+ « · Registrado por …»]).
- Sin coincidencias: en lugar de la lista, 15px secundario «Ningún 1-to-1 contiene «{texto}».» + enlace «Borrar búsqueda».
- **Estados P4**: cargando → skeleton de 6 filas de 64px en la tarjeta (el buscador visible pero deshabilitado); vacío (sin 1-to-1s): «Aún no habéis tenido ningún 1-to-1. Regístralo al terminar la conversación para seguir sus acuerdos.» + «Registrar 1-to-1»; error de carga: «No hemos podido cargar los 1-to-1s. Revisa tu conexión.» + «Reintentar». La búsqueda es en cliente si la lista completa ya está cargada (≤ ~100 1-to-1s por mentee); si no, en servidor con el mismo contrato.

## 11 · Detalle de 1-to-1 [4-11, 4-11b] · `/mentees/:id/1-to-1s/:unoAUnoId`
Capturas: `11-detalle-1-to-1.png` (lectura, fuera de plazo, cambios desplegados), `11b-detalle-1-to-1-edicion.png` (modo edición). Shell de ficha, «1-to-1s» activo. Contenido `max-width: 820px`, padding 28px 40px 32px 16px, gap 14px. Es la versión de lectura de §04: mismas etiquetas de tarjeta y mismo orden de temas; sin campos, sin columna de contexto.

### 11a · Lectura
- «← 1-to-1s» 14px secundario (→ §10).
- Cabecera (flex, `space-between`, gap 24px):
  - Izquierda: h1 **«1-to-1 del 20 sept»** 30px/800 (año si no es el actual: «1-to-1 del 18 nov 2024»). Debajo, fila meta 14px secundario (`flex-wrap:wrap`, gap 4px 10px, cada ítem `white-space:nowrap`, separador «·»): «Sábado 20 sept 2026» · «Registrado por Marta Manager» · [si se editó] botón-enlace **«Editado el 22 sept ▾»** (600 primario-texto; `aria-expanded`; ▾ gira a ▴ al abrir). Si hay varias ediciones: «Editado el 25 sept» (la última).
  - Derecha (`max-width:220px`, alineado a la derecha, gap 6px): botón secundario **«Editar 1-to-1»**. Si no se puede editar: deshabilitado (texto `--color-texto-decorativo`, borde interior 1.5px `--color-borde`) + explicación 13px secundario debajo:
    - fuera de plazo: «Solo se puede editar durante 7 días tras registrarlo.»
    - lo registró otro manager: «Solo puede editarlo quien lo registró.»
  - En plazo, bajo el botón habilitado, 13px secundario: «Puedes editarlo hasta el 6 oct.»
- **Tarjeta «Temas»** (`.tarjeta`, padding 20px 22px, gap 14px, etiqueta 13px/700 primario-texto): por cada tema **tal como se registró** (plantilla y temas propios vigentes en ese momento; retirar después un tema no lo quita de aquí): pregunta 15px/700 (+ chip «propio» 12px si lo es) y nota 15px interlineado 1.55 color oklch(0.36 0.02 50) con saltos de línea respetados. Tema sin nota: «Sin nota.» 14px secundario.
- **Tarjeta «Acuerdos · 2 pendientes»** (etiqueta cuenta pendientes; si todos cumplidos: «Acuerdos · todos cumplidos»): filas `.fila` como en Resumen: checkbox + texto + acción «Marcar cumplido» (14px/600 primario-texto). Cumplido: check éxito + texto tachado secundario + badge «Cumplido · 6 oct». Marcar cumplido **siempre** está disponible (no depende del plazo ni del autor) y no cuenta como edición. Sin acuerdos: «En este 1-to-1 no se acordó nada.»
- **Sección «Cambios»** (solo si hay ediciones; oculta hasta pulsar «Editado el …»; al abrir, el foco va a su título): `.tarjeta--plana` padding 18px 22px, gap 12px. Título 13px/700 secundario «Cambios · 1 edición» / «Cambios · 3 ediciones». Por edición, de la más reciente a la más antigua (gap 10px, separadas por borde superior 1px `--color-borde`): cabecera 14px/700 «22 sept, 10:14 · Marta Manager»; debajo grid `200px minmax(0,1fr)`, gap 6px 20px, 14px interlineado 1.5:
  - columna 1 (600 secundario): «Notas de ¿Qué tal el proyecto?» · «Acuerdo añadido» · «Acuerdo reescrito» · «Acuerdo quitado».
  - columna 2 (`.diff`): **antes** en `<del>` tachado `--color-texto-secundario`; **después** en `<ins>` sin subrayado, color texto, debajo. Añadido: solo después. Quitado: solo antes. Sin rojo/verde.
- P4: cargando → skeleton de cabecera + 2 tarjetas; error: «No hemos podido cargar este 1-to-1. Revisa tu conexión.» + «Reintentar»; id inexistente o de otra mentee → «Este 1-to-1 no existe o no es de Ana.» + enlace «Ver sus 1-to-1s».

### 11b · Modo edición (misma URL)
Se entra con «Editar 1-to-1». Solo quien lo registró y durante 7 días naturales desde `registradoEn` (ver `decisiones.md`).
- Cabecera: h1 **«Editar 1-to-1 del 29 sept»**; subtítulo 14px secundario «Puedes editarlo hasta el 6 oct. La fecha no se puede cambiar.». Derecha: «Cancelar» (secundario) + **«Guardar cambios»** (primario; enviando: «Guardando…»).
- Tarjeta «Temas»: cada tema como en §04 (label pregunta 15px/700 + textarea con la nota; chip «propio»). No se pueden añadir ni retirar temas.
- Tarjeta «Acuerdos»: pendientes como input editable (borde 1.5px `--color-borde-campo`, radio 10px, padding 10px 12px) + «Quitar» (13px/600 secundario); **cumplidos** como fila de solo lectura (check + tachado + badge «Cumplido · no editable»); al final input «p. ej. Revisar la carga con el líder antes del 15 oct» + «Añadir acuerdo» (secundario).
- Validación: igual que §04 (al menos una nota o un acuerdo). Sin cambios reales, «Guardar cambios» vuelve a lectura sin crear edición.
- Cancelar / navegar fuera con cambios → confirmación **«¿Descartar los cambios?»** / «Lo que has cambiado en este 1-to-1 no se guardará.» / «Seguir editando» + **«Descartar cambios»**. Sin cambios, Cancelar vuelve a lectura directamente.
- Si el plazo vence con el formulario abierto, el servidor rechaza: aviso error «El plazo de edición de este 1-to-1 terminó el 6 oct. No se han guardado los cambios.» (el formulario conserva lo escrito para poder copiarlo).
- Éxito → lectura con aviso `role="status"` «Cambios guardados en el 1-to-1 del 29 sept.» y la marca «Editado el …» actualizada.

## 12 · Diálogo «Registrar incidencia» (extiende §06) [4-12]
Captura: `12-registrar-incidencia.png`. `<dialog>.dialogo` 520px sobre Incidencias.
- Título **«Registrar incidencia»** 21px/800; subtítulo 15px secundario «Ana Alonso · algo extraordinario: una baja, un conflicto, un retraso.»
- **«Descripción»** (obligatoria): textarea min 96px, interlineado 1.5, placeholder «p. ej. Baja médica desde el lunes; vuelve previsiblemente el 6 oct». Máx. 500 caracteres.
- **«Fecha de apertura»**: selector de fecha con aspecto de chip (fondo `--color-fondo`, borde 1.5px, radio 10px, 15px/600, `align-self:flex-start`), por defecto hoy. Ayuda 13px secundario: «Por defecto, hoy. Si empezó antes, elige ese día.» No admite fechas futuras.
- Acciones: «Cancelar» + **«Registrar incidencia»** (primario; enviando «Registrando…»).
- Validación (al enviar; mensaje bajo el campo 13px/600 `--color-error`, borde `--color-error`): «Describe la incidencia.» · «La fecha no puede ser futura.»
- Error al guardar: aviso error encima de las acciones «No se ha podido guardar. Inténtalo de nuevo.»; el diálogo sigue abierto con lo escrito.
- Éxito: cierra, la incidencia aparece en «Abiertas» (orden por fecha de apertura descendente) con «Abierta el 22 sept 2026 · hace 7 días»; aviso `role="status"` «Incidencia registrada.»; aparece el punto terracota en el sidebar. La fecha que cuenta en Mi equipo y en el Historial es la de apertura.

## 13 · Diálogos «Nuevo objetivo» / «Editar objetivo» (extiende §05) [4-13, 4-13b]
Capturas: `13-nuevo-objetivo.png` (error de validación), `13b-editar-objetivo.png` (enviando). `<dialog>.dialogo` 520px sobre Objetivos.
- **Nuevo**: título **«Nuevo objetivo»**; subtítulo 15px secundario «Para Ana Alonso. Lo seguiréis en los 1-to-1s hasta que lo marques cumplido o no cumplido.» Acción **«Crear objetivo»** (enviando «Creando…»).
- **Editar** (solo desde un objetivo en curso): título **«Editar objetivo»**; subtítulo «Solo los objetivos en curso se pueden editar.»; campos precargados. Acción **«Guardar cambios»** (enviando «Guardando…»).
- Campos (gap 16px):
  - **«Título»** (obligatorio, máx. 120): input. Error: «Ponle un título al objetivo.»
  - **«Descripción (opcional)»**: textarea min 72px, interlineado 1.5, máx. 500.
  - **«Fecha límite»** (obligatoria): selector chip como §12, sin valor por defecto. Errores: «Elige una fecha límite.» · «La fecha límite no puede estar en el pasado.» (hoy se admite).
- Acciones: «Cancelar» + acción primaria. Error al guardar: como §12.
- Éxito: cierra; Nuevo → el objetivo entra en «En curso» (orden por fecha límite ascendente), aviso «Objetivo creado.»; Editar → la tarjeta se actualiza en su sitio y recalcula «hasta … · quedan n meses» (regla ≤ 3 meses de §05), aviso «Objetivo actualizado.» Editar no genera evento de Historial.
- Desde el Resumen («Nuevo objetivo» en el vacío de «Objetivos en curso») se navega a Objetivos con el diálogo abierto; al cerrar se queda en Objetivos.

## 14 · Temas propios en Ajustes de la mentee (extiende §08) [4-14, 4-14b]
Capturas: `14-temas-propios.png` (alta en línea con foco), `14b-retirar-tema-propio.png`.
- `.tarjeta` `role="region" aria-label="Temas propios"`, padding 22px, gap 14px, a ancho completo encima de Proyectos/Traspaso. Título «Temas propios» 18px/800; descripción 14px secundario: «Temas que tratas solo con Ana, además de tu plantilla. Aparecen en cada 1-to-1 hasta que los retires; retirarlos no cambia los 1-to-1s ya registrados.»
- Vigentes (gap 6px): `.fila` padding 10px 14px: nombre 15px/600 · «desde el 6 sept» 13px secundario · a la derecha «Retirar» (`.accion--tenue`, 13px/600). Orden de alta.
- Alta en línea (margen superior 4px, gap 10px): input a ancho completo (nombre accesible «Nuevo tema propio», placeholder «p. ej. ¿Cómo llevas el cambio de horario?», máx. 120) + **«Añadir tema»** (primario, padding 10px 16px). Enter también añade. Errores bajo el campo: «Escribe el tema.» · «Ana ya tiene un tema propio con ese nombre.» (comparando sin mayúsculas ni tildes; si coincide con uno retirado: «Ya lo tienes en retirados. Pulsa «Volver a usar».»). Tras añadir: el campo se vacía y conserva el foco; aviso `aria-live` «Tema «…» añadido.»
- «Retirados · n» (borde superior 1px `--color-borde`, padding-top 12px): por fila, 13px/700 secundario la etiqueta solo en la primera · nombre 15px secundario · «retirado el 14 jun» 13px · «Volver a usar» (`.accion`, derecha). Reactivar lo pone al final de vigentes; aviso `aria-live` «Tema «…» vuelve a estar en uso.» Sin retirados, el bloque no aparece.
- Vacío (sin vigentes ni retirados): 14px secundario «Sin temas propios. Añade uno para tratarlo en cada 1-to-1 con {nombre}.» encima del campo.
- **Confirmación de retirada** (`alertdialog`, 520px; mismo diálogo desde §04): **«¿Retirar el tema «Formación en curso»?»** / «Dejará de aparecer en los próximos 1-to-1s con Ana. Los 1-to-1s ya registrados no cambian. Puedes volver a usarlo cuando quieras.» / «Cancelar» + **«Retirar tema»** (primario; enviando «Retirando…»). Tras confirmar: pasa a retirados; aviso `aria-live` «Tema «…» retirado.»; el foco va al siguiente «Retirar» (o al campo de alta si no quedan).
- P4: error al guardar alta/retirada → aviso error dentro de la tarjeta «No se ha podido guardar. Inténtalo de nuevo.», se conserva lo escrito.

## 15 · Proyectos en Ajustes de la mentee (sustituye «Cambio de proyecto» en §08) [2a-08, 4-15]
Capturas: `08-ajustes-de-la-mentee.png` (Ana, 1 proyecto), `15-sacar-del-proyecto.png` (Carla, 3 proyectos + confirmación).
- `.tarjeta` `role="region" aria-label="Proyectos"`, padding 22px, gap 12px. Título «Proyectos» 18px/800; descripción 14px secundario «Puede estar en varios a la vez. Cada entrada y salida queda en su historial.»
- Actuales (orden alfabético, gap 6px): `.fila` padding 10px 14px: nombre 15px/600 · «desde mar 2025» 13px secundario `nowrap` · a la derecha **«Sacar del proyecto…»** (`.accion`, 13px/600). Sin ninguno: 14px secundario «Sin proyecto.»
- «Añadir a un proyecto» (13px/700 secundario, borde superior 1px `--color-borde`, padding-top 12px): «Proyecto» (select: vigentes en los que **no** está, orden alfabético; si no queda ninguno, select deshabilitado + «Ya está en todos los proyectos vigentes.») · «Fecha» (por defecto hoy, no futura) · «Motivo» (textarea 56px) · **«Añadir al proyecto…»** (secundario). Los tres obligatorios; errores: «Elige un proyecto.» · «La fecha no puede ser futura.» · «Escribe el motivo.»
- Confirmación de alta (`alertdialog`): **«¿Añadir a Ana Alonso a Retail Nova?»** / «Quedará registrado en su historial con la fecha y el motivo.» / «Cancelar» + **«Añadir a Retail Nova»** (primario). Éxito: aviso «Ana Alonso ahora también está en Retail Nova.»; evento «Entra en Retail Nova».
- Confirmación de salida (`alertdialog`, **con campos**): **«¿Sacar a Carla Cano de Nexo Seguros?»** / «Seguirá en Aurora Health · Portal Interno. Quedará registrado en su historial con la fecha y el motivo.» (si es el último: «Carla quedará sin proyecto. Quedará registrado en su historial con la fecha y el motivo.») · «Fecha» (chip, por defecto hoy; ni futura ni anterior a su entrada: «No puede ser anterior a su entrada en Nexo Seguros (16 jun 2026).») · «Motivo» (textarea 72px, obligatorio) · «Cancelar» + **«Sacar de Nexo Seguros»** (primario; deshabilitado mientras falte el motivo; enviando «Sacando…»). Éxito: aviso «Carla Cano ya no está en Nexo Seguros.»; evento «Sale de Nexo Seguros».
- No existe «mover de A a B»: son dos acciones y dos eventos.

---

## Estados (P4) — pautas para todas las pantallas
- **Cargando**: skeleton con la forma final (filas de 52px en Mi equipo, 64px en la lista de 1-to-1s, tarjetas en ficha) en `--color-superficie-hundida`, pulso de opacidad 1→0.6, `--duracion-media`×6, desactivado con reduced-motion. Mostrar solo si tarda > 300ms.
- **Vacío**: frase que explica + acción que lo resuelve (copys arriba). Nunca solo «Sin X.».
- **Error de carga**: aviso error en el lugar del contenido: «No hemos podido cargar {sección}. Revisa tu conexión.» + botón secundario «Reintentar».
- **Error al guardar**: el formulario (o diálogo) conserva lo escrito; aviso error encima del botón: «No se ha podido guardar. Inténtalo de nuevo.»
- **Enviando**: botón deshabilitado con gerundio («Guardando…», «Resolviendo…», «Registrando…», «Creando…», «Retirando…», «Sacando…», «Añadiendo…», «Creando cuenta…»).
