# Decisiones, alcance y cambios de dominio

## Arquitectura de la información (estructura A)
- **Sin navegación global.** Entrada: *Mi equipo* (panel de atención). Cabecera global: logo JTM · Ajustes · avatar + nombre del manager · Cerrar sesión.
- **Cada mentee es autocontenida.** Al abrir una mentee aparece un **sidebar** propio con sus secciones: Resumen · 1-to-1s · Objetivos · Incidencias · Historial · (separado) Ajustes de la mentee. Punto terracota junto a «Incidencias» si hay abiertas.
- **Eliminada** la pantalla global «Incidencias abiertas»: la señal vive en Mi equipo y en cada ficha.
- **Eliminada** la pantalla global «Proyectos / quién está en cada proyecto»: el catálogo pasa a Ajustes → Proyectos (con nº de mentees por proyecto).
- **Registrar 1-to-1** es pantalla completa (documento), acción primaria en Resumen.
- Acciones irreversibles (cambio de proyecto, traspaso) en *Ajustes de la mentee*, siempre con diálogo de confirmación.

## URLs propuestas (requiere router)
| URL | Pantalla |
|---|---|
| `/login` | Login |
| `/equipo` | Mi equipo (inicio tras login) |
| `/mentees/:id` | Resumen |
| `/mentees/:id/1-to-1s` | Lista de 1-to-1s *(pendiente de diseño, ver huecos)* |
| `/mentees/:id/1-to-1s/nuevo` | Registrar 1-to-1 |
| `/mentees/:id/1-to-1s/:unoAUnoId` | Detalle de 1-to-1 (se direcciona por id: puede haber varios el mismo día). En plazo de edición, el modo edición vive en la misma URL (sin ruta propia) |
| `/mentees/:id/objetivos` | Objetivos |
| `/mentees/:id/incidencias` | Incidencias |
| `/mentees/:id/historial` | Historial (`?tipo=1-to-1s|objetivos|incidencias|proyectos|traspasos`) |
| `/mentees/:id/ajustes` | Ajustes de la mentee |
| `/ajustes/perfil` | Perfil y contraseña |
| `/ajustes/apariencia` | Apariencia |
| `/ajustes/plantilla` | Plantilla de 1-to-1 |
| `/ajustes/mentees` | Añadir mentee |
| `/ajustes/managers` | Managers + crear cuenta |
| `/ajustes/proyectos` | Catálogo de proyectos |

`/ajustes` redirige a `/ajustes/perfil`. Ruta desconocida → `/equipo`.

## Decisiones de producto confirmadas
- **Mi equipo** ordena primero a quien necesita atención. «Necesita atención» = alguna incidencia abierta **o** último 1-to-1 hace más de 14 días. Desempate: más acuerdos pendientes, luego nombre.
- Señales por mentee: acuerdos pendientes (nº), incidencias abiertas (badge), objetivos en curso (nº), antigüedad del último 1-to-1 (badge terracota si > 14 días). «—» = ninguno. **No se muestran**: objetivos cumplidos/no cumplidos, temas propios, histórico de proyectos.
- **Crear cuentas de manager:** en el MVP cualquier manager puede. Roles = exploración futura.
- **Plantilla de 1-to-1 por manager:** cada manager tiene su propia lista de temas genéricos. Cuenta nueva → los 3 temas iniciales («¿Cómo estás?», «¿Qué tal el proyecto?», «¿Qué tal los objetivos?»). Editar la plantilla solo afecta a los siguientes 1-to-1s de ese manager; los registrados no cambian. Tras un traspaso, la mentee usa la plantilla del nuevo manager.
- **Proyectos retirables:** solo si no tienen mentees actualmente. Retirado → no aparece en selectores; el historial se conserva; se puede **volver a activar**.
- **Apariencia:** Claro / Oscuro / Según el sistema (por defecto). Preferencia local del navegador (`localStorage`), no se guarda en servidor.
- **Añadir mentee:** entra con historial vacío. Si viene de otro manager se debe usar Traspaso (el copy lo indica).
- **Cambiar contraseña:** requiere la actual; nueva ≥ 10 caracteres y distinta de la actual; al guardar se invalidan las demás sesiones.
- **Lista de 1-to-1s** (`/mentees/:id/1-to-1s`): lista completa, sin paginación (~26/año), agrupada por año, orden descendente. Búsqueda por texto en notas y acuerdos: filtra al escribir, resalta las coincidencias y muestra el fragmento que coincide. Fila: fecha exacta + relativa · nº de temas con nota · acuerdos «n pendientes · n cumplidos» · inicio de la primera nota · «Registrado por {manager}» solo si no es el manager actual (heredado por traspaso). Estructura: **lista a ancho completo** (wireframe 1a); maestro-detalle descartado (detalle estrecho en 1280px, filas sin espacio para las señales, dos formas de ver el mismo detalle).
- **Detalle de 1-to-1**: editable **solo por el manager que lo registró** y **durante 7 días naturales desde el momento del registro**. Se pueden editar notas y acuerdos pendientes (añadir, reescribir, quitar); los acuerdos ya cumplidos y la fecha no. Salir del modo edición con cambios sin guardar pide confirmación («¿Descartar los cambios?»). Botón «Editar 1-to-1» → el detalle pasa a modo formulario en la misma URL («Guardar cambios» / «Cancelar»). Fuera de plazo o si lo registró otro manager, el botón aparece deshabilitado con la explicación. Marcar un acuerdo cumplido se permite siempre (igual que en Resumen), no cuenta como edición.
- **Ediciones visibles**: un 1-to-1 editado muestra «Editado el {fecha}» en su cabecera; al activarlo se despliega al pie la sección «Cambios» con cada edición (fecha, autor) y, por parte tocada, el texto anterior tachado en secundario y el nuevo debajo (sin rojo/verde). Cada edición es un evento del Historial dentro del filtro «1-to-1s»: «1-to-1 del 20 sept editado» → «Notas de ¿Qué tal el proyecto? · 1 acuerdo añadido».
- **Criterio diálogo vs. pantalla**: diálogo para formularios de ≤ 3 campos y uso ocasional (Registrar incidencia, Nuevo/Editar objetivo); en línea para altas de un solo campo (tema propio); pantalla completa solo para documentos (Registrar 1-to-1).
- **Registrar incidencia**: descripción + fecha de apertura; la fecha es editable, por defecto hoy, nunca futura.
- **Nuevo / Editar objetivo**: título (obligatorio), descripción (opcional), fecha límite (obligatoria). Al editar se pueden tocar los tres; la fecha límite no puede quedar en el pasado (≥ hoy), también al crear. Solo objetivos en curso son editables.
- **Temas propios fuera del 1-to-1**: se gestionan en **Ajustes de la mentee**, tarjeta «Temas propios» a ancho completo encima de Proyectos y Traspaso. Alta en línea; retirada **con diálogo de confirmación** (también en Registrar 1-to-1 §04, que antes no la pedía); los retirados se listan con «Volver a usar». Los chips del Resumen quedan de solo lectura con enlace «Gestionar temas propios». Retirar un tema propio no altera los 1-to-1s registrados.
- **Varios proyectos a la vez** (sin límite; también ninguno = «Sin proyecto»). De cada asignación solo se guarda proyecto, fecha de entrada/salida y motivo; no hay dedicación ni proyecto principal. Se muestran **todos los nombres, en orden alfabético** (en línea, separados por « · », solo en textos corridos como los diálogos): en Mi equipo (columna «Proyectos») uno debajo de otro (lista), sin elipsis, y la fila crece en alto; el sidebar de la ficha muestra **solo el nombre** (sin proyectos, para todas las mentees; cambia §Ficha de mentee); en Resumen, tarjeta «Proyectos actuales» con una fila por proyecto (nombre + «desde …»). «Cambio de proyecto» desaparece: en Ajustes de la mentee, tarjeta «Proyectos» con los actuales (cada uno con «Sacar del proyecto…») y alta debajo (proyecto + fecha + motivo + «Añadir al proyecto…»); ambas con confirmación; sacar pide fecha y motivo en el propio diálogo. Se puede sacar del último (queda «Sin proyecto»). No hay «mover de A a B»: son dos pasos y dos eventos. Historial (filtro «Proyectos»): «Entra en {proyecto}» / «Sale de {proyecto}» + «Motivo: …». Al añadir una mentee se pueden elegir varios proyectos o ninguno (casillas con aspecto de chip). Validado en `wireframe-proyectos.dc.html`.
- **Contraseña temporal** de manager nuevo: la genera el servidor, se muestra una sola vez al crear; obliga a cambiarla en el primer inicio de sesión.

## Cambios de dominio / backend que implica
1. `Tema genérico` pasa a pertenecer a un manager (orden, vigente/retirado). Semilla: 3 temas por manager.
2. `Proyecto` gana estado vigente/retirado (+ fecha de retirada).
3. `Mentee`: alta con nombre, proyectos actuales (0..n) y fecha «en tu equipo desde».
4. `Manager`: alta (nombre, email único, contraseña temporal, flag `debeCambiarContraseña`); cambio de contraseña; invalidar sesiones.
5. Endpoint agregado para Mi equipo: por mentee → nº acuerdos pendientes, nº incidencias abiertas, nº objetivos en curso, fecha del último 1-to-1.
6. Historial unificado: feed cronológico por mentee (1-to-1, 1-to-1 editado, incidencia abierta/resuelta, objetivo cumplido/no cumplido, entra en proyecto, sale de proyecto, traspaso). Editar un objetivo no genera evento.
7. `1-to-1` se identifica por id (no por fecha); guarda `registradoPor` (manager) y `registradoEn` (timestamp, base del plazo de 7 días).
8. `EdiciónDe1to1`: 1-to-1, autor, fecha, lista de cambios `{parte (nota de tema | acuerdo), tipo (reescrito | añadido | quitado), antes, después}`. El servidor rechaza ediciones fuera de plazo o de otro manager.
9. `Incidencia`: la fecha de apertura la elige el manager (≤ hoy), no es la de creación del registro.
10. `Objetivo`: edición de título, descripción y fecha límite solo en estado en curso; fecha límite ≥ hoy.
11. `Tema propio`: alta, retirada y reactivación fuera de un 1-to-1 (endpoint propio por mentee).
12. `Mentee`–`Proyecto` pasa a ser **muchos a muchos**: `Asignación {mentee, proyecto, desde, motivoEntrada, hasta?, motivoSalida?}`. El evento «Cambio de proyecto» se sustituye por «Entra en proyecto» y «Sale de proyecto». El nº de mentees por proyecto (Ajustes → Proyectos) cuenta asignaciones vigentes; la regla «solo se retira sin mentees» no cambia. El endpoint de Mi equipo devuelve la lista de proyectos vigentes.

## Responsive y foco (P5)
- ≥ 1024px: como en las referencias. Contenido máx. ~1040px.
- 640–1023px: sidebar de mentee se convierte en barra de pestañas horizontal desplazable bajo el nombre; en Resumen las dos columnas se apilan (la de «Para vuestro siguiente 1-to-1» primero). La tabla de Mi equipo oculta la columna Proyectos.
- < 640px: Mi equipo pasa de tabla a lista de tarjetas (nombre, proyectos uno por línea, badges de señal debajo). Lista de 1-to-1s: la fila apila fecha / nota / badges; el buscador ocupa el ancho completo. Detalle de 1-to-1: «Editar 1-to-1» y su explicación bajan debajo del título; la columna 1 de «Cambios» se apila sobre la 2. Diálogos a ancho completo menos 16px por lado. Cabecera global: logo + menú («Ajustes», «Cerrar sesión»). Registrar 1-to-1: el panel «Contexto» pasa a un desplegable encima del formulario; los botones Guardar/Descartar quedan en una barra inferior fija.
- Foco visible siempre con `--foco-anillo` (nunca `outline: none` sin sustituto).

## Vocabulario — cambio que hay que llevar a `CONTEXT.md`
- «Cambio de proyecto» deja de existir como término de dominio. Se sustituye por **«Entrada en proyecto» / «Salida de proyecto»** (acciones: «Añadir al proyecto» / «Sacar del proyecto»; eventos: «Entra en {proyecto}» / «Sale de {proyecto}»). Nunca: movimiento, rotación, reasignación.
- Nuevo: **Edición (de un 1-to-1)** y **Cambios** (la lista de ediciones). Nunca: versión, revisión, log.

## Huecos pendientes de diseño (crear issue de diseño, no inventar)
- Oscuro solo está pintado en Mi equipo y Resumen; el resto se deriva de los tokens (incluido §10–§15).
- Responsive < 640px de §10–§15: solo pautas escritas (arriba), sin referencia pintada.

*Cerrados en este paquete:* lista y detalle de 1-to-1s (§10, §11), Registrar incidencia (§12), Nuevo/Editar objetivo (§13), temas propios fuera del 1-to-1 (§14), varios proyectos por mentee (§15 y ajustes [v2]), estados P4 de cada pieza nueva.

## Exploraciones futuras (fuera del MVP — no implementar)
Roles/permisos de administración · Vista agregada «preparar el siguiente 1-to-1» · Visualización del recorrido de la mentee · Notificaciones · Exportaciones.
