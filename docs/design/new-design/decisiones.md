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
| `/mentees/:id/1-to-1s/:fecha` | Detalle de 1-to-1 *(pendiente)* |
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
- **Contraseña temporal** de manager nuevo: la genera el servidor, se muestra una sola vez al crear; obliga a cambiarla en el primer inicio de sesión.

## Cambios de dominio / backend que implica
1. `Tema genérico` pasa a pertenecer a un manager (orden, vigente/retirado). Semilla: 3 temas por manager.
2. `Proyecto` gana estado vigente/retirado (+ fecha de retirada).
3. `Mentee`: alta con nombre, proyecto actual (o ninguno) y fecha «en tu equipo desde».
4. `Manager`: alta (nombre, email único, contraseña temporal, flag `debeCambiarContraseña`); cambio de contraseña; invalidar sesiones.
5. Endpoint agregado para Mi equipo: por mentee → nº acuerdos pendientes, nº incidencias abiertas, nº objetivos en curso, fecha del último 1-to-1.
6. Historial unificado: feed cronológico por mentee (1-to-1, incidencia abierta/resuelta, objetivo cumplido/no cumplido, cambio de proyecto, traspaso).

## Responsive y foco (P5)
- ≥ 1024px: como en las referencias. Contenido máx. ~1040px.
- 640–1023px: sidebar de mentee se convierte en barra de pestañas horizontal desplazable bajo el nombre; en Resumen las dos columnas se apilan (la de «Para vuestro siguiente 1-to-1» primero). La tabla de Mi equipo oculta la columna Proyecto.
- < 640px: Mi equipo pasa de tabla a lista de tarjetas (nombre, proyecto, badges de señal debajo). Cabecera global: logo + menú («Ajustes», «Cerrar sesión»). Registrar 1-to-1: el panel «Contexto» pasa a un desplegable encima del formulario; los botones Guardar/Descartar quedan en una barra inferior fija.
- Foco visible siempre con `--foco-anillo` (nunca `outline: none` sin sustituto).

## Huecos pendientes de diseño (crear issue de diseño, no inventar)
- Lista de 1-to-1s y detalle de un 1-to-1 registrado.
- Formularios: Registrar incidencia, Nuevo objetivo / Editar objetivo, Añadir/retirar tema propio desde la ficha (en Registrar 1-to-1 ya existe).
- Estados P4 de cada pantalla: cargando (skeleton), vacío (con invitación a actuar), error de red. Pautas en `especificacion-pantallas.md` § Estados.
- Oscuro solo está pintado en Mi equipo y Resumen; el resto se deriva de los tokens.

## Exploraciones futuras (fuera del MVP — no implementar)
Roles/permisos de administración · Vista agregada «preparar el siguiente 1-to-1» · Visualización del recorrido de la mentee · Notificaciones · Exportaciones.
