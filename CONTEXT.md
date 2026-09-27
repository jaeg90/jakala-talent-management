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
