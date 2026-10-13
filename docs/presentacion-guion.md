# Guion de la presentación del TFM — vídeo + PPT + demo (15–20 min)

Objetivo de duración: **18:30** (deja 1:30 de margen sobre los 20). Graba por bloques según las secciones de este guion y monta: cada bloque es autónomo y el montaje es tu amigo.

---

## Esqueleto con tiempos

| Bloque | Tiempo | Acumulado |
|---|---|---|
| 1. Presentación | 0:45 | 0:45 |
| 2. Por qué JTM | 1:30 | 2:15 |
| 3. Cómo el máster me ha ayudado | 1:30 | 3:45 |
| 4. Cómo ha sido el desarrollo | 8:15 | 12:00 |
| 5. Demo | 4:00 | 16:00 |
| 6. Futuros pasos | 1:30 | 17:30 |
| 7. Cierre | 1:00 | 18:30 |

---

## Bloque 1 — Presentación (0:45)

Nombre, qué presentas y en qué contexto. Termina con la frase que enmarca todo:

> «JTM es una herramienta real, pero el TFM es también un experimento: hasta dónde llega un desarrollo donde el código lo escriben sesiones de IA y el proceso lo controla una máquina determinista.»

*(Rellena tú: nombre, máster, convocatoria.)*

## Bloque 2 — Por qué JTM (1:30)

*(Tu contenido, ya lo tienes claro. Sugerencia de estructura: problema → alternativa actual → qué cambia con JTM.)*

- El problema: el seguimiento de equipo vive en notas sueltas, memoria y Excel; los 1-to-1s no dejan rastro consultable y el historial se pierde en cada traspaso.
- Qué es JTM en una pantalla: Mi equipo con el panel de atención, ficha de mentee con 1-to-1s, acuerdos, objetivos, incidencias y un historial que pertenece a la persona, no al manager de turno.
- Frase puente al siguiente bloque: «y la forma de construirla es lo interesante del TFM».

## Bloque 3 — Cómo el máster me ha ayudado (1:30)

Cuatro mapeos con evidencia en el propio proyecto (rellena el toque personal de cada uno):

| Qué me dio el máster | Dónde se ve en el proyecto |
|---|---|
| Exigía Stryker, Playwright y SonarQube | Dictó el stack (ADR-0001: «TypeScript en todo el stack») y elevó el testing a puerta determinista |
| Arquitectura limpia | Hexagonal explícita «explicable línea a línea» (ADR-0001); la auth tras un puerto (ADR-0002) hace del SSO futuro un adaptador; el Piloto es exportable por los mismos puertos (ADR-0004) |
| Desarrollo con IA | «Con IA» es literal: las features las escribieron sesiones de IA orquestadas por el Piloto; el humano define, supervisa y destila |
| Calidad de software como disciplina | 512 tests (418 + 94 E2E), mutación ≥85 en dominio, todo determinista y sin red (ADR-0005) |

## Bloque 4 — Cómo ha sido el desarrollo (8:15)

Framing inicial (0:15): «El 100% del código de producto lo escribieron sesiones de IA. El reto no era que escribieran código: era que escribieran el código correcto, y ese es el proceso que os cuento». Después, los cinco pilares en este orden:

### 4.1 El arnés (1:30)

- **Claim**: la fiabilidad no salió de mejores prompts; salió de un arnés de archivos, permisos y puertas que la sesión lee al arrancar. La documentación es la entrada que determina la salida: *documentación compilable*.
- **Anécdota**: la clase de error más recurrente (literales de color sueltos en el CSS) pasó de hallazgo de revisión a **fallo de lint**: hoy ni llega a revisión. Regla del proyecto: *fallo recurrente → regla; fallo mecánico → puerta.*
- **Pantalla**: AGENTS.md + skills + `opencode.json` + tabla de `npm run quality`.

### 4.2 Las skills (1:00)

- **Claim**: la sesión de IA no recuerda nada de una sesión a otra; las skills son la memoria externa donde vive el procedimiento. Lo aprendido una vez se aplica siempre.
- **Datos**: 24 skills de terceros vendored (grilling, research, tdd…) + 2 de cosecha propia: supervisión de pasadas y **cierre de jornada** (clasifica cada error del día y lo destila en reglas para mañana); la de tickets, vendored de origen, fue rehecha con evidencia del propio repo.
- **Pantalla**: lista de skills + un fragmento de una regla destilada con su issue y fecha de nacimiento.

### 4.3 El Piloto (2:30) — el corazón

- **Claim**: un orquestador **determinista** (máquina de estados en TypeScript, no un LLM) coordena sesiones de contexto fresco: implementadora, revisora, reparadora. Nadie se autoevalúa; las puertas son el único juez; el LLM solo puede forzar rojo.
- **Loop** (diagrama en slide): implementadora → revisora → verde: push y cierre · rojo: reparadora → N=4 → escalado (para la pasada) o devolución (no quema reintentos).
- **Anécdotas** (elige 2 de 3):
  - Los escalados por acumulación (#14, #18, #22) produjeron cada uno un ADR: el proceso aprendió de cada uno.
  - La quinta regresión del extractor: la máquina inventó un rojo contra un diff limpio ($1.38, 18 min) → el verbatim de esa revisora se convirtió en **test de regresión**. Los defectos de proceso se reparan con tests, no con promesas.
  - Modelos por tipo con datos: la sesión es 98% lectura de caché, el modelo «premium» salía 27% más barato por sesión… y aun así lo falsaron los datos por ticket ($11.87 en #25). El ganador volvió a ser el primero, ahora con evidencia.

### 4.4 La ambigüedad cuesta dólares (1:15)

- **Claim**: la sesión no pregunta: adivina. Y la adivinación cuesta rondas. Definir con precisión es la mayor palanca de productividad del desarrollo con IA.
- **Cifra grande en slide**: `$2.74` quemados en un escalado por una spec ambigua (`«tarjeta 420px»` — ¿ancho total o de contenido?) frente a `$0.25` de una duda formulada a tiempo.
- **Consecuencia de diseño**: nació la **DUDA** como salida de primera clase del ciclo — devuelve el ticket sin quemar reintentos, el humano la cierra en un grill y la respuesta aterriza en el cuerpo del issue («reparar una ambigüedad es volver a adivinar»).
- Botón de muestra: «mínimo 10 caracteres» — ¿UTF-16 o puntos de código? Con el tiempo, toda definición del repo acabó fijando unidad y quién computa.

### 4.5 El testing (1:30)

- **Claim**: cuatro puertas deterministas (typecheck, lint, tests, E2E) + arnés de calidad (Stryker solo al dominio «porque ahí viven las invariantes», SonarQube, OpenTelemetry, Sentry). Todo sin red: si falta un servicio, `SKIP`, no `FAIL`.
- **Lo que descubrimos gracias a él** (2-3 bullets):
  - Un test que restauró «a medias» dejó la base compartida sucia y el test siguiente heredó el desorden → regla de contaminación cero.
  - Un checkbox optimista que no revertía al fallar la petición → el estado del control refleja siempre el del servidor.
  - `aria-disabled` con el manejador activo: el contrato «pulsarlo no hace nada» se comprueba en el manejador, no en la clase CSS.
- **Cifras** (0:15, slide propia): 87 commits · 55 issues (37 cerrados) · ~24.300 líneas · 418 + 94 tests · 13 ADRs · 34 términos de glosario · 0 PRs (push directo, permisos deny a las sesiones).

## Bloque 5 — Demo (4:00) — solo producto

### Preparación (antes de grabar, ~10 min)

1. Borrar la base y arrancar limpio: `rm jtm.db jtm.db-wal jtm.db-shm` → `npm start` (la semilla se recrea).
2. **Calentamiento con Marta** (`manager@jakala.example` / `secreta123`) para que las pantallas luzcan:
   - Ana: un 1-to-1 antiguo (hace ~3 semanas) con un acuerdo marcado cumplido; un 1-to-1 reciente con un acuerdo pendiente; un objetivo en curso.
   - Beatriz: una incidencia abierta.
   - Carla: no tocar (su «necesita atención» por ausencia de 1-to-1s es parte de la demo).
3. Resolución ≥ 1280px, tema claro, zoom 100%, micrófono aparte del teclado.

### Camino (4:00)

| # | Acción | Qué dices | Tiempo |
|---|---|---|---|
| 1 | Login como Marta | «Todos los datos son ficticios. Arranco como Marta, manager de tres personas.» | 0:20 |
| 2 | Mi equipo | «El panel de atención ordena por quién me necesita: incidencia abierta o 1-to-1 con más de 14 días.» Carla y Beatriz arriba. | 0:40 |
| 3 | Ficha de Ana → Resumen | «Acuerdos pendientes del último 1-to-1, temas para el siguiente…» — marca un acuerdo cumplido en vivo. | 0:50 |
| 4 | **Registrar 1-to-1 en vivo** | «La acción del día a día: la plantilla de temas ya viene cargada; escribo notas y acuerdos.» Guardar → vuelve al detalle. | 1:00 |
| 5 | Lista de 1-to-1s | Busca una palabra: «la búsqueda filtra y resalta en notas y acuerdos». | 0:30 |
| 6 | Historial | «Todo lo que pasó, por tipo: 1-to-1s, incidencias, proyectos…» cambia el filtro una vez. | 0:20 |
| 7 | Ajustes → Apariencia → Oscuro | «Y todo el diseño es tokenizado: claro y oscuro sin tocar los componentes.» | 0:20 |

**Si te sobra tiempo**: login como `julia@jakala.example` → contraseña temporal forzada (muestra el flujo completo en 20 s). **Si te falta**: corta el paso 6 (historial) primero, luego el 5.

## Bloque 6 — Futuros pasos (1:30)

- «El MVP se congela hoy deliberadamente: parar también es una decisión documentada» (tag `v1.0.0-mvp`).
- El futuro no es una lista de deseos: **18 issues ya priorizados y con contexto** en la etiqueta `post-mvp` del repo. Tres niveles:
  - **Uso real** (alta): SSO con Microsoft Entra ID (#46) + despliegue en producción (#47).
  - **Salto de valor** (alta): conectores con RRHH — vacaciones, horas, p360 (#48) + resúmenes de 1-to-1 con IA (#49).
  - **Consolidación** (media/baja): roles y permisos (#50), wiki de guías (#51), «preparar el siguiente 1-to-1» (#52), recorrido visual (#53), notificaciones (#54), exportaciones (#55) — más los 7 tickets del rediseño ya especificados.
- Frase puente: «y todos los issues llevan el mismo estándar de definición que os he contado: contexto, preguntas de diseño abiertas y prioridad».

## Bloque 7 — Cierre (1:00)

La tesis del TFM en una frase (propuesta):

> «El modelo no era lo importante: el aprendizaje de este proyecto quedó compilado en el repo — en 13 ADRs, en un glosario de 34 términos, en un git log donde cada decisión tiene su porqué, y en reglas que hicimos nacer de cada error. La máquina no aprendió sola: aprendió porque cada fallo se convirtió en contrato.»

Y la invitación a auditar (última slide): el repo es público — README como índice, `git log` narrativo, ADRs con alternativas rechazadas, issues con evidencia, skills destiladas. Cierre personal y gracias.

---

## Estructura de la PPT (15 slides + anexo)

| # | Slide | Contenido |
|---|---|---|
| 1 | Portada | Título, nombre, máster, link al repo |
| 2 | El problema | Por qué JTM (tu motivación) |
| 3 | El máster y el proyecto | La tabla de mapeos del bloque 3 |
| 4 | El experimento | Frase marco + mini-diagrama: humano ←→ Piloto ←→ sesiones IA ←→ puertas |
| 5 | El arnés | AGENTS.md + skills + permisos + calidad; regla→puerta |
| 6 | Las skills | 23 + 3; «memoria externa»; captura de una regla con su issue |
| 7 | El Piloto | Diagrama del loop micro (implementadora/revisora/reparadora, N=4, escalado, devolución) |
| 8 | Incidentes que enseñaron | 3 bullets con $: 2.74 vs 0.25 · 11.87 · el rojo inventado (1.38) |
| 9 | La ambigüedad cuesta dólares | Cifra grande $2.74 / $0.25 + DUDA |
| 10 | El testing | 4 puertas + arnés; los 3 descubrimientos |
| 11 | Cifras | 87 · 55 · 24.300 · 512 · 13 · 34 |
| 12 | Demo | Pantallazo de Mi equipo (o transición directa) |
| 13 | Futuros pasos | 3 columnas de prioridad con los #issues |
| 14 | Cierre | Tesis + dónde auditar + gracias |
| 15 | (Anexo) | Tabla de ADRs · glosario · diagrama de datos — por si hay preguntas |

**Consejo de slides**: usa capturas reales (Mi equipo, la tabla de `npm run quality`, un commit del log, un issue con antidotos) en vez de texto abstracto. El tribunal puede leer; enséñales el sistema.

---

## Checklist de entrega

- [ ] `gh repo edit jaeg90/jakala-talent-management --visibility public` — al entregar el vídeo (sin secretos reales en el repo, verificado)
- [ ] README como landing: ya está (estado congelado + link al filtro `post-mvp`)
- [ ] Borrar `jtm.db*` + calentamiento antes de grabar la demo
- [ ] Ensayar la demo con cronómetro dos veces
- [ ] Ensayar el bloque 4 con cronómetro: es el que se infla
- [ ] Decir «todos los datos son ficticios» en la demo
- [ ] Montar por bloques; recortar en este orden: paso 6 de la demo → paso 5 → skills a 30 s
- [ ] Duración final objetivo: 18:30

## Mapa a la materia prima

Cada bloque bebe de `docs/aprendizaje-tfm.md`: arnés (§1), skills (§2), Piloto (§11 + §3), ambigüedad (§6), testing (§8), cifras (intro), futuros pasos (issues `post-mvp`). Si en el ensayo un punto no te sale natural, vuelve ahí y busca la anécdota alternativa.
