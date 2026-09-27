# 0003: El Piloto — coordinación determinista, sesiones de contexto fresco y puertas como único juez

Para implementar los tickets de forma autónoma (desde el #5), se decide **El Piloto**: una máquina de estados determinista escrita en TypeScript en el propio repo, que coordina sesiones de IA sin ser una de ellas. Un LLM coordinador habría sido la vía obvia, pero su comportamiento no sería reproducible y no podría narrarse transición a transición en la memoria del TFM.

El Piloto consulta la frontera (tickets desbloqueados y `ready-for-agent`), elige uno y coordina **sesiones nuevas, no interactivas y de contexto fresco, una por papel**: la implementadora recibe solo el ticket; la revisora revisa el diff contra estándares y spec sin heredar nada del razonamiento de la implementadora; la reparadora recibe el error del último ciclo. Ninguna sesión se autoevalúa ni hereda memoria de otra: la independencia se compra con sesiones nuevas, no con mejores instrucciones.

Las puertas deterministas del arnés son el único juez. **Verde** = todas las puertas en verde (typecheck, lint, tests unitarios y de integración, E2E) *y* revisión sin hallazgos; en verde el Piloto empuja, cierra el issue con un resumen y sigue con el siguiente ticket. **Rojo** = cualquier otra cosa. La asimetría es deliberada: la revisión puede forzar rojo con sus hallazgos, pero ningún LLM puede declarar verde ni refutar el veredicto de una puerta.

## Reintentos y escalado

Cada rojo consume un reintento del contador del ticket (N configurable), sin distinguir su origen, de modo que el bucle siempre tiene una salida acotada. Agotados los N reintentos, el Piloto no inventa un estado nuevo: etiqueta el ticket `ready-for-human` — reutilizando la etiqueta de triage del repo —, deja un comentario con el último error, avisa al humano por el canal configurado **y detiene la pasada**: no pasa al siguiente ticket. Un escalado suele señalar algo sistémico (spec incompleta, arnés roto) que afectaría al resto de la frontera, y deja al humano un solo frente abierto; reanudar es decisión suya. La pasada solo avanza en verde. (Ajuste decidido al validar el prototipo del loop; ver #11.)

Son configurables el modo de entrega (rama+PR o push directo a main), N y el canal de aviso. No son configurables el reparto de papeles ni quién juzga.

## Opciones consideradas

- **LLM como coordinador**, la vía habitual en orquestadores multiagente: flexible, pero un loop autónomo que razona su propio próximo paso no es reproducible ni depurable, e inexplicable línea a línea en el TFM. Descartado.
- **Revisor consultivo** (hallazgos solo en el resumen, sin poder de bloqueo): habría vaciado de sentido que el implementador nunca se autoevalúe; código que incumple la spec habría pasado si las puertas pasaban. Descartado.
- **Sesión persistente que implementa, revisa y repara**: más barata en tokens, pero es justo la memoria compartida y la autoevaluación que hay que evitar. Descartado.
- **Continuar con el siguiente ticket tras un escalado**: mantiene al Piloto siempre en movimiento, pero le deja al humano una cola de tickets rotos que triar en bloque y disimula la causa raíz cuando el fallo es sistémico. Descartado al validar el prototipo.
