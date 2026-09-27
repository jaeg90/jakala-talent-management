# JTM (Jakala Talent Management)

Herramienta web interna para que los managers de Jakala hagan el seguimiento de las personas de su equipo. Proyecto de TFM; todos los datos son ficticios.

## Language

**Manager**:
Persona que inicia sesión en JTM y hace el seguimiento de su equipo. Único rol de usuario de la herramienta.
_Avoid_: jefe, supervisor, usuario

**Mentee**:
Persona cuyo seguimiento gestiona un manager en JTM. Existe como dato dentro de la herramienta; no inicia sesión.
_Avoid_: colaborador, mentorizado, empleado, trabajador, talento

**Equipo**:
Conjunto de mentees que un manager gestiona en un momento dado.
_Avoid_: plantilla, staff

**Traspaso**:
Paso de un mentee de un manager a otro por reorganización. El historial pertenece a la mentee: el nuevo manager lo hereda completo.
_Avoid_: transferencia, reasignación

**1-to-1**:
Conversación registrada entre un manager y una mentee: fecha, notas por tema y acuerdos.
_Avoid_: reunión individual, catch-up

**Tema**:
Asunto que se trata en los 1-to-1s de una mentee. Genérico (plantilla común) o propio (añadido por el manager para esa mentee). Los temas propios persisten entre 1-to-1s hasta que se retiran.
_Avoid_: campo, pregunta, punto del día

**Acuerdo**:
Compromiso que nace de un 1-to-1; queda pendiente hasta que se marca cumplido.
_Avoid_: tarea, action item

**Proyecto**:
Proyecto de cliente en el que trabaja una mentee. Cada mentee tiene un proyecto actual o ninguno.
_Avoid_: cuenta, cliente

**Cambio de proyecto**:
Paso de una mentee de un proyecto a otro (o a ninguno), con fecha y motivo. El historial queda en la persona y en los proyectos implicados.
_Avoid_: movimiento, rotación

**Incidencia**:
Suceso extraordinario que afecta al seguimiento de una mentee (baja, conflicto, retraso, situación personal con impacto). Nace abierta y se resuelve; la resuelta queda en el historial.
_Avoid_: problema, issue, alerta

**Objetivo**:
Meta anual de tipo SMART pactada entre un manager y una mentee: título, descripción, fecha límite y estado (en curso, cumplido o no cumplido).
_Avoid_: meta, KPI

## Lenguaje del Piloto (orquestación del desarrollo)

Vocabulario del orquestador que implementa tickets de forma autónoma. No es lenguaje de producto JTM: nombra las piezas del propio desarrollo.

**Piloto**:
Orquestador determinista que implementa tickets de forma autónoma coordinando sesiones de IA; no es él mismo una sesión de IA.
_Avoid_: agente, bot, CI

**Frontera**:
Conjunto de tickets desbloqueados y `ready-for-agent` del que el Piloto elige su siguiente trabajo.
_Avoid_: backlog, cola, sprint

**Sesión de contexto fresco**:
Sesión nueva y no interactiva que el Piloto arranca para un único papel — implementadora (recibe el ticket), revisora (recibe el diff) o reparadora (recibe el error del último ciclo) — sin heredar memoria de ninguna otra sesión.
_Avoid_: subagente, worker, sesión persistente

**Puerta**:
Comprobación determinista del arnés cuyo veredicto nadie puede refutar: typecheck, lint, tests unitarios y de integración, E2E.
_Avoid_: check, validación, control de calidad

**Verde**:
Estado de un ticket en que todas las puertas pasan y la revisión no tiene hallazgos: el Piloto empuja y cierra el issue.
_Avoid_: aprobado, OK, success

**Rojo**:
Estado de un ticket en que algo ha fallado, una puerta o la revisión: nace una sesión reparadora.
_Avoid_: fallo, error, broken

**Reintento**:
Ciclo de reparación de un ticket tras un rojo, sea cual sea su origen; cada ticket tiene N (configurable) antes del escalado.
_Avoid_: intento, ciclo de reintento

**Escalado**:
Devolución de un ticket al humano tras agotar sus reintentos: etiqueta `ready-for-human`, comentario con el último error, aviso y fin de la pasada; el Piloto no pasa al siguiente ticket.
_Avoid_: handoff, abandono, derivar
