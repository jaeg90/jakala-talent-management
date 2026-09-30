# Especificación por pantalla

Referencia visual: `referencias/JTM Lino.dc.html` (id entre corchetes = ancla en el lienzo). Datos de ejemplo = semilla ficticia (Marta Manager; Ana Alonso, Beatriz Blanco, Carla Cano). Valores → `tokens.css`; componentes → `componentes.md`.

## Esqueletos de layout compartidos

**Cabecera global** (Mi equipo, Ajustes): alto `--alto-cabecera` (64px), padding horizontal 48px, sin borde ni fondo propio. Izquierda: logo. Derecha (gap 24px, 14px, texto secundario): «Ajustes» (primario-texto 700 si activa) · avatar 28px + «Marta Manager» · «Cerrar sesión».

**Ficha de mentee** (Resumen, Objetivos, Incidencias, Historial, Ajustes de la mentee): sin cabecera global. Sidebar `--ancho-sidebar` (236px), padding 24px 16px, gap 24px, sobre `--color-fondo`:
1. «← Mi equipo» (14px secundario).
2. Avatar 52px + nombre 19px/800 (margen superior 10px) + proyecto actual 14px secundario (o «Sin proyecto»).
3. Nav: Resumen · 1-to-1s · Objetivos · Incidencias (punto 8px `--color-atencion` a la derecha si hay abiertas) · Historial · [margen 8px] Ajustes de la mentee (texto secundario).
4. Al pie (margin-top auto, 13px secundario): «Ajustes» · «Marta Manager · Cerrar sesión».

Contenido: `flex:1`, padding 32px 40px 32px 16px, gap 20–22px. Cabecera de sección: título 30px/800 a la izquierda (+ subtítulo 14px secundario opcional), botón primario a la derecha.

**Ajustes**: cabecera global + contenedor padding 16px 120px, gap 16px: «← Mi equipo» + h1 «Ajustes» 36px/800. Debajo, fila gap 40px: nav de ajustes 220px + columna de contenido `max-width: 640px`, gap 16px.
Nav de ajustes (grupos gap 18px; título de grupo 12px/700 secundario):
- **Mi cuenta**: Perfil y contraseña · Apariencia · Plantilla de 1-to-1
- **Personas**: Mentees · Managers
- **Catálogo**: Proyectos

---

## 01 · Login [2a-01]
- Fondo `--color-fondo`; tarjeta centrada 420px, padding 40px, radio 20px, `--sombra-2`, gap 20px.
- Logo 44px («J» 20px) · h1 «JTM» 36px/800 · «Jakala Talent Management» 15px secundario.
- Campos «Email», «Contraseña» (type=password).
- Error (`role="alert"`, aviso error): **«Email o contraseña incorrectos. Revísalos e inténtalo de nuevo.»** Aparece entre campos y botón; el foco pasa a Contraseña.
- Botón primario ancho completo: **«Iniciar sesión»** (estado enviando: «Iniciando sesión…», deshabilitado).
- Pie 13px secundario centrado: «Solo para managers de Jakala.»
- Si la cuenta tiene contraseña temporal → tras entrar, redirigir a Perfil y contraseña con aviso «Cambia tu contraseña temporal para continuar.»

## 02 · Mi equipo — panel de atención [2a-02]
- Contenedor padding 32px 120px, gap 24px.
- Saludo «Hola, Marta» 15px secundario + h1 «Mi equipo» 36px/800. A la derecha, 14px secundario: «3 mentees · primero quien necesita atención».
- Tarjeta (padding 8px) con tabla. Columnas `2fr 1.4fr 1fr 1fr 1fr 1.3fr`: Mentee · Proyecto · Acuerdos · Incidencias · Objetivos · Último 1-to-1. Cabecera 13px/600 secundario, padding 12px 16px.
- Fila: padding 14px 16px, radio 12px, 15px. Mentee = avatar 38px + nombre 700. Hover: fondo `--color-superficie-hundida` + borde interior 1px `--color-borde`; toda la fila es clicable (enlace en el nombre).
- **Fila que necesita atención**: fondo `--color-atencion-fondo`; bajo el nombre «Necesita atención» 12px/600 `--color-atencion-texto`; Incidencias como badge «1 abierta» / «2 abiertas»; Último 1-to-1 como badge atención si > 14 días.
- Valores cero → «—» en `--color-texto-decorativo`. Sin 1-to-1 previo → badge atención «Sin 1-to-1s».
- Orden y criterio: ver `decisiones.md`.
- Vacío: «Aún no tienes mentees en tu equipo.» + botón «Añadir mentee» (→ /ajustes/mentees).

## 03 · Resumen [2a-03]
- Título «Resumen»; subtítulo «Vuestro último 1-to-1 fue hace 9 días» (sin 1-to-1s: «Aún no habéis tenido ningún 1-to-1»). Botón primario **«Registrar 1-to-1»**.
- Grid `1.6fr 1fr`, gap 16px.
- **Izquierda — tarjeta «Para vuestro siguiente 1-to-1»** (etiqueta 13px/700 primario-texto; gap 20px):
  - «Acuerdos pendientes · 2»: filas con checkbox + texto + «del 20 sept» (13px secundario, derecha). Marcar aquí también lo cumple. Vacío: «No hay acuerdos pendientes. Los que acordéis en el próximo 1-to-1 aparecerán aquí.»
  - «Temas propios»: chips. Vacío: «Sin temas propios. Puedes añadirlos al registrar un 1-to-1.»
  - «Del último 1-to-1 · 20 sept»: cita de la primera nota no vacía, 15px, interlineado 1.55, color oklch(0.36 0.02 50), entre «». Enlace «Ver 1-to-1 completo».
- **Derecha** (gap 14px), tarjetas compactas (padding 18px):
  - «Proyecto actual» → «Atlas Bank» 16px/700 → «desde marzo 2025».
  - Incidencias abiertas (tarjeta atención, solo si hay): «1 incidencia abierta» → descripción 15px → «hace 17 días».
  - «Objetivos en curso» → título 15px/600 + «hasta junio 2027» 13px. Vacío: «Sin objetivos en curso.» + acción «Nuevo objetivo».

## 04 · Registrar 1-to-1 [2a-04]
Pantalla completa, sin sidebar.
- Barra superior 72px, fondo superficie, `--sombra-1`, padding 0 40px, gap 20px: «← Ana Alonso» · «Nuevo 1-to-1» 19px/800 · selector de fecha (chip: fondo fondo, borde 1.5px, radio 10px, 14px/600, por defecto hoy, formato «29 sept 2026») · derecha: estado 13px secundario («Borrador sin guardar» / «Guardado») · «Descartar» (secundario) · **«Guardar 1-to-1»** (primario).
- Cuerpo grid `1fr 320px`. Columna principal padding 20px 56px, gap 14px, tres tarjetas (padding 20px 22px, etiqueta numerada 13px/700 primario-texto):
  1. **«1 · Repasa los acuerdos del último 1-to-1»**: filas; pendiente → checkbox + texto + acción «Marcar cumplido»; cumplido → check éxito + texto tachado secundario + badge «Cumplido». Si no hay acuerdos pendientes, la tarjeta no aparece.
  2. **«2 · Temas»**: por cada tema genérico (de la plantilla del manager, en su orden) y cada tema propio vigente: label = pregunta 15px/700 + textarea. Temas propios llevan chip «propio» y acción «Retirar tema» (13px/600 secundario). Al final «+ Añadir tema propio».
  3. **«3 · Acuerdos nuevos»**: input (placeholder «p. ej. Revisar la carga con el líder antes del 15 oct») + «Añadir acuerdo» (secundario). Los añadidos se listan encima como filas con acción «Quitar».
- Columna «Contexto de Ana» (padding 28px 24px, borde izquierdo 1px `--color-borde`, gap 16px): último 1-to-1 (fecha + cita) · objetivos en curso · incidencia abierta (tarjeta atención, radio 14px).
- Validación: al menos una nota o un acuerdo para guardar; si no, «Escribe al menos una nota o un acuerdo antes de guardar.» Fecha no futura.
- Tras guardar → Resumen con aviso de éxito «1-to-1 del 29 sept guardado.»

## 05 · Objetivos [2a-05]
- Título «Objetivos»; botón **«Nuevo objetivo»**.
- Grupos con etiqueta 13px/700 secundario y contador: «En curso · 2», «Cumplidos · 1», «No cumplidos · 0».
- En curso: tarjeta (padding 18px 22px), grid `1fr auto`: título 17px/700 · badge «En curso» / descripción 15px secundario · «hasta 30 jun 2027» 13px (si quedan ≤ 3 meses: «hasta 31 dic 2026 · quedan 3 meses» en `--color-atencion-texto` 600). Acciones (margen 10px): **«Marcar cumplido»** (éxito suave) · **«Marcar no cumplido»** (secundario) · «Editar» (enlace).
- Marcar cumplido / no cumplido pide confirmación: «¿Marcar «…» como cumplido? No se puede reabrir.»
- Cumplidos / No cumplidos: tarjeta plana, título + badge «Cumplido · 15 may 2025» / «No cumplido · …».
- Grupo vacío: «Ningún objetivo cerrado sin cumplir.» / «Aún no hay objetivos cumplidos.» Sin objetivos: «Aún no hay objetivos para Ana. Define el primero para poder seguirlo en los 1-to-1s.» + «Nuevo objetivo».

## 06 · Incidencias [2a-06]
- Título «Incidencias»; botón **«Registrar incidencia»**.
- «Abiertas · 1»: tarjeta atención (padding 18px 22px): badge «Abierta» + descripción 16px/700 / «Abierta el 12 sept 2026 · hace 17 días» 13px. Botón «Resolver» (fondo superficie, 700, `--sombra-1`).
- «Resueltas · 1»: tarjeta plana: badge «Resuelta» + título / «12 feb → 19 feb 2026 · «nota de resolución»» 14px secundario.
- **Diálogo «Resolver incidencia»**: título · descripción 15px secundario · campo «Nota de resolución (obligatoria)» textarea 96px · aviso 13px «Una incidencia resuelta no se puede reabrir; quedará en el historial.» · «Cancelar» + **«Resolver incidencia»** (deshabilitado mientras la nota esté vacía).
- Vacío: «Sin incidencias. Regístrala aquí si ocurre algo extraordinario (una baja, un conflicto, un retraso).»

## 07 · Historial [2a-07]
- Título «Historial». Filtros: Todo · 1-to-1s · Objetivos · Incidencias · Proyectos · Traspasos.
- Tarjeta con timeline (padding 22px 26px), agrupado por mes («Septiembre 2026», «Febrero 2026»; años anteriores agrupados por año: «2025»). Orden descendente.
- Tipos de evento (título 700 + detalle 14px secundario):
  - 1-to-1 → «3 temas · 2 acuerdos · «inicio de nota…»» (clic abre el detalle).
  - Incidencia + badge Abierta/Resuelta → descripción.
  - Objetivo cumplido / no cumplido → título del objetivo.
  - «Cambio de proyecto · Sin proyecto → Atlas Bank» → «Motivo: …».
  - «Traspaso · Diego Domínguez → Marta Manager» → «Historial heredado completo».
- Vacío con filtro: «No hay eventos de este tipo.»

## 08 · Ajustes de la mentee [2a-08]
- Título «Ajustes de la mentee». Grid 2 columnas, gap 18px, dos tarjetas (padding 22px, título 18px/800):
  - **Cambio de proyecto**: «Proyecto actual: Atlas Bank» · «Nuevo proyecto» (select con proyectos vigentes + «Sin proyecto», excluye el actual) · «Fecha» · «Motivo» (textarea 72px) · «Cambiar de proyecto…» (secundario).
  - **Traspaso**: «El nuevo manager hereda el historial completo.» · «Nuevo manager» (select, excluye al actual) · «Fecha» · «Motivo» · «Traspasar…».
- Todos los campos obligatorios. El botón abre confirmación (`alertdialog`):
  - Traspaso: **«¿Traspasar a Ana Alonso a Diego Domínguez?»** / «Diego heredará su historial completo y Ana dejará de aparecer en tu equipo. No se puede deshacer.» / «Cancelar» + **«Traspasar a Diego Domínguez»** (botón atención). Tras confirmar → Mi equipo con aviso «Ana Alonso se ha traspasado a Diego Domínguez.»
  - Cambio de proyecto: «¿Cambiar a Ana Alonso de Atlas Bank a Retail Nova?» / «Quedará registrado en su historial con la fecha y el motivo. No se puede deshacer.» / «Cancelar» + «Cambiar a Retail Nova» (primario).

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
- «Nombre y apellidos» (obligatorio, placeholder «p. ej. Irene Iglesias») · fila: «Proyecto actual» (select, por defecto «Sin proyecto») / «En tu equipo desde» (fecha, por defecto hoy) · **«Añadir a mi equipo»**.

## Ajustes · 3c Managers
- Tarjeta lista (padding 8px): cabecera «Manager» / «Mentees»; filas con nombre 700 (+ «(tú)») y email 13px secundario; nº de mentees a la derecha.
- Tarjeta **«Crear cuenta de manager»** / «Empezará con el equipo vacío, la plantilla de 1-to-1 inicial y verá solo a sus mentees.»: fila «Nombre y apellidos» / «Email» · bloque hundido «Contraseña temporal» / «JTM genera una al crear la cuenta. Compártela por un canal seguro; tendrá que cambiarla al iniciar sesión.» · **«Crear cuenta»**.
- Error: «Ya existe una cuenta con este email.» · Email no válido: «Escribe un email válido.»
- Éxito: diálogo «Cuenta creada para Julia Jiménez» con la contraseña temporal en texto seleccionable + «Copiar contraseña» + «Hecho». Aviso: «No volverás a verla.»

## Ajustes · 3f Proyectos
- Tarjeta **«Proyectos vigentes · 4»** / «Aparecen al registrar un cambio de proyecto. Solo se puede retirar un proyecto sin mentees.»: filas nombre 600 · nº de mentees («1 mentee», «2 mentees», «Sin mentees») · acción «Retirar» solo si no tiene mentees; si tiene, texto 13px secundario «Tiene mentees». Debajo: campo «Nombre del proyecto» + **«Añadir proyecto»** (error si duplicado: «Ya existe un proyecto con ese nombre.»).
- «Retirados · 1»: fila plana con nombre + badge «Retirado · jun 2026» + «Volver a activar».
- Diálogo: **«¿Retirar Green Energy del catálogo?»** / «Dejará de aparecer al registrar cambios de proyecto. Los cambios de proyecto pasados que lo mencionan se mantienen en el historial. Puedes volver a activarlo cuando quieras.» / «Cancelar» + **«Retirar proyecto»**.

---

## Estados (P4) — pautas para todas las pantallas
- **Cargando**: skeleton con la forma final (filas de 52px en Mi equipo, tarjetas en ficha) en `--color-superficie-hundida`, pulso de opacidad 1→0.6, `--duracion-media`×6, desactivado con reduced-motion. Mostrar solo si tarda > 300ms.
- **Vacío**: frase que explica + acción que lo resuelve (copys arriba). Nunca solo «Sin X.».
- **Error de carga**: aviso error en el lugar del contenido: «No hemos podido cargar {sección}. Revisa tu conexión.» + botón secundario «Reintentar».
- **Error al guardar**: el formulario conserva lo escrito; aviso error encima del botón: «No se ha podido guardar. Inténtalo de nuevo.»
- **Enviando**: botón deshabilitado con gerundio («Guardando…», «Resolviendo…», «Creando cuenta…»).
