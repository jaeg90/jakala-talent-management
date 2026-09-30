# 0010: Piloto — veredictos completos, spec en la reparación y autochequeo de puertas en sesión

La primera pasada del rediseño Lino (2026-09-30) escaló el ticket #14 a humano con los 3 reintentos agotados, y el post-mortem mostró tres patrones que el diseño de ADR-0003 no impedía:

1. **Un hallazgo por ronda.** El prompt de la revisora pedía «una única línea `HALLAZGO: …`», así que cada defecto latente consumía una ronda completa de reparación + revisión. Cuatro defectos, cuatro rondas, tres reintentos quemados.
2. **Nadie corría el arnés dentro del ciclo.** La implementadora declaró «todas las puertas en verde» sin ejecutarlas, y un rojo E2E real (una expectativa que seguía esperando la fecha ISO que la app ya no renderiza) sobrevivió a tres parches, porque las puertas del coordinador solo se abren tras una revisión limpia que nunca llegó.
3. **La reparadora trabajaba a ciegas.** Recibía solo el texto del error, sin la spec del ticket, así que los criterios citados en el hallazgo los interpretaba de oídas: añadió el componente `<Fecha>`… sin cablearle el formato Intl, y el hallazgo volvió en la ronda siguiente.

Se decide reforzar el ciclo **sin tocar quién juzga ni la asimetría verde/rojo** de ADR-0003:

- **Veredicto multi-hallazgo.** La revisora enumera TODOS los problemas en una sola respuesta (`HALLAZGO n: …`, una línea por problema), y el adaptador los viaja enteros a la reparadora. Una ronda de reparación despeja la lista completa, no un elemento.
- **La reparadora recibe la spec del ticket** junto al error. Sigue siendo contexto fresco — datos del tracker, no conversación de una sesión previa —, pero repara contra criterios verificables en vez de contra adivinanzas del texto del hallazgo.
- **Autochequeo de puertas en sesión.** Los prompts de implementadora y reparadora exigen ejecutar las puertas de la configuración (el prompt se genera desde `piloto.config.json`, sin duplicar comandos) y corregir hasta verlas todas en verde antes de dar el diff o el parche por listos. Las puertas del coordinador no cambian: siguen siendo el único juez y siguen corriendo tras una revisión limpia; las de las sesiones son autochequeo, no veredicto — nadie declara verde, solo se evita presentar rojo.
- **Retoma explícita.** El prompt de la implementadora reconoce diffs huérfanos de intentos anteriores del mismo ticket y manda verificarlos contra la spec y las puertas en vez de rehacerlos desde cero.

Acompaña un margen operativo: `tiempoMaxMinutos` sube de 30 a 45, porque el autochequeo (E2E incluida) consume minutos que antes la sesión no gastaba.

## Opciones consideradas

- **Subir N (reintentos).** Trata el síntoma (más rondas disponibles) sin tocar las causas (rondas malgastadas), y cada ronda extra cuesta dos sesiones. Descartado como primera medida; se revisa si una pasada vuelve a quemarse con el ciclo reforzado.
- **Abrir las puertas del coordinador antes de la revisión** (cambiar la máquina): habría cazado el rojo E2E en la primera ronda, pero altera la secuencia validada por el prototipo y confunde los papeles: las puertas del coordinador juzgan el diff que se presenta; el autochequeo en sesión cubre lo mismo sin tocar el núcleo. Descartado.
- **Revisora que ejecuta las puertas.** Su bash está permitido (ADR-0006), pero mezcla su papel (spec) con el del arnés (verde/rojo) y alienta veredictos del tipo «al menos compila». Descartado: cada papel juzga lo suyo.
- **Prompt de revisora con lista de criterios del ticket.** Ya la tiene: recibe el cuerpo del ticket completo; el cambio real era el contrato de salida (todos los hallazgos), no más contexto. No procede.
