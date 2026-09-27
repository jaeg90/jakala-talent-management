# 0004: El Piloto con núcleo tras puertos, exportable a otros repos

El Piloto (ADR-0003) no depende del dominio de JTM: depende de las convenciones del repo — issues de GitHub con triage, CONTEXT.md, ADRs, arnés determinista — que comparten otras instalaciones de las skills. Para que exportarlo no sea reescribirlo, la implementación repite la filosofía del stack (ADR-0001): **núcleo puro tras puertos delgados**, y todo lo que varía por proyecto vive en un archivo de configuración.

Puertos: **frontera** (consultar tickets desbloqueados, cerrar, etiquetar, comentar), **sesiones** (lanzar implementadora/revisora/reparadora, contexto fresco), **puertas** (ejecutar el arnés), **avisos** (canal del escalado) y **entrega** (push directo o rama+PR). Configuración: modelos por papel, N, lista de puertas, vocabulario de etiquetas del tracker, canal y modo de entrega.

Las costuras son deliberadas: son las fronteras de I/O que el script tendría de todos modos, y lo caro no es ponerlas hoy sino retroalimentarlas mañana. La exportabilidad real la demostrará el primer repo ajeno que lo use; esto solo la abarata.
