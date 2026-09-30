# 0008: Una mentee puede estar en varios proyectos (asignación muchos a muchos)

Con el paquete de diseño Lino v2, la relación Mentee–Proyecto pasa de «un proyecto actual o ninguno» a **muchos a muchos**: una mentee puede estar en varios proyectos a la vez o en ninguno. Cada paso se registra como **Entrada en proyecto** o **Salida de proyecto** (en la implementación, la entidad `Asignación {mentee, proyecto, desde, motivo de entrada, hasta?, motivo de salida?}`). El término «Cambio de proyecto» desaparece del dominio: mover de A a B son dos pasos y dos eventos, sin semántica de movimiento. De cada asignación solo se guarda proyecto, fechas y motivo; no hay dedicación ni proyecto principal.

## Opciones consideradas

- **Mantener «un proyecto actual» + cambio de proyecto** (modelo vigente hasta ahora): más simple y suficiente para una dedicación por mentee, pero no refleja que una mentee trabaje a la vez para dos proyectos, y «mover de A a B» es una semántica fabricada que mezcla dos hechos distintos (dejar A y entrar en B) en un solo evento.
- **Muchos a muchos con dedicación** (porcentaje, horas, proyecto principal): modela mejor la realidad, pero multiplica el formulario y las preguntas de producto (¿qué pasa con un 50/50?, ¿se reordena al añadir un tercero?) sin que el seguimiento de 1-to-1s lo necesite. Descartado por alcance.
- **Muchos a muchos con entrada/salida** (elegida): cada hecho es un evento; el historial gana granularidad («Sale de Green Energy» cuenta su propia historia), y la UI de alta/retirada es la misma que ya existía, desdoblada.

## Consecuencias

- Migración de datos: cada «cambio de proyecto» antiguo A→B pasa a una salida de A + una entrada en B con la misma fecha y motivo. Sin código de migración: se evoluciona esquema y semilla, la DB local se regenera (decisión ya tomada en #12).
- El historial (ADR-0007) amplía la agregación en consulta con «Entra en {proyecto}» y «Sale de {proyecto}» y sus marcadores; muere el evento «Cambio de proyecto · A → B».
- El recuento de mentees por proyecto (Ajustes → Proyectos) cuenta asignaciones vigentes; la regla «solo se retira un proyecto sin mentees» no cambia.
- No existe la acción «mover»: dar de alta en otro proyecto y sacar del actual son dos confirmaciones, dos fechas y dos motivos.
- `CONTEXT.md` actualizado: muere «Cambio de proyecto»; nacen «Entrada en proyecto» y «Salida de proyecto». La palabra interna «Asignación» queda fuera del glosario (no aparece en la UI).
