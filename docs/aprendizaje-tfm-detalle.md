# Dossier del aprendizaje del TFM — detalle por punto

Complementa a `docs/aprendizaje-tfm.md` (índice con la visión de conjunto) y a `docs/presentacion-guion.md` (guion de la presentación). Aquí cada punto va con lo mismo: **qué pasó** (la historia), **la evidencia** (commit, ADR, issue, cifra — todo auditable en el repo), **la lección** y **cómo contarlo**.

Todas las fechas son de 2026. Los hashes de commit existen en el git log; los ADRs en `docs/adr/`; los issues en el tracker.

---

## 0. Números del estado final — y cómo se midió cada uno

| Métrica | Valor | Cómo se midió |
|---|---|---|
| Commits | 87 | `git log --oneline \| wc -l` (incluye la congelación) |
| PRs | 0 | `gh pr list --state all` → vacío. Modo de entrega: push directo a main (ADR-0003); las sesiones tienen `git push/commit` denegados (ADR-0006) |
| Issues | 55: 37 cerrados, 18 abiertos | `gh issue list --state all`. Abiertos: 7 tickets Lino + epic #12 + 10 mejoras post-mvp |
| Código | 147 archivos TS/TSX, ~24.300 líneas | `find server/src server/test web/src piloto/src piloto/test e2e` + `wc -l` (incluye tests y E2E) |
| Tests | 418 unitarios/integración + 94 E2E | grep de `it(`/`test(` en `server/test` y `piloto/test`; E2E en 18 specs de `e2e/` |
| Calidad | Stryker ≥85 en dominio · Sonar · OTel · Sentry | ADR-0005; `npm run quality` resume PASS/FAIL/SKIP |
| ADRs | 13 | `docs/adr/` |
| Glosario | 34 términos (18 dominio + 16 Piloto) | `CONTEXT.md` |
| Skills | 24 vendored + 2 propias (+ 1 vendored rehecha) | `.agents/skills/` y `.opencode/skills/` |
| Piloto | N=4 reintentos · 45 min/sesión · 4 puertas | `piloto/piloto.config.json` |
| Congelación | tag `v1.0.0-mvp` (13-oct) | `git tag` |

**Por qué importa contarlo así**: cada cifra tiene su fuente a un comando de distancia. En un TFM sobre desarrollo con IA, la verificabilidad de las propias claims es parte del método.

---

## 1. El arnés (AGENTS.md + skills)

### Qué pasó

El repo empezó al revés de lo habitual: los cinco primeros commits no contienen una línea de producto. Son `chore` y `docs` — skills vendored, arnés configurado, traducción al español, glosario inicial, ADRs de stack y autenticación. La primera `feat` (esqueleto caminante, #2) llegó después. La hipótesis era explícita: en un desarrollo con agentes, **la documentación es la entrada que determina la salida** — no un adorno posterior.

El arnés terminó teniendo cuatro piezas:

1. **AGENTS.md**: lo que toda sesión lee al arrancar — hoy incluye los guardarrailes destilados (sección 4 de este dossier).
2. **Skills**: procedimientos cargables por tarea (sección 2).
3. **Permisos** (`opencode.json`): la frontera de lo que una sesión puede tocar (ADR-0006).
4. **Puertas deterministas**: typecheck, lint, tests, E2E + el arnés de calidad — el único juez.

### La evidencia — el patrón «fallo recurrente → regla; fallo mecánico → puerta»

El mejor ejemplo es la muerte de una clase de error entera. Durante #17, #18 y #20, la revisora encontró en serie **literales sueltos** en el CSS (px, hex, oklch fuera de `tokens.css`) — la categoría que más ardió. El 3-oct llegó el doble movimiento:

> `486c00b` — «puerta de lint de literales en lino.css — todo px/hex/oklch exige cita (doc o ticket); la categoría que mas ardió (#17/#18/#20) pasa a fallo determinista de la puerta lint; 52 literales citados sin tocar valores»

Hoy ese error **ni siquiera llega a revisión**: lo caza el lint. `scripts/lino-literal.mjs` exige que cada literal cite la doc o el ticket que lo autoriza. Los 52 literales existentes se citaron sin tocar sus valores: la puerta se cerró sin reescribir la historia.

Los permisos tienen la misma historia de incidente. En la primera pasada real, la revisora murió al toparse con un `ask` de la política base (`external_directory`) — un ask en sesión no interactiva es auto-rechazo y envenena la sesión entera. Y el agujero inverso: `git push` era `ask`, y las sesiones con `--auto` autoaprueban los asks — una sesión podía empujar a main, justo lo reservado al coordinador. Decisión (ADR-0006): límites como reglas **`deny`** (bloquean sin matar la sesión), y lo irreversible de git denegado en sesiones — lo ejecuta el coordinador o el humano.

> `b8ec29d` — «permisos de sesiones en reglas V2 — external_directory denegado hace no fatal el ask que mataba sesiones no interactivas; push/commit/merge quedan del coordinador»

### La lección

Un LLM no se vuelve fiable pidiéndole que lo sea; se vuelve fiable **quitándole la oportunidad de fallar de las maneras en que ya falló**. Y hay una jerarquía de durabilidad: una instrucción en un prompt es voluntad de pronto; una regla en AGENTS.md es contrato; una puerta determinista es física. Cada clase de error recurrente se empuja hacia abajo en esa jerarquía.

### Cómo contarlo

Contraste: «la vía obvia era pedirle al modelo que tuviera cuidado con los valores del CSS. La nuestra fue que el lint fallara si un color no cita dónde nace». La cifra: 52 literales citados, cero hallazgos de esa clase desde entonces.

---

## 2. Skills: de terceros y propias

### Qué pasó

La sesión de IA que implementó un ticket no recuerda nada de la sesión anterior — ni de la que revisó, ni de la que devolvió un ticket la semana pasada. Esa amnesia es deliberada (sección 11), y convierte a las skills en la **memoria externa** del sistema: procedimientos escritos que cualquier sesión nueva carga al necesitarlos.

El repo trae la colección de Matt Pocock vendored (24 skills en `.agents/skills/`, traídas al propio repo — `341c15a`: «skills vendorizadas» — para no depender de la red ni de un tercero que cambie su mind). Las que dejaron huella documentada:

| Skill | Uso real | Evidencia |
|---|---|---|
| `grilling` | Cerrar tickets ambiguos con entrevista al humano | «grill de #14» (`10311e9`), «grill de #19» (`65719ce`); ADR-0012 lo hace desenlace de toda devolución |
| `writing-tickets` | Escribir cuerpos de ticket con «Alcance» y citas verbatim | Nació con ADR-0011 (`9ecd06d`); mejorada por #45 («que las dudas de contrato afloren al definir tickets») |
| `domain-modeling` | Crear y mantener `CONTEXT.md` y ADRs | `docs/agents/domain.md` la nombra; ADRs 0007-0013 |
| `research` | Investigación con fuentes primarias dejada en el repo | `docs/research/opencode-v2-sesiones-permisos-y-procesos.md`, base del ADR-0006 |
| `code-review` | Revisión de código humano | `1702a2f` «correcciones del code review — nombres honestos…» |
| `retro` | Retrospectiva del proceso | `341c15a` «retro — CI de puertas, edges como texto en el tracker…» |
| `prototype` | Validar el diseño del Piloto antes de construirlo | ADR-0003 se ajustó «al validar el prototipo» (fdc4c95) |
| `tdd`, `implement`, `triage`, `to-tickets`… | Las demás vendored | Disponibles en `.agents/skills/` |

Las **propias**, creadas de cero en `.opencode/skills/` (locales, como las concibió `5752d55`):

- **`piloto-supervision`**: cómo supervisar una pasada en vivo — chequeos pre-vuelo, reglas de monitorización, modelo de permisos, protocolo de incidencias con las firmas de fallo conocidas.
- **`piloto-cierre-jornada`**: la retrospectiva de fin de jornada — recoger la evidencia de los tickets del día, clasificar **cada** error (¿clase conocida o clase nueva?), destilar las clases nuevas en guardarrailes (puerta determinista primero, luego regla/doc/skill) y proponer el bundle al humano para su OK. Es el motor del macro-loop (sección 11).

Y la tercera vía, la **híbrida**: `writing-tickets` es vendored de origen, pero su forma actual es de cosecha propia — contratos exactos con nombres de ruta, chequeo de puertas por antidoto, citas de repo verificadas contra el código («no desde memoria»), unidades fijadas para todo umbral con «hoy», y el chequeo de migración declarando política por cada campo (`0400b67`, `38e7e81`).

### La lección

Lo aprendido una vez debe aplicarse siempre, y el único «siempre» que existe con sesiones sin memoria es **lo escrito en el repo**. Las skills son el mecanismo: convierten una lección en procedimiento que la próxima sesión ejecuta sin haber vivido el incidente.

### Cómo contarlo

La frase: «la sesión que implementó el ticket 30 no sabía que el 25 nos costó $11.87 — pero cargó la skill que ese dinero pagó».

---

## 3. Modelos de IA: cuáles, por qué y qué aprendimos de su coste

### Qué pasó

No hubo «el modelo del proyecto»: hubo **modelos por papel y por tipo de ticket** (ADR-0013), y cada cambio de modelo se decidió con tokens y dólares reales sacados de la bitácora del Piloto. La cronología completa del carril «pantalla» es tres experimentos en cinco días:

**Punto de partida.** Defecto para implementadora/reparadora: `deepseek-pro-latest` ($0.19/$4.20 por M, caché a precio completo $0.19/M). El carril «dominio» nunca escaló con él. Pero los tres escalados por acumulación (#14, #18, #22) eran todos «pantalla»: hallazgos finos que aparecían en serie, una clase nueva por ronda.

**El hallazgo que cambió la tarifa.** Analizar los tokens reales de la BD de sesiones reveló que una sesión del Piloto es **lectura de caché dominante**: la implementadora de #22 consumió 24.3M de tokens de caché re-leída frente a 0.4M de entrada nueva — el 98%. Y deepseek cobra la caché a precio completo mientras los modelos premium la descuentan 10–20×. La cuenta: `gpt-6.1-sol-pro` ($2/$10, caché $0.10/M) salía un **27% más barato por sesión** que deepseek con el mismo perfil. La conclusión del ADR-0013 es citable literalmente: «la mejora no cuesta dinero; cuesta solo el cambio».

**La falsación.** El análisis por sesión era correcto; el coste por ticket, no. Sol-pro cerró #25 por **$11.87, el ticket más caro del paquete** (`1d66979`). La métrica por tipo que ADR-0011 había creado — y que «disparó su advertencia la tercera vez» — detectó el desajuste.

**El examen de la candidata barata.** `glm-flash-latest`: la sesión cache-read de ~60M bajaba de $7.30 a ~$1.43. Pero: «11× más barata por sesión pero 3-4× más lenta en reloj — agotó los 45 min dentro del autochequeo; el diff de flash queda en el árbol y lo retoma deepseek» (`997f0c9`). El reloj también es un coste.

**Estado final.** Implementadora y reparadora: deepseek para todos los tipos. Revisora: `gpt-6-luna-pro` — $0.03–0.08 por revisión, «ha cazado cada defecto fino y su problema no es de calidad sino de formato de salida». La revisora no se enruta aunque arda el carril: es el papel más fiable del ciclo. Y N subió de 3 a 4 reintentos.

**Los planes B quedaron documentados con su condición de activación** (ADR-0013): `claude-sonnet-5.5` si sol-pro no rendía; `qwen3.8-omni-flash` para el carril barato cuando el dominio muestre fatiga. Las decisiones diferidas también son decisiones.

### La lección

El modelo es una **variable de configuración por papel y tipo**, no una identidad del proyecto. Tarificar bien exige mirar el perfil de tokens real (la caché lo cambia todo); el coste por sesión no es el coste por resultado; y el reloj es un coste más. El ganador fue el primero — pero ahora se sabe por qué, con datos que sobreviven al recuerdo.

### Cómo contarlo

Es la historia del punto 5 de candidatos (abajo): «el modelo premium salía más barato… y aun así perdió». Empieza por el 98%: «¿cuánto creéis que cuesta la parte nueva de un prompt de 60.000 tokens que la sesión ya ha leído tres veces?»

---

## 4. AGENTS.md: la memoria externa de las sesiones

### Qué es hoy

El archivo que toda sesión lee al arrancar. Su anatomía actual: qué es JTM; el idioma del proyecto (español para toda la documentación, inglés para identificadores internos de skills); el mapa de skills y convenciones (issue tracker con `gh`, etiquetas de triage, documentación de dominio en `CONTEXT.md` + ADRs); los **guardarrailes para implementadora y reparadora**; y las **reglas de la revisora** (la tabla CRITERIO innegociable y las clases transversales a auditar desde la primera ronda).

### Cómo llegó ahí: creció solo por destilado, con commit y fecha por regla

| Commit | Fecha | Regla destilada | Incidente origen |
|---|---|---|---|
| `8bcc41e` | 4-oct | Helpers existentes antes que nuevos · token de descarte en estado asíncrono compartido · matriz de E2E para acciones que vacían listas · CTAs en estados de carga/error · cascada contra lo pintado · la revisora audita clases transversales desde la primera ronda | Escalados por acumulación #18 y #22: «hallazgos finos que aparecían en serie, uno por ronda» |
| `4897ef4` | 4-oct | La tabla CRITERIO del prompt de la revisora es innegociable — sin reagrupar, sin bloques resumen | Veredicto reagrupado de la ronda 2 de #22 |
| `6e958ad` | 5-oct | Valores visuales solo desde `tokens.css` · clases de la spec verificadas · «sin rastro» cubre también el contrato API | Hallazgos de la jornada |
| `5752d55` | 5-oct | `aria-disabled` gatea el manejador · la acción global limpia la edición local · foco inicial en la acción principal · antidotos con caracteres escapables se verifican byte a byte | Clases de #28, grill de #25, regresión del supervisor |
| `1125275` | 5-oct (noche) | La clase se repara entera, no la instancia nombrada · lo pintado tras navegación es de los parámetros nuevos · el control optimista revierte al fallar · el adaptador respeta la semántica de la regla de dominio · la revisora emite DUDA junto a HALLAZGO cuando el arreglo no está determinado | El serial de #31: `cargar()` en r1, `marcarCumplido()` en r2, el pintado tras navegación en r3 — una ronda por instancia |
| `38e7e81` | 5-oct (noche) | El chequeo de migración declara su política por CADA campo que añade la migración, no solo el que la DUDA nombró | Segunda devolución de #31: el grill cubrió `cumplido_el` y dejó `propio` sin definir |

La regla más citada del archivo resume el porqué de todas las demás: **«la clase se repara entera, no la instancia nombrada»** — cuando un hallazgo nombra una clase (estado compartido, foco, tokens, idempotencia), se auditan todas sus instancias en el diff. El serial de #31 es la evidencia: una ronda entera quemada por cada instancia que aparecía.

### La lección

«La sesión no recuerda nada, pero el repo es su memoria externa». Cada regla de AGENTS.md lleva dentro su incidente con issue y fecha — es un registro de auditoría del aprendizaje, no un documento de estilo. Y el archivo funciona porque es **lo único** que la sesión ve además del ticket y las skills: no compite con memoria heredada, no hay nada que recordar mal.

### Cómo contarlo

Muestra dos reglas con su fecha: «esta regla no la escribí yo un martes aburrido; la escribió el escalado del 3 de octubre». La frase clave: **las clases conocidas no se descubren una por ronda**.

---

## 5. Buenas prácticas de desarrollo

### Arquitectura hexagonal — dos veces

**El server** (ADR-0001): `src/domain` (modelo, reglas y puertos), `src/application` (casos de uso), `src/infrastructure` (adaptadores HTTP, SQLite, sesiones). Express frente a NestJS con un argumento de TFM explícito: «hace cada línea explicable en la memoria del TFM y evita ocultar conceptos (decorators, inyección de dependencias opaca) a un lector no desarrollador». La elección de stack también es una elección pedagógica: cada capa visible, sin magia.

**El Piloto** (ADR-0004): la misma filosofía porque el problema es el mismo — que el núcleo no dependa del entorno. Puertos: **frontera** (tickets), **sesiones** (lanzar papeles), **puertas** (arnés), **avisos** (escalado) y **entrega** (push o PR). «Todo lo que varía por proyecto vive en un archivo de configuración» — y ese archivo es hoy `piloto/piloto.config.json`, con su propio comentario citando el ADR.

**Que funcionó como promete** — tres recibos:

- La autenticación vivió tras un puerto desde ADR-0002; el SSO con Entra ID futuro (#46) es «un adaptador nuevo sin tocar el dominio ni la aplicación». La previsión se convirtió en mejora barata.
- El historial como agregación en consulta (ADR-0007) dejó escrito: «Nuevas funcionalidades amplían el historial añadiendo una fuente a la agregación» — y los conectores futuros (#48) son exactamente eso.
- La máquina de estados del Piloto es pura: 16 tests de núcleo, sin I/O, más 4 de loop de integración con simulación (`88b33ab`, `c8388d6`, `979baff` con modo `--simular`).

### Lenguaje tipado como contrato

El tipado hace el trabajo que de otro modo haría el revisor: `Etiquetas` y `PuertaConfig` como tipos nombrados tras el code review (`1702a2f`: «nombres honestos»); la regla de lint que ignora variables con prefijo `_` «convención de fakes» (`87ad629`); `server/test` dentro del alcance de ESLint (`c16e22b`) — los tests también son código. En un desarrollo donde el «revisor» es una sesión de IA, el compilador es el revisor barato y determinista: verifica las formas para que la revisora verifique la semántica.

### Migraciones como decisiones documentadas

El archivo de la base (`server/src/infrastructure/db/sqlite.ts`) es puro clean code con voz. Cada migración declara su política por campo con el porqué:

- `cumplido_el`: «los acuerdos ya cumplidos se quedan sin fecha (no hay referencia histórica: usar su fecha de nacimiento presentaría una fecha de cumplimiento que no lo es)».
- `registrado_por`: «un 1-to-1 se atribuye a quien gestionaba a la mentee en su fecha — reconstruido desde la cronología de traspasos», con la regla de borde documentada: «un traspaso rige desde el inicio de su fecha, así que un 1-to-1 del MISMO día pertenece al manager de DESTINO».
- `propio`: «los 1-to-1s ya registrados se quedan sin chip (no hay forma de saber si el tema era propio entonces), lo cual es lo correcto: el chip refleja cómo era el tema al registrarse».

### Diseño: tokens como única fuente de verdad

`tokens.css` es al CSS lo que el glosario al lenguaje: un solo origen de valores, con su puerta de lint (sección 1). El tema claro/oscuro funciona sin tocar componentes porque ningún componente inventa valores.

### Cómo contarlo

El hilo conductor: «cada decisión de arquitectura se tomó mirando al lector de dentro de seis meses — que resultó ser una sesión de IA sin memoria». La hexagonal no se eligió por elegancia: se eligió porque el puerto de autenticación de la semana 2 se convirtió en el SSO de la semana 8 gratis.

---

## 6. Definiciones y su importancia

### Qué pasó

La sesión de contexto fresco no pregunta: **adivina**. Y cada adivinación que resulta falsa cuesta rondas de reparación. Los tres incidentes que lo demostraron con precio:

**1. «Tarjeta 420px»** — el ADR-0012 lo cuenta: la retomada de #14 quemó sus 3 reintentos en 14 hallazgos de precisión repartidos en 4 rondas, varios presentes desde la primera (controles por debajo de 44px, `fechaRelativa` con cadenas manuales en vez de `Intl`), y el post-mortem partió la causa en dos: la revisora podía saltarse criterios en silencio, y el cuerpo no fijaba los valores que la propia revisora auditaba. La frase que resume el incidente: «la pasada gastó $2.74 en descubrir por agotamiento lo que una duda formulada a tiempo cuesta $0.25».

**2. «Mínimo 10 caracteres»** — ¿UTF-16 o puntos de código? La revisora de #24 emitió la duda en la primera línea de su tabla, el extractor la ignoró y la máquina degradó una decisión humana a un ciclo de reparación — «el humano, viendo la sesión, paró la reparadora». Resuelto por grill: carácter = punto de código Unicode, en servidor y cliente. Hoy la skill de tickets exige que **todo umbral con “hoy” o con unidades fije su unidad y quién la computa**.

**3. La DUDA que se ensanchó** — definida como «un valor», resultó estrecha: la revisora de #16 encontró un hueco de **contrato** (no de valor), emitió la definición exacta de DUDA como HALLAZGO porque un contrato no era un valor, y quemó un reintento. `0da137f`: la DUDA admite ahora «un valor o un contrato».

### La respuesta de proceso: la devolución por DUDA

ADR-0012 convirtió el hallazgo en mecanismo: cuando el cuerpo de un ticket no determina la implementación, el Piloto lo devuelve — etiqueta `needs-grill`, comentario con las dudas numeradas, aviso, fin de la pasada, **sin consumir reintentos** («no es un rojo del ticket, es un rojo del cuerpo»). La implementadora puede devolver con «DEVOLVER» antes de construir; la revisora distingue `HALLAZGO n` (defecto del diff: reparable) de `DUDA n` (dos lecturas razonables con diffs distintos: no reparable). La razón es citable: **«reparar una ambigüedad es volver a adivinar»**. El desenlace siempre es humano: un grill cuyas respuestas aterrizan en el cuerpo del issue, no solo en la conversación — porque la próxima sesión solo verá el cuerpo.

Y la regla que cierra el círculo: **el antidoto también se audita por clase entera**. `38e7e81`: el grill de la primera devolución de #31 cubrió `cumplido_el` y dejó `propio` sin definir para las filas heredadas — la regla de la clase entera aplica también al trabajo del grill.

### La lección

La ambigüedad es el enemigo número uno de un desarrollo con agentes, y su coste es medible en dólares. Las definiciones dejan de ser documentación y pasan a ser **control de coste**. Tres prácticas: definiciones verificables (unidad + quién computa), citas verbatim en los tickets («un resumen reabre la ambigüedad que la cita venía a cerrar»), y un mecanismo de salida temprana para lo que no se puede definir hoy.

### Cómo contarlo

Pregunta retórica al tribunal: «¿qué es un carácter?». Diez respuestas ningunean a la que importa: UTF-16 cuenta 2 en un emoji; los puntos de código, 1. El botón de #24 validaba contraseñas distintas según quién respondiera.

---

## 7. El git log y la bitácora

### El git log como bitácora narrativa

Los commits de este repo no dicen solo qué: dicen por qué, con qué evidencia y a qué coste. Tres verbatim:

> `997f0c9` — «config: “pantalla” vuelve a deepseek y N de 3 a 4 (decisión humana tras el examen de glm-flash: 11× más barata por sesión pero 3-4× más lenta en reloj — agotó los 45 min dentro del autochequeo; el diff de flash queda en el árbol y lo retoma deepseek)»

> `9a522d8` — «fix: el extractor lee verde un veredicto limpio sin la línea canónica “SIN HALLAZGOS” — quinta regresión de formato (#28): la revisora emitió 4×OK, la máquina inventó un rojo y quemó una reparadora contra un diff limpio; verbatim de esa ronda como test de regresión (4 tests)»

> `38e7e81` — «docs: el chequeo de migración declara su política por CADA campo que añade la migración, no solo el que la DUDA nombró (segunda devolución de #31: el grill cubrió cumplido_el y dejó propio sin definir — la regla de la clase entera aplica también al trabajo del grill)»

Cualquier afirmación del TFM se puede rastrear a su commit. **Cero PRs**: el modo de entrega es push directo a main (config: `"modoEntrega": "main"`), y los permisos deniegan commit/push/merge a las sesiones — los ejecuta el coordinador o el humano. La frontera máquina/humano está en la configuración, no en la costumbre.

### La bitácora cuantitativa

El Piloto registra por ticket: rondas, hallazgos, devoluciones, coste y tokens. Esa métrica es la que disparó las decisiones grandes: «la métrica por tipo que ADR-0011 creó disparó su advertencia la tercera vez» — los tres escalados por acumulación eran «pantalla», y de ahí salió ADR-0013. Y también la que vigila conductas: «una revisora que esquivara veredictos marcando DUDAs, o una implementadora que devolviera por pereza, quedan a la vista» (ADR-0012). **El proceso se auditó con datos, no con impresiones.**

### Las cuatro fases de la historia

1. **Fundación** (primeros commits): arnés, glosario y ADRs 1–2 antes que código.
2. **MVP original** (#2–#10): de las sesiones interactivas al Piloto — ADRs 0003/0004, núcleo con 16 tests, adaptadores, `--simular`.
3. **Rediseño Lino** (#12 en adelante): la fase donde el proceso se templó — los ADRs 0006 a 0013 son cada uno la respuesta a un incidente fechado.
4. **Cierre**: congelación deliberada del MVP con el futuro trackerizado (tag `v1.0.0-mvp`, etiqueta `post-mvp`).

### Cómo contarlo

Scroll del git log en pantalla con zoom: «cada uno de estos títulos es una decisión con su evidencia — lo que normalmente vive en la cabeza de quien desarrolló, aquí está en el historial».

---

## 8. Testing: cómo lo hicimos y qué descubrimos gracias a él

### Cómo lo hicimos

**Cuatro puertas** (todas deterministas, todas ejecutables por separado o juntas): typecheck, lint (incluida la puerta de literales Lino), tests unitarios/integración (Vitest con SQLite temporal), E2E (Playwright contra la app construida y servida en un único puerto). 418 + 94 tests.

**El arnés de calidad** (ADR-0005) con cuatro piezas y una regla rectora: *determinista y sin red externa por defecto* — si falta un servicio, la puerta informa `SKIP`, no `FAIL`:

- **Stryker** muta solo `server/src/domain` — «porque ahí es donde viven las invariantes» — con umbral `break: 85`. La justificación es arquitectural: en adaptadores «la relación mutante↔invariante es débil».
- **SonarQube** con `@sonar/scan` (autoaprovisiona el JRE) y el quality gate en espera.
- **OpenTelemetry** con exportador en memoria/consola por defecto.
- **Sentry** activo solo si hay DSN — sin DSN es un no-op que no rompe el determinismo.

### Qué descubrimos gracias a él

**1. La contaminación de la base compartida.** En la ronda 2 de #23, un test restauró «a medias» — las asignaciones pero no sus eventos, ni el proyecto retirado — y el spec siguiente heredó una base sucia. Regla nacida: «toda mutación que haga una prueba se revierte completa antes de terminar o la prueba usa solo datos creados por ella». (`499e9ff`)

**2. El control optimista revierte al fallar.** Un checkbox de cumplimiento cambiaba antes de la respuesta; si la petición fallaba, quedaba marcado sin estarlo. Contrato: el estado del control refleja **siempre** el del servidor — revierte o espera deshabilitado. (r2 de #31, regla `1125275`)

**3. El estado deshabilitado gatea el manejador.** Un control con `aria-disabled` cuyo manejador seguía actuando: el contrato «pulsarlo no hace nada» se comprueba **en el manejador**, no solo en la clase CSS. (Clase de #28, regla `5752d55`)

**4. La cascada se verifica con computed style.** Cuando el componente compite con una regla genérica (`.campo textarea` vs su clase propia), el E2E comprueba el valor **computado**, no la clase presente — porque los valores que la spec pinta deben ganar la cascada.

**5. La matriz de acciones que vacían listas.** Toda acción que quita un elemento se cubre en E2E con el elemento en medio, el último, la lista que queda vacía — y el **destino del foco** verificado en cada caso. (Regla del 4-oct, `8bcc41e`)

**6. El autochequeo de puertas en sesión** — el descubrimiento de proceso más caro: la implementadora declaró «todas las puertas en verde» **sin ejecutarlas**, y un rojo E2E real sobrevivió a tres parches (ADR-0010). Ahora los prompts exigen correr las puertas antes de dar el diff por listo; las puertas del coordinador no cambian: «nadie declara verde, solo se evita presentar rojo».

**7. El verbatim como test de regresión.** Cada una de las cinco regresiones del extractor dejó «el formato real de esa revisora» como test (`9a522d8`: cuatro tests del verbatim de esa ronda). No se testea la regex abstracta: se testea la salida exacta que la rompió.

### La lección

El testing aquí no fue verificación posterior: fue el **mecanismo de descubrimiento** de clases de error que ninguna spec previó. Cada hallazgo de E2E con nombre propio (contaminación, optimista, foco) pasó a regla en AGENTS.md — el testing alimenta al arnés.

### Cómo contarlo

Escoge el descubrimiento 1 (contaminación): «el test que restauró a medias enseñó que un test puede mentir al test siguiente — y eso también es un bug». Es reconfortante: el testing encontró bugs del testing.

---

## 9. Los ADRs

### La tabla completa, con su detonante

| ADR | Decisión | Detonante |
|---|---|---|
| 0001 | TypeScript en todo el stack; Express hexagonal explícito frente a NestJS | Las herramientas exigidas por el máster viven en el ecosistema TS; explicar cada línea en la memoria del TFM |
| 0002 | Autenticación con semilla tras un puerto intercambiable | El SSO de Microsoft futuro debe ser un adaptador nuevo sin tocar dominio |
| 0003 | El Piloto: máquina de estados determinista; sesiones de contexto fresco; las puertas como único juez | Implementar tickets de forma autónoma con salida acotada |
| 0004 | El Piloto con núcleo tras puertos, exportable a otros repos | Que exportarlo no sea reescribirlo |
| 0005 | Arnés de calidad: Stryker solo dominio, Sonar, OTel, Sentry; `SKIP` no `FAIL` | Las cuatro piezas exigidas por el máster, sin romper el determinismo |
| 0006 | Límites no fatales: reglas `deny`, nunca `ask`; lo irreversible es del coordinador | Un `ask` mató la revisora; el hueco inverso: `--auto` podría aprobar un push |
| 0007 | Historial como vista agregada en consulta, no event store | Evitar doble escritura en cinco rutas; reversible si algún día hace falta |
| 0008 | Proyectos muchos a muchos; muere «Cambio de proyecto» | El dominio real: una mentee puede estar en varios proyectos a la vez |
| 0009 | 1-to-1 editable 7 días por quien lo registró | Corregir errores de transcripción sin permitir reescribir la historia |
| 0010 | Veredictos multi-hallazgo, spec en la reparación, autochequeo de puertas | Escalado de #14 (30-sep): un hallazgo por ronda, nadie corría el arnés, reparadora ciega |
| 0011 | Alcance por ticket: criterios globales acotados al diff + exclusiones nominales | Retomada de #14 (1-oct): ~5 de 9 hallazgos eran artefactos de alcance |
| 0012 | Devolución por DUDA y veredicto por criterio | Segundo escalado de #14 (1-oct): $2.74 por agotamiento vs $0.25 de duda a tiempo |
| 0013 | Modelos por tipo de ticket | La métrica dispara: los tres escalados por acumulación son «pantalla» |

### El patrón ADR-por-incidente

Nada de esto se diseñó a priori: los ADRs 0006, 0010, 0011, 0012 y 0013 son **la respuesta documentada a fallos reales con fecha**. Y la práctica que más sorprende: **se ajustan, no se reescriben**. El ADR-0012 acumula sus cinco ajustes fechados dentro del propio documento — la negrita del 2-oct tarde, el guion largo del 2-oct noche, las listas numeradas del 3-oct, la reagrupación del 4-oct, el verde sin línea canónica del 5-oct — cada uno con su evidencia y su fix doble (extractor tolerante + prompt canónico + verbatim como test).

### La mitad valiosa: las opciones consideradas

Cada ADR registra lo rechazado con su porqué: el LLM coordinador («no reproducible ni depurable»), la sesión persistente («justo la memoria compartida y la autoevaluación que hay que evitar»), subir N («cada ronda son dos sesiones»), reutilizar `needs-info` («miente sobre la acción esperada»), dividir front/back («parte pantallas por capa y crea contratos entre tickets»). Y los planes B con condición de activación (sonnet-5.5, qwen-flash en ADR-0013). **Las opciones consideradas son las que evitan re-argumentar lo ya argumentado.**

### Cómo contarlo

Una slide con la columna «detonante»: «cada ADR de la serie 10–13 nació de un ticket concreto que se quemó — la arquitectura del proceso se escribió en respuesta a la realidad, no al revés».

---

## 10. El glosario (CONTEXT.md)

### Qué es

34 términos en dos lenguajes deliberadamente separados: **dominio JTM** (18: Manager, Mentee, Traspaso, Historial, 1-to-1, Edición, Cambios, Tema, Acuerdo, Proyecto, Entrada en proyecto, Salida de proyecto, Incidencia, Objetivo, Equipo, Necesita atención, Plantilla de 1-to-1, Contraseña temporal) y **lenguaje del Piloto** (16: Piloto, Frontera, Puerta, Verde, Rojo, Hallazgo, Duda, Reintento, Escalado, Devolución, Pasada, Retomada, Alcance, Sesión de contexto fresco, Sesión huérfana, Sonda). La separación es explícita: el segundo «nombra las piezas del propio desarrollo, no del producto».

### El hallazgo de forma: definición + lista «evitar»

Cada término trae sus sinónimos prohibidos: Manager no «jefe, supervisor, usuario»; Hallazgo no «error de revisión, issue»; Traspaso no «transferencia, reasignación». La razón es mecánica, no estética: **el sinónimo es el germen del malentendido** — si dos sesiones nombran lo mismo con palabras distintas, tarde o temprano lo interpretan distinto, y esa deriva es invisible hasta que cuesta una ronda.

### El glosario es un contrato que la máquina verifica

- `docs/agents/domain.md` ordena a toda skill usar el término del glosario en cualquier output, y trata un concepto ausente como señal: «o estás inventando lenguaje que el proyecto no usa, o hay un hueco real».
- Los tickets citan verbatim; la revisora audita contra el copy exacto.
- Cuando el dominio cambió, el glosario cambió con él y con su ADR: ADR-0008 mató «Cambio de proyecto» e hizo nacer «Entrada en proyecto»/«Salida de proyecto»; ADR-0009 trajo «Edición» y «Cambios». Y dejó constancia de lo que **no** entra: «la palabra interna “Asignación” queda fuera del glosario (no aparece en la UI)».

### Definiciones (sección 6) y glosario son la misma lección a dos alturas

La definición exacta evita la adivinación **dentro de un ticket**; el glosario la evita **en todo el proyecto**. Es DDD en su versión más operativa: lenguaje compartido, escrito, con sinónimos prohibidos, entre humano y máquina — donde «compartido» significa literalmente «lo que ambas partes pueden leer».

### Cómo contarlo

Muestra dos entradas del glosario y su lista «evitar»: «le di al modelo un diccionario con antónimos prohibidos — y desde entonces, cuando una sesión dice “reasignación” en vez de “traspaso”, ya sé que va a equivocarse».

---

## 11. El loop en el workflow

### El micro-loop: el ciclo de un ticket

```
frontera (issues ready-for-agent, desbloqueados)
  │
  ▼
implementadora ──── contexto fresco: SOLO el cuerpo del ticket
  │  · autochequea las puertas antes de presentar el diff
  │  · puede DEVOLVER con dudas numeradas (antes de construir)
  ▼
revisora ────────── contexto fresco: el diff + estándares + spec
  │  · una línea por criterio: «CRITERIO n: OK / HALLAZGO — / DUDA —»
  │  · TODOS los hallazgos en una sola respuesta (ADR-0010)
  ▼
¿verde? ─── sí ──► push, cierre del issue con resumen ──► siguiente ticket
  │ no (hallazgos o dudas)
  ▼
reparadora ──────── contexto fresco: ticket + error + hallazgos enteros
  │  · repite hasta N=4 reintentos (cada rojo consume uno, sea cual sea su origen)
  ▼
agotados N ──► ESCALADO: etiqueta ready-for-human, comentario con el último
               error, aviso — y la pasada SE DETIENE (un solo frente abierto)
duda de spec ─► DEVOLUCIÓN: etiqueta needs-grill, dudas numeradas,
               NO consume reintentos; el diff queda en el árbol
                   └──► grill humano → antidotos al CUERPO del issue
                        → ready-for-agent → la retomada lo recoge
```

**Las reglas duras**: nadie se autoevalúa («la independencia se compra con sesiones nuevas, no con mejores instrucciones»); las puertas son el único juez («ningún LLM puede declarar verde ni refutar el veredicto de una puerta»); el escalado detiene la pasada («un escalado suele señalar algo sistémico… y deja al humano un solo frente abierto»); la devolución no consume («el reintento no compra nada que el humano no tenga que dar de todos modos»).

### El macro-loop: el ciclo de una jornada

```
  (mañana)  revisar la frontera ── grill a los tickets ambiguos
     │
     ▼
  pasadas del Piloto (npm run piloto) con supervisión en vivo
     │        · piloto-supervision: firmas de fallo conocidas, protocolo de incidencias
     ▼
  incidencias: escalado o devolución ── un solo frente abierto para el humano
     │
     ▼
  (tarde)  cierre de jornada (piloto-cierre-jornada):
     1. recoger la evidencia de los tickets del día
     2. clasificar CADA error: ¿clase conocida o clase nueva?
     3. clase nueva → destilar el guardarraíl:
          PUERTA determinista primero, luego regla en AGENTS.md, luego skill
     4. proponer el bundle al humano → su OK
     │
     ▼
  (mañana siguiente) las clases nuevas ya son conocidas
```

El macro-loop es donde el proyecto aprende: cada jornada o cierra tickets o destila reglas — nunca sale vacío. Y el orden de destilado es deliberado: «puerta determinista primero» (sección 1) — la forma más dura de contrato que existe en el repo.

### Las cinco propiedades que hacen funcionar el conjunto

1. **La asimetría**: solo las puertas firman verde; un LLM solo puede forzar rojo.
2. **Salidas acotadas**: N=4, escalado que detiene, devolución que no quema. El bucle siempre tiene salida y nunca se auto-alimenta indefinidamente.
3. **Contexto fresco siempre**: cero memoria heredada entre sesiones; todo lo que una sesión sabe está en el repo.
4. **El bucle aprende, no el modelo**: lo que acumula valor entre jornadas es el repo (reglas, skills, ADRs), no las sesiones.
5. **El humano en sus dos puntos exactos**: definir con precisión (grill) y decidir qué aprender del error (cierre de jornada). En medio, la máquina ejecuta y las puertas juzgan.

### Cómo contarlo

Dibuja los dos bucles como dos engranajes: el micro gira muchas veces al día y no aprende; el macro gira una vez al día y solo hace eso. «El micro produce tickets cerrados; el macro produce reglas. Lo que no se destila, se repite».

---

## 12. Los cinco puntos con más fuerza narrativa — expandidos

### 12.1 «El arnés, no el prompt» — la tesis del TFM

**La historia**: empezó con la intuición de que los agentes necesitan más que prompts: necesitan reglas, procedimientos, permisos y jueces. El repo se construyó al revés (arnés antes que producto). Cada clase de error recurrente se empujó por la jerarquía: prompt → regla en AGENTS.md → puerta determinista. El día que los literales CSS pasaron de hallazgo de revisión a fallo de lint (486c00b), la clase murió: 52 literales citados, cero hallazgos desde entonces.

**La cifra**: la categoría que más ardió en tres tickets (#17, #18, #20) hoy no puede arder — es fallo determinista de la puerta más barata del arnés.

**El cierre**: «la fiabilidad no se pide, se construye — y en este repo se construyó con archivos, permisos y puertas».

### 12.2 «La ambigüedad cuesta dólares»

**La historia**: la retomada de #14 quemó 3 reintentos en hallazgos de precisión; el post-mortem encontró specs que no fijaban lo que la revisora auditaba. $2.74 contra $0.25. La respuesta fue inventar una salida del ciclo: la devolución por DUDA — el ticket vuelve al humano sin quemar reintentos, porque «reparar una ambigüedad es volver a adivinar».

**La anécdota**: «mínimo 10 caracteres» — UTF-16 o puntos de código; el extractor ignoró la duda de la revisora y la máquina convirtió una decisión humana en un ciclo de reparación; el humano paró la reparadora viendo la sesión.

**El cierre**: «en un desarrollo con agentes, escribir bien no es comunicación — es control de coste».

### 12.3 «Nadie se autoevalúa»

**La historia**: las tres sesiones (implementadora, revisora, reparadora) son de contexto fresco y de un solo papel; ninguna hereda memoria de otra. El coordinador no es un LLM: es una máquina de estados TypeScript — «un LLM coordinador habría sido la vía obvia, pero su comportamiento no sería reproducible y no podría narrarse transición a transición en la memoria del TFM». Y la asimetría: la revisión puede forzar rojo, «pero ningún LLM puede declarar verde ni refutar el veredicto de una puerta».

**El contraste que lo hace memorable**: la sesión persistente que implementa, revisa y repara fue descartada por «más barata en tokens, pero es justo la memoria compartida y la autoevaluación que hay que evitar».

**El cierre**: «la independencia no se promete, se compra — con sesiones nuevas».

### 12.4 «Cinco regresiones del extractor» — el formato también es contrato

**La historia**: el ciclo depende de que la máquina lea los veredictos de la revisora. Cinco veces el formato varió y el extractor falló — cada una con fecha, issue y forma:

1. **2-oct tarde**: negritas markdown alrededor de la palabra clave — el extractor cayó al fallback y la reparadora recibió criterios OK como si fueran el hallazgo.
2. **2-oct noche**: «CRITERIO n: DUDA — …» con guion largo — una decisión humana degradada a ciclo de reparación.
3. **3-oct**: listas numeradas y anotaciones parentéticas — dos DUDAs tragadas.
4. **4-oct**: la revisora **reagrupó** los criterios en bloques propios — el extractor al borde del párrafo corrido.
5. **5-oct**: la inversa — la revisora emitió 4×OK **sin** la línea canónica «SIN HALLAZGOS», el extractor no encontró nada, y la máquina **inventó un rojo contra un diff limpio**: $1.38 y 18 min quemados. N=4 absorbió el golpe — con N=3, un diff correcto habría escalado.

**El doble fix, cinco veces**: regex tolerante (el formato real de esa revisora como test de regresión) + prompt canónico endurecido («el extractor lee líneas, no prosa»). La quinta dejó además una lección de supervisión: la narración del coordinador truncaba el hallazgo a media palabra — «cuando algo no cuadre, lee el veredicto completo».

**El cierre**: «cada defecto del proceso se reparó con un test, no con una promesa — y el formato de salida de un modelo es tan contrato como un tipo de datos».

### 12.5 «El modelo premium salía más barato (y aun así perdió)»

**La historia**: la tarificación con tokens reales reveló que una sesión es 98% lectura de caché (24.3M vs 0.4M en #22) y que deepseek cobra la caché a precio completo — así que el modelo premium (sol-pro, caché a $0.10/M) salía un 27% más barato por sesión. Pero #25 cerró con sol-pro por $11.87, el ticket más caro del paquete: el coste por sesión no es el coste por resultado. Luego la candidata ultrabarata (glm-flash) prometía $1.43 por sesión de ~60M de caché — y agotó los 45 minutos del autochequeo: el reloj también es un coste. El carril volvió al modelo original, deepseek — ahora con evidencia, y con N=4 para absorber lo que el formato inventara.

**El detalle que remata**: la revisora, el papel más fiable del ciclo, cuesta $0.03–0.08 por revisión y nunca se enruta aunque arda el carril: «su problema no es de calidad sino de formato de salida».

**El cierre**: «elegimos modelos como ingenieros, no como aficionados: por papel, con datos, y documentando también a los perdedores — con su condición de retorno».

---

## Tabla de verificabilidad — cada afirmación, su fuente

| Afirmación | Dónde auditarla |
|---|---|
| «El arnés se construyó antes que la app» | Primeros 5 commits del log (86cf989…6a1b626) |
| «Los literales pasaron a fallo de lint» | `486c00b`, `scripts/lino-literal.mjs` |
| «Un ask mató una sesión; push denegado a sesiones» | ADR-0006, `opencode.json`, `b8ec29d` |
| «98% de la sesión es caché» | ADR-0013 (tokens de #22: 24.3M / 0.4M) |
| «Sol-pro salía 27% más barato y #25 costó $11.87» | ADR-0013, `ce2b8c8`, `1d66979` |
| «glm-flash agotó los 45 min» | `997f0c9`, `piloto.config.json` (`tiempoMaxMinutos: 45`) |
| «$2.74 vs $0.25» | ADR-0012 |
| «La DUDA se ensanchó a valor o contrato» | `0da137f`, ADR-0012 (ajuste 2-oct) |
| «Las cinco regresiones del extractor» | ADR-0012 (ajustes fechados 2→5 oct), `451715e`, `9a522d8` |
| «Nadie se autoevalúa; nadie declara verde» | ADR-0003 |
| «La clase se repara entera» | AGENTS.md, `1125275`, `38e7e81` |
| «La migración declara política por campo» | `server/src/infrastructure/db/sqlite.ts` (comentarios por migración), `38e7e81` |
| «La contaminación de base compartida» | `499e9ff`, AGENTS.md (regla E2E sin contaminación) |
| «Stryker solo al dominio porque ahí viven las invariantes» | ADR-0005, `server/stryker.config.mjs` |
| «0 PRs; push directo con permisos deny» | `gh pr list` vacío, `piloto.config.json` (`modoEntrega: main`), ADR-0006 |
| «Las skills vendored y las propias» | `.agents/skills/` (24), `.opencode/skills/` (2), `341c15a`, `5752d55` |
| «El glosario: definición + evitar» | `CONTEXT.md`, ADR-0008 (muere «Cambio de proyecto»), `docs/agents/domain.md` |
| «La congelación y el futuro» | Tag `v1.0.0-mvp`, README, issues con etiqueta `post-mvp` |

Esta tabla es la defensa ante la pregunta más probable del tribunal: *«¿y todo esto dónde se ve?»*. Respuesta: en el repo, a un commit de distancia.
