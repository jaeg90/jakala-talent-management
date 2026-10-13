# Aprendizaje del TFM — material para la presentación

Recopilación de todo lo aprendido en el desarrollo de JTM, organizada por secciones. Es materia prima: al final hay una síntesis con los puntos más potentes para decidir qué entra en la presentación.

## El proyecto en una frase

JTM (Jakala Talent Management) es una herramienta web interna para que los managers hagan el seguimiento de su equipo (1-to-1s, proyectos, incidencias, objetivos). Pero el TFM es un experimento doble: construir una herramienta real **y** demostrar hasta dónde llega un desarrollo dirigido por sesiones de IA con contexto fresco, orquestadas por una máquina determinista (el Piloto), con un humano que define con precisión, supervisa y destila reglas de cada fallo.

## Números del estado final

| Métrica | Valor |
|---|---|
| Commits | 87 (push directo a main; 0 PRs — el modo de entrega del Piloto, ADR-0003) |
| Issues | 55: 37 cerrados, 18 abiertos (7 tickets Lino + epic + 10 mejoras post-mvp) |
| Código | 147 archivos TS/TSX, ~24.300 líneas (incluye tests y E2E) |
| Tests | 418 unitarios/integración (Vitest) + 94 E2E (Playwright, 18 specs) |
| Calidad | Stryker ≥85 en dominio · SonarQube · OpenTelemetry · Sentry (ADR-0005) |
| Documentación | 13 ADRs · 34 términos en el glosario (18 de dominio + 16 del Piloto) |
| Skills | 23 de terceros vendored + 3 propias (2 locales + 1 evolucionada) |
| MVP congelado | Tag `v1.0.0-mvp` (13-oct-2026); futuro en la etiqueta `post-mvp` |

---

## 1. El arnés: el desarrollo dirigido por archivos (AGENTS.md y skills)

**Idea central.** La fiabilidad de un desarrollo con agentes no sale de improvisar mejores prompts: sale de un *arnés* — archivos que el agente lee al arrancar, permisos que lo acotan, puertas deterministas que lo juzgan y skills que le dan procedimiento. Parte del «código» de este proyecto son archivos de texto: `AGENTS.md`, skills, `opencode.json`, los cuerpos de los tickets. En un desarrollo con IA, **la documentación es compilable**: es la entrada que determina la salida de cada sesión.

**El arnés se construyó antes que la aplicación.** Los primeros cinco commits del repo son configuración: skills vendored, arnés de skills, traducción al español, Git Bash como shell. La primera `feat` (esqueleto caminante, #2) llegó después. Y siguió evolucionando después: la puerta de lint de literales Lino (`486c00b`), los permisos V2 no fatales (`b8ec29d`), los permisos ask para commit/push (`0a77233`).

**El patrón que define al proyecto: fallo recurrente → regla; fallo mecánico → puerta.**

- Cuando una clase de error apareció en serie (helpers duplicados, valores fuera de `tokens.css`, carreras de peticiones), se destiló en una regla de `AGENTS.md` con su evidencia.
- Cuando el error era puramente mecánico (un literal px/hex suelto en `lino.css`), se convirtió en una **puerta determinista**: hoy el lint falla si un valor visual no cita la doc o el ticket que lo pide. La categoría que más ardió en las revisiones (#17, #18, #20) ya no puede arder: es un fallo de lint, no un hallazgo de revisora.

**Lección.** Un LLM no se vuelve fiable pidiéndole que lo sea; se vuelve fiable quitándole la oportunidad de fallar de las maneras en que ya falló.

---

## 2. Skills: de terceros y propias

**De terceros (vendored en `.agents/skills/`).** La colección de Matt Pocock, 23 skills traídas al repo y configuradas en español. Las que dejaron huella documentada:

| Skill | Para qué se usó | Evidencia |
|---|---|---|
| `grilling` | Entrevistas de grill para cerrar tickets ambiguos | «grill de #14», «grill de #19», «grill de #25» en el log; ADR-0012 hace del grill el desenlace de toda devolución |
| `writing-tickets` | Cuerpos de ticket con «Alcance» y citas verbatim | Nació con ADR-0011; mejorada por #45 («que las dudas de contrato afloren al definir tickets») |
| `domain-modeling` | Mantener `CONTEXT.md` y ADRs | `docs/agents/domain.md` la referencia como creadora perezosa de ambos |
| `research` | Investigar con fuentes primarias y dejarla en el repo | `docs/research/opencode-v2-sesiones-permisos-y-procesos.md`, base del ADR-0006 |
| `code-review` | Revisión de código propio | `1702a2f` «correcciones del code review» |
| `retro` | Retrospectivas del proceso | `341c15a` «retro — CI de puertas, edges como texto…» |
| `prototype` | Validar el diseño del Piloto antes de construirlo | ADR-0003 se ajustó «al validar el prototipo» (#11) |

**Propias.**

- `piloto-supervision` (en `.opencode/skills/`, local): supervisar una pasada del Piloto en vivo — chequeos pre-vuelo, reglas de monitorización, firmas de fallo conocidas, protocolo de incidencias.
- `piloto-cierre-jornada` (ídem): la retrospectiva de fin de jornada — recoger evidencia de los tickets del día, clasificar cada error (clase conocida vs clase nueva), destilar las clases nuevas en guardarrailes (puerta determinista primero, luego regla/doc/skill) y proponer el bundle al humano para su OK (`5752d55`).
- `writing-tickets` (evolucionada): es base de terceros, pero su forma actual es propia — contratos exactos, chequeo de puertas por antidoto, citas de repo verificadas, unidades fijadas, y el chequeo de migración declarando política **por cada campo** (`0400b67`, `38e7e81`).

**Lección.** Las skills son el mecanismo por el que una lección aprendida una vez se aplica siempre. La sesión de contexto fresco no recuerda nada — no hereda ninguna conversación —, pero lee el repo. Su memoria es externa, y las skills son esa memoria.

---

## 3. Modelos de IA: cuáles, por qué y qué aprendimos de su coste

**No hubo «el modelo»; hubo modelos por papel y por tipo de ticket** (ADR-0013), y cada cambio está justificado con datos.

**Modelos y sus papeles (estado final):**

| Papel | Modelo | Por qué |
|---|---|---|
| Implementadora / reparadora (todos los tipos) | `deepseek-pro-latest` (openrouter) | Suficiente para dominio y transversal; el carril «dominio» nunca escaló con él |
| Revisora | `gpt-6-luna-pro` | $0.03–0.08 por revisión; «ha cazado cada defecto fino»; su problema nunca fue calidad sino formato de salida (ADR-0012) |

**La historia del carril «pantalla» — tres experimentos en cinco días, cada uno falsado con datos:**

1. **Salida:** deepseek escalaba los tickets de pantalla por acumulación (#14, #18, #22: hallazgos finos «en serie, una clase nueva por ronda»). ADR-0013 lo enruta a `gpt-6.1-sol-pro` con un análisis de tarificación: una sesión del Piloto es **lectura de caché dominante** (en #22: 24.3M tokens de caché re-leída frente a 0.4M de entrada nueva — 98%) y deepseek cobra la caché a precio completo; el premium la descuenta 10–20×. Conclusión: sol-pro salía un 27% más barato por sesión. La mejora no cuesta dinero; cuesta solo el cambio.
2. **Falsación:** sol-pro cerró #25 por **$11.87, el ticket más caro del paquete**. El análisis por sesión era correcto; el coste por ticket, no.
3. **Examen de `glm-flash-latest`:** 11× más barata por sesión, pero 3–4× más lenta en reloj — agotó los 45 minutos de la sesión dentro del autochequeo. Decisión humana: vuelta a deepseek (`997f0c9`).
4. **Resultado:** el modelo ganador fue el primero, pero ahora se sabe **por qué**, con tokens y dólares — y N subió de 3 a 4 reintentos para absorber incidentes de formato.

**El coste de las decisiones de proceso, en dólares** (ADR-0012):

- Un escalado por agotamiento gastó **$2.74** en descubrir por agotamiento lo que una duda formulada a tiempo cuesta **$0.25** → nació la devolución por DUDA.
- Una ronda de reparación lanzada contra un diff limpio (quinta regresión del extractor, 5-oct): **$1.38 y ~18 min** quemados → el extractor aprendió a leer verde sin la línea canónica.

**Lecciones.** (1) El modelo es una decisión por papel y por tipo, no una identidad del proyecto. (2) Los datos de tokens reales deciden; la intuición tarifa mal la caché. (3) El reloj es un coste más: una sesión barata que no llega a tiempo es una sesión perdida. (4) Quedan documentados los planes B (sonnet-5.5, qwen-flash) con su condición de activación — las decisiones diferidas también son decisiones.

---

## 4. AGENTS.md: la memoria externa de las sesiones

**Qué es.** El archivo que toda sesión lee al arrancar. Hoy contiene: qué es JTM, el idioma del proyecto (español), el mapa de skills y convenciones del tracker, y — lo más valioso — los **guardarrailes**: reglas para implementadora/reparadora y para revisora, cada una destilada de un fallo real, con issue y fecha.

**Cómo llegó ahí.** No se diseñó a priori: creció solo por destilado de incidentes:

- `8bcc41e` (reglas del 4-oct, de los escalados #18 y #22): helpers existentes antes que nuevos, token de descarte en estado asíncrono compartido, matriz de E2E para acciones que vacían listas, CTAs en estados de carga/error, cascada contra lo pintado.
- `4897ef4`: la tabla CRITERIO de la revisora es innegociable — sin reagrupar ni bloques resumen.
- `6e958ad`: valores solo desde `tokens.css`; clases de la spec verificadas; «sin rastro» cubre también el contrato API.
- `5752d55`: `aria-disabled` gatea el manejador; la acción global limpia la edición local; foco inicial en la acción principal; antidotos con caracteres escapables se verifican byte a byte.
- `1125275`: la clase se repara entera, no la instancia nombrada; lo pintado tras navegación es de los parámetros nuevos; el control optimista revierte al fallar; el adaptador respeta la semántica de la regla de dominio.
- `38e7e81`: el chequeo de migración declara su política por CADA campo que añade.

**Por qué funciona.** La sesión de contexto fresco no hereda memoria de nadie (ADR-0003: «la independencia se compra con sesiones nuevas, no con mejores instrucciones»), pero el repo es su memoria externa: `AGENTS.md` + skills + cuerpo del ticket + ADRs son *todo* lo que ve. Cada regla nueva sobrevive al reset de contexto; cada incidente clasificado elimina una clase completa de fallo futuro.

**La regla que resume el archivo:** «las clases conocidas no se descubren una por ronda». El serial de #31 — `cargar()` en r1, `marcarCumplido()` en r2, el pintado tras navegación en r3, una ronda por instancia — es la evidencia de por qué existe.

---

## 5. Buenas prácticas de desarrollo

**TypeScript en todo el stack** (ADR-0001). El máster exigía Stryker, Playwright y SonarQube, que viven nativamente en el ecosistema TS. Y hay una razón de TFM explícita: Express con arquitectura hexagonal **explícita y sin magia** frente a NestJS, «porque hace cada línea explicable en la memoria del TFM y evita ocultar conceptos a un lector no desarrollador». La elección de stack también es una elección pedagógica.

**Arquitectura hexagonal — dos veces.** El server: `domain` (modelo, reglas, puertos), `application` (casos de uso), `infrastructure` (adaptadores). El Piloto repitió la misma filosofía (ADR-0004): núcleo puro tras puertos delgados, exportable a otros repos. Y funcionó como promete:

- La autenticación vive tras un puerto desde el día uno (ADR-0002); el SSO de Microsoft futuro es un adaptador nuevo, sin tocar dominio ni aplicación — ya convertido en issue post-MVP (#46).
- El historial se agregó en consulta (ADR-0007) y los conectores futuros (#48) son «añadir una fuente a la agregación»: la decisión de hoy es la extensibilidad de mañana.
- La máquina de estados del Piloto es pura: 16 tests de núcleo + 4 de loop de integración, sin una línea de I/O.

**Código limpio con evidencia.** Nombres honestos tras code review (`1702a2f`); ESLint plano más typecheck; la convención de fakes con prefijo `_` hecha regla de lint (`87ad629`); `tokens.css` como única fuente de valores visuales — «single source of truth» aplicado al CSS, con su propia puerta de lint.

**Lenguaje tipado como documentación ejecutable.** Los tipos (`Etiquetas`, `PuertaConfig`, `EdiciónDe1to1` con sus cambios tipados) le dicen a la sesión de contexto fresco qué formas son válidas sin que lo adivine. En un desarrollo con agentes, el tipado no es higiene: es la parte del contrato que el compilador verifica para que el revisor no tenga que hacerlo.

---

## 6. Definiciones y su importancia

**El hallazgo transversal del TFM: la ambigüedad es el enemigo, y cuesta dólares.** Una sesión de contexto fresco no pregunta: adivina. Dos sesiones pueden interpretar el mismo criterio en direcciones opuestas y cada interpretación cuesta una ronda de reparación (ADR-0011: ~5 de los 9 hallazgos de la retoma de #14 eran artefactos de alcance).

**Casos con precio:**

- «Tarjeta 420px» sin decir si es ancho total o de contenido → cuatro rondas de hallazgos de precisión y un escalado de $2.74. Una duda formulada a tiempo: $0.25 (ADR-0012).
- «Mínimo 10 caracteres» sin decir **UTF-16 o puntos de código** → devolución; resuelto por grill: carácter = punto de código Unicode, en servidor y cliente.
- «Hace más de 14 días» sin decir quién calcula el día y en qué zona horaria → regla en writing-tickets: todo umbral con «hoy» fija su unidad y quién la computa.
- «DUDA» definida como «un valor» se ensanchó a «un valor **o un contrato**» cuando una revisora encontró un hueco de contrato, emitió la definición exacta de DUDA como HALLAZGO y quemó un reintento (`0da137f`).

**La práctica que salió de esto:**

1. **Definiciones verificables**: qué mide la verificación, quién computa, con qué unidad.
2. **Verbatim en los tickets**: la sesión no puede leer el doc de diseño; cita literal, nunca resumen («un resumen reabre la ambigüedad que la cita venía a cerrar»).
3. **La DUDA como ciudadana de primera clase**: una ambigüedad con dos lecturas razonables devuelve el ticket sin quemar reintentos — «reparar una ambigüedad es volver a adivinar» (ADR-0012).
4. **El antidoto también se audita por clase entera**: el grill que cubrió `cumplido_el` y dejó `propio` sin definir enseñó que la regla de la clase entera aplica también al trabajo del grill (`38e7e81`).

---

## 7. El git log y la bitácora

**El git log como bitácora narrativa.** Los 87 commits no dicen solo qué: dicen por qué, con qué evidencia y a qué coste:

> «config: “pantalla” vuelve a deepseek y N de 3 a 4 (decisión humana tras el examen de glm-flash: 11× más barata por sesión pero 3-4× más lenta en reloj — agotó los 45 min dentro del autochequeo)»

> «fix: el extractor lee verde un veredicto limpio sin la línea canónica “SIN HALLAZGOS” — quinta regresión de formato (#28): la revisora emitió 4×OK, la máquina inventó un rojo y quemó una reparadora contra un diff limpio»

Cualquier decisión del TFM se puede rastrear a su commit. **Sin PRs**: el modo de entrega es push directo a main, y los permisos (`opencode.json`) deniegan commit/push/merge a las sesiones — los ejecuta el coordinador o el humano (ADR-0006). La frontera entre «lo que decide la máquina» y «lo que toca el humano» está en la configuración, no en la costumbre.

**La bitácora cuantitativa del Piloto.** El Piloto registra por ticket: rondas, hallazgos, devoluciones, coste y tokens. Esa métrica es la que disparó ADR-0013 («la métrica por tipo que ADR-0011 creó disparó su advertencia la tercera vez») y la que vigila que la revisora no esquivara veredictos marcando DUDAs o la implementadora devolviera por pereza (ADR-0012). **El proceso se auditó con datos, no con impresiones.**

**Cómo leer la historia** (para la presentación):

1. **Fundación** (5 commits chore/docs): arnés y glosario antes que código.
2. **MVP original** (#2–#10): de las sesiones interactivas al Piloto.
3. **Rediseño Lino** (#12–#43): la fase donde el proceso se templó — cada ADR del 0006 al 0013 es la respuesta a un incidente con fecha.
4. **Cierre** (#30–#31 + congelación): el MVP se para deliberadamente y el futuro se trackeriza.

---

## 8. Testing: cómo lo hicimos y qué descubrimos gracias a él

**Las cuatro puertas** (todas deterministas, todas en `npm run quality` o por separado): typecheck, lint (con la puerta de literales Lino), tests unitarios/integración (Vitest con SQLite temporal: 418), E2E (Playwright contra la app construida: 94 en 18 specs).

**El arnés de calidad** (ADR-0005): Stryker muta **solo las reglas puras del dominio** «porque ahí es donde viven las invariantes» (umbral 85: como mucho 15% de mutantes sobrevivientes); SonarQube espera el quality gate; OpenTelemetry instrumenta la API con exportador en memoria; Sentry captura un error simulado como envelope. Todo sin red externa: si falta el servicio, la puerta informa `SKIP`, no `FAIL` — el determinismo nunca depende de levantar infraestructura.

**Qué descubrimos GRACIAS al testing** (la parte que solo da la práctica):

- **La matriz de acciones que vacían listas**: toda acción que quita un elemento (Resolver, Retirar, Marcar) se cubre en E2E con el elemento en medio, el último, la lista que queda vacía — y el destino del foco verificado en cada caso.
- **E2E sin contaminación**: una prueba que restauró «a medias» (las asignaciones pero no sus eventos, ni el proyecto retirado) dejó la base compartida sucia y el spec siguiente heredó el desorden (`499e9ff`). Toda mutación se revierte completa o la prueba usa solo datos propios.
- **El control optimista revierte al fallar**: un checkbox que cambia antes de la respuesta debe revertirse si la petición falla — el estado del control refleja siempre el del servidor (r2 de #31).
- **El estado deshabilitado gatea el manejador**: `aria-disabled` con el manejador activo es un hallazgo; el contrato «pulsarlo no hace nada» se comprueba en el manejador, no solo en la clase CSS.
- **La cascada se verifica con computed style**: cuando el componente compite con una regla genérica, el E2E comprueba el valor computado, no la clase presente.
- **El autochequeo de puertas en sesión** (ADR-0010): una implementadora declaró «todas las puertas en verde» sin ejecutarlas y un rojo E2E sobrevivió a tres parches. Ahora los prompts exigen ejecutar las puertas antes de dar el diff por listo.
- **El verbatim como test de regresión**: cada una de las cinco regresiones del extractor dejó el formato real de esa revisora convertido en test. No se testea la regex abstracta: se testea la salida exacta que la rompió.
- **El testing como definición de tamaño**: Stryker sobre adaptadores «debilita la relación mutante↔invariante» — el alcance de la herramienta de mutación es también una decisión de arquitectura.

---

## 9. Los ADRs

**Qué son aquí.** No un trámite de estilo: el mecanismo por el que una decisión — y sus alternativas rechazadas — sobrevive a la sesión que la tomó. Trece decisiones, todas con «opciones consideradas»:

| ADR | Decisión |
|---|---|
| 0001 | TypeScript en todo el stack; Express hexagonal explícito frente a NestJS |
| 0002 | Autenticación con semilla tras un puerto intercambiable (SSO futuro sin tocar dominio) |
| 0003 | El Piloto: máquina de estados determinista; sesiones de contexto fresco; las puertas como único juez |
| 0004 | El Piloto con núcleo tras puertos, exportable a otros repos |
| 0005 | Arnés de calidad: Stryker solo dominio, Sonar, OTel, Sentry; SKIP no FAIL |
| 0006 | Límites no fatales para las sesiones: reglas deny, nunca asks; lo irreversible es del coordinador |
| 0007 | El historial como vista agregada en consulta, no event store |
| 0008 | Proyectos muchos a muchos; «Cambio de proyecto» muere: Entrada y Salida |
| 0009 | 1-to-1 editable 7 días por quien lo registró, con «Cambios» |
| 0010 | Veredictos multi-hallazgo, spec en la reparación, autochequeo de puertas |
| 0011 | Alcance por ticket: los criterios globales acotados al diff + exclusiones nominales |
| 0012 | Devolución por DUDA y veredicto por criterio (con cinco ajustes fechados por regresión) |
| 0013 | Modelos por tipo de ticket («pantalla» a modelo superior, el resto al defecto) |

**El patrón ADR-por-incidente.** Los ADRs 0006, 0010, 0011, 0012 y 0013 son la respuesta documentada a fallos reales: el ask que mató una sesión, el escalado de #14, la retoma de #14, el segundo escalado de #14, la métrica de los tres escalados de pantalla. Y **se ajustan, no se reescriben**: ADR-0012 acumula cinco ajustes fechados (2, 3, 4 y 5 de octubre) porque la realidad siguió enseñando.

**Lección.** La mitad valiosa de un ADR es lo que se rechazó y por qué. Las opciones consideradas son las que evitan re-argumentar lo ya argumentado — y las que dan los planes B con su condición de activación.

---

## 10. El glosario (CONTEXT.md)

**Un archivo, 34 términos, dos lenguajes.** Dieciocho términos de dominio (Manager, Mentee, 1-to-1, Acuerdo, Entrada en proyecto, Edición…) y dieciséis del Piloto (Frontera, Puerta, Hallazgo, DUDA, Escalado, Devolución…), deliberadamente separados: «el segundo nombra las piezas del propio desarrollo, no del producto».

**La estructura es el hallazgo: definición + lista «evitar».** Cada término trae sus sinónimos prohibidos (Manager no «jefe/supervisor»; Hallazgo no «error de revisión»). El sinónimo es el germen del malentendido: si dos sesiones nombran lo mismo con palabras distintas, tarde o temprano lo interpretan distinto. El «evitar» corta esa puerta.

**El glosario es un contrato que la máquina verifica.** La revisora audita contra el copy exacto; los tickets citan verbatim; `docs/agents/domain.md` obliga a usar el término del glosario en cualquier output de una skill. Y cuando el dominio cambió, el glosario cambió con él: ADR-0008 mató «Cambio de proyecto» e hizo nacer «Entrada en proyecto» y «Salida de proyecto» — y dejó constancia de que «Asignación» se queda fuera del glosario porque «no aparece en la UI».

**Definiciones y glosario (sección 6) son la misma lección a dos alturas:** la definición exacta evita la adivinación dentro de un ticket; el glosario la evita en todo el proyecto. Es Domain-Driven Design en su versión más práctica: el lenguaje compartido, escrito, con sinónimos prohibidos, entre humano y máquina.

---

## 11. El loop del workflow

**Dos bucles anidados.**

**El micro-loop — el ciclo de un ticket (el Piloto, ADR-0003/0010/0012):**

```
frontera (tickets ready-for-agent)
  → implementadora (contexto fresco, autochequeo de puertas)
  → revisora (veredicto por criterio: CRITERIO n: OK / HALLAZGO / DUDA)
  → verde → push + close + resumen
  → rojo → reparadora (ticket + error + hallazgos enteros) → repetir hasta N=4
        → escalado (ready-for-human, la pasada se DETIENE) o
        → devolución (needs-grill: no consume reintentos; el cuerpo, no el código, falló)
            → grill humano → antidotos al cuerpo → ready-for-agent otra vez
```

**El macro-loop — el ciclo de una jornada (el humano):**

```
(mañana) revisar frontera y tickets → grill para definir bien
  → pasadas del Piloto (npm run piloto) con supervisión en vivo (piloto-supervision)
  → incidencias: escalado o devolución (un solo frente abierto)
  → (tarde) cierre de jornada (piloto-cierre-jornada):
      recoger evidencia del día → clasificar cada error: ¿clase conocida o clase nueva?
      → clase nueva → destilar guardarraíl: PUERTA determinista primero,
        luego regla en AGENTS.md, luego skill → proponer bundle al humano → su OK
  → mañana siguiente: las clases nuevas ya son conocidas
```

**Las propiedades que hacen funcionar el bucle:**

1. **La asimetría**: ningún LLM puede declarar verde; solo puede forzar rojo. Verde lo firman las puertas deterministas.
2. **Salidas acotadas**: N reintentos, escalado que detiene la pasada (un solo frente para el humano), devolución que no quema reintentos. El bucle siempre tiene salida.
3. **Contexto fresco siempre**: ninguna sesión hereda memoria de otra; la independencia se compra con sesiones nuevas.
4. **El bucle aprende, no el modelo**: cada vuelta o cierra un ticket o destila una regla. Lo que acumula valor no es la sesión: es el repo.
5. **El humano en sus dos puntos exactos**: definir con precisión (grill) y decidir qué aprender del error (cierre de jornada). En medio, la máquina ejecuta y juzga con puertas.

---

## 12. Candidatos para la presentación

Los puntos más potentes, en mi opinión, por orden de fuerza narrativa:

1. **«El arnés, no el prompt»** — fallo recurrente → regla; fallo mecánico → puerta. La categoría que más ardió (literales en `lino.css`) hoy ni llega a revisión: la caza el lint.
2. **«La ambigüedad cuesta dólares»** — $2.74 de escalado contra $0.25 de duda formulada a tiempo; la DUDA como salida de primera clase que no quema reintentos.
3. **«Nadie se autoevalúa»** — sesiones de contexto fresco, puertas como único juez, el LLM solo puede forzar rojo.
4. **«Cinco regresiones del extractor»** — el formato también es contrato; cada regresión dejó el verbatim de la revisora como test de regresión. El sistema se defendió con tests, no con promesas.
5. **«El modelo premium salía más barato»** — la sesión del Piloto es 98% lectura de caché; deepseek la cobra a precio completo y sol-pro la descuenta 10–20×: 27% más barato por sesión. Y aun así, los datos por ticket lo falsaron (#25, $11.87) y el ganador final fue el primero — ahora con evidencia. Modelos por papel y por tipo, con planes B documentados.
6. **«La clase se repara entera»** — el serial de #31 (una ronda por instancia) y la regla que lo cerró; aplicada también al trabajo del grill (`cumplido_el` cubierto, `propio` olvidado).
7. **«El repo es la memoria externa»** — la sesión nueva no recuerda nada, pero lo aprendido en 34 términos de glosario, 13 ADRs, 23 skills y un AGENTS.md destilado lo sobrevive todo.
8. **«Documentación compilable»** — tickets verbatim, alcance por ticket (ADR-0011), glosario con sinónimos prohibidos: la documentación es la entrada que determina la salida de cada sesión.
9. **«La métrica disparó la decisión»** — reintentos y coste por tipo de ticket: la advertencia que creó ADR-0013 salió de datos, no de impresiones.
10. **«El MVP se congela con el futuro trackerizado»** — 87 commits, 37 issues cerrados, 418+94 tests, y una etiqueta `post-mvp` con 18 issues de trabajo futuro: parar también es una decisión documentada.
