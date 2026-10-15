# El Piloto

El Piloto es el orquestador **determinista** del proceso: una máquina de estados en TypeScript (no un LLM) que coge tickets de GitHub Issues y los hace implementar, revisar y reparar por sesiones de IA de contexto fresco, con las puertas del arnés como único juez. El Piloto no decide: decide el núcleo puro, y los efectos los ejecutan adaptadores detrás de puertos (ADR-0003, ADR-0004).

## Cómo funciona

El ciclo de un ticket: la frontera (tickets abiertos con la etiqueta de lista y sus bloqueos resueltos) → la **implementadora** construye sobre el árbol de trabajo, sin commitear → la **revisora** audita el diff criterio a criterio → las **puertas** del arnés juzgan → en verde: entrega (push y cierre del issue); en rojo: la **reparadora** recibe el error en mano y el parche vuelve a revisión, hasta N reintentos; agotados, el ticket se **escala** al humano y la pasada se detiene. Una **DUDA** (un valor que el cuerpo del ticket no determina) devuelve el ticket al humano con la etiqueta de devolución, sin consumir reintentos (ADR-0012).

- Ninguna sesión se autoevalúa: la implementadora nunca declara su propio verde.
- Solo las puertas firman verde: ningún LLM juzga el resultado (ADR-0003).
- Contexto fresco en cada sesión: la revisora no hereda nada de la implementadora; cada papel recibe el ticket y el error, no la conversación (ADR-0010).
- Toda pasada tiene salida: N reintentos, escalado que detiene, y devolución por DUDA que no consume reintentos (ADR-0012).

## Arquitectura

| Fichero | Responsabilidad |
|---|---|
| `src/domain/model.ts` | Tipos del núcleo: fases, tickets, pasada, eventos y comandos. Puro, sin I/O. |
| `src/domain/maquina.ts` | El núcleo: máquina de estados que decide, narra y ordena comandos. Sin I/O. |
| `src/domain/ports.ts` | Los cinco puertos que separan el núcleo del mundo (ADR-0004). |
| `src/application/pasada.ts` | El loop: ejecuta los comandos del núcleo contra los puertos y devuelve los eventos. Ninguna decisión vive aquí. |
| `src/infrastructure/gh.ts` | Adaptador de frontera: GitHub Issues vía `gh` CLI. |
| `src/infrastructure/opencode.ts` | Adaptador de sesiones: `opencode run`, un papel por llamada, un modelo por papel; prompts y extractores de los contratos (RESUMEN, CRITERIO, HALLAZGO, DUDA, DEVOLVER). |
| `src/infrastructure/npm.ts` | Adaptador de puertas: ejecuta el arnés de la configuración en orden; la primera en rojo gana. |
| `src/infrastructure/git.ts` | Adaptador de entrega: push a main o rama + PR con squash-merge, según `modoEntrega`. |
| `src/infrastructure/avisos.ts` | Adaptador de avisos: consola siempre, webhook opcional; el aviso nunca falla la pasada. |
| `src/infrastructure/config.ts` | Carga y valida `piloto.config.json`; `PILOTO_OPENCODE` sobrescribe el binario. |
| `src/infrastructure/procesos.ts` | Ejecución de procesos con timeout y captura de salida. |
| `src/infrastructure/simulacion.ts` | Puertos simulados con guión: el mismo contrato, sin GitHub, sin sesiones, sin arnés. |
| `src/infrastructure/escenarios.ts` | Escenarios de simulación prefabricados y `elegirModo` para la línea de comandos. |
| `src/main.ts` | El comando: elige modo, carga la configuración y arranca la pasada. |

Los cinco puertos (`src/domain/ports.ts`), con el adaptador que hoy los implementa:

- `frontera` (el tracker) — `gh.ts`, GitHub Issues vía `gh` CLI.
- `sesiones` (los papeles de IA) — `opencode.ts`, `opencode run` con un modelo por papel.
- `puertas` (el juez) — `npm.ts`, los comandos del arnés de la configuración.
- `avisos` (el canal hacia el humano) — `avisos.ts`, consola siempre, webhook opcional.
- `entrega` (el push) — `git.ts`, push a main o rama + PR con squash-merge según `modoEntrega`.

## Probarlo sin instalar nada (simulación)

Los mismos seis comandos, sin `gh`, sin OpenCode, sin claves y sin arnés: ensayan el loop contra puertos simulados.

| Comando | Descripción del escenario | Qué mirar en la salida |
|---|---|---|
| `npm run piloto -- --simular=feliz` | Todo en verde: la revisora no encuentra nada y las puertas pasan; la pasada cierra la frontera entera. | La narración recorre #4 → #5 → #6 → #7 → #8 y cierra cada uno. |
| `npm run piloto -- --simular=reparacion` | La revisora encuentra un hallazgo en el primer ticket; la reparadora lo arregla y el ticket vuelve a revisión hasta el verde. | El «CRITERIO 2: HALLAZGO», la reparadora del reintento 1, y el verde a la segunda revisión. |
| `npm run piloto -- --simular=puerta-roja` | La revisora da el OK pero una puerta del arnés falla: solo las puertas firman verde, así que entra la reparadora. | El rojo de la puerta `e2e` tras una revisión limpia, y la reparadora. |
| `npm run piloto -- --simular=escalado` | El hallazgo se repite en cada ronda: se agotan los reintentos, el ticket se escala al humano y la pasada se detiene. | Los 4 reintentos, la etiqueta `ready-for-human` en #4 y el «Me detengo». |
| `npm run piloto -- --simular=devolucion-revisora` | La revisora encuentra una ambigüedad en la spec: el ticket vuelve al humano (needs-grill) sin consumir reintentos. | La duda de la revisora, la etiqueta `needs-grill` en #4 y la pasada detenida sin reparaciones. |
| `npm run piloto -- --simular=devolucion-implementadora` | La implementadora detecta la ambigüedad antes de construir y devuelve el ticket sin gastar revisión ni reintentos. | La devolución antes de cualquier revisión, y la etiqueta `needs-grill` en #4. |

`npm run piloto -- --simular` (sin nombre) equivale al escenario `feliz`. Un nombre desconocido termina con código 1 y la lista de escenarios.

## Ejecutarlo de verdad

Requisitos:

- OpenCode CLI instalado, con un proveedor de modelos configurado (en este proyecto, OpenRouter) y acceso a los modelos de `piloto.config.json`.
- `gh` autenticado, con permisos sobre el repo (leer issues, etiquetar, comentar, cerrar).
- Las tres etiquetas de la configuración creadas en el repo (`ready-for-agent`, `ready-for-human`, `needs-grill`).
- Árbol de trabajo limpio, en `main`.
- `opencode.json` con los `deny` del ADR-0006 (las sesiones no pueden commitear ni empujar).

**Windows:** define `PILOTO_OPENCODE` con la ruta completa al `.exe` de OpenCode. El `spawn` de Node sin shell no resuelve los shims `.cmd` de npm y necesita el binario real.

```powershell
# PowerShell
$env:PILOTO_OPENCODE = "$env:APPDATA\npm\node_modules\@opencode\cli\bin\opencode.exe"
```

```bash
# Git Bash
export PILOTO_OPENCODE="$APPDATA/npm/node_modules/@opencode/cli/bin/opencode.exe"
```

El comando es `npm run piloto`. Compila el Piloto (`tsc`), carga `piloto.config.json`, consulta la frontera con `gh`, y por cada ticket: lanza la implementadora (sesión nueva con `--auto`), luego la revisora (sesión nueva, sin `--auto`), abre las puertas, y en verde entrega — commit de lo pendiente con mensaje `feat: … (#N)` y push (modo `main`), o rama `piloto/<N>` + PR con squash-merge y vuelta a `main` actualizada (modo `rama`) — y cierra el issue. En rojo, lanza reparadoras hasta agotar los reintentos.

**Cuesta dinero**: cada sesión es una llamada a un modelo de pago. Los costes medidos de las sesiones de este proyecto van en `docs/costes/` (generados con `npm run costes` a partir de la base local de sesiones de OpenCode). [PENDIENTE: generar docs/costes — falta copiar opencode.db a .tmp/]

## Configuración

`piloto/piloto.config.json` (ADR-0004): lo que varía por proyecto; cambiarlo no es tocar código.

| Clave | Qué controla | Valor en JTM |
|---|---|---|
| `reintentos` | N de reparadoras por ticket antes de escalar | `4` |
| `modoEntrega` | Cómo llega el diff validado al repo: `main` (commit + push) o `rama` (rama propia + PR + squash-merge + vuelta a main) | `"main"` |
| `modelos.implementadora` | Modelo de la implementadora: cadena única o por tipo de ticket | `deepseek-pro-latest` por defecto y para `pantalla` |
| `modelos.reparadora` | Modelo de la reparadora: cadena única o por tipo de ticket | `deepseek-pro-latest` por defecto y para `pantalla` |
| `modelos.revisora` | Modelo de la revisora (cadena única) | `openai/gpt-6-luna-pro` |
| `sesiones.comando` | El binario de OpenCode que ejecutan las sesiones; sobrescribible con `PILOTO_OPENCODE` | `"opencode"` |
| `sesiones.tiempoMaxMinutos` | Tiempo máximo por sesión | `45` |
| `puertas` | El arnés: nombre y comando de cada puerta, en orden | `typecheck`, `lint`, `tests`, `e2e` |
| `etiquetas` | Las tres etiquetas del tracker: lista, escalado y devolución | `ready-for-agent`, `ready-for-human`, `needs-grill` |
| `aviso` | El canal de aviso al humano: `consola` o `webhook` | `{ "tipo": "consola" }` |

## Reutilizar el Piloto en otro proyecto

El Piloto no depende del stack del proyecto: las puertas son comandos de shell que salen con código 0 en verde (`npm test`, `mvn verify`, `pytest`, `dotnet test`…). Depende de **GitHub** (frontera) y de **OpenCode** (sesiones), y ambos están detrás de puertos.

1. Copia `piloto/` al repo destino y añádelo a `workspaces`, o úsalo como paquete aparte con su `package.json`. Requiere Node.js 24 y TypeScript.
2. Ajusta `piloto.config.json`: las puertas del proyecto destino, las etiquetas, los modelos por papel, los reintentos, el modo de entrega y el tiempo máximo por sesión.
3. Crea las etiquetas en GitHub con `gh label create ready-for-agent`, `gh label create ready-for-human` y `gh label create needs-grill` (las tres de la configuración).
4. Copia las reglas `deny` de `opencode.json` y su puerta `piloto/test/permisos.test.ts` (ADR-0006).
5. Prepara el contexto que leen las sesiones: los prompts de `piloto/src/infrastructure/opencode.ts` citan `AGENTS.md`, `CONTEXT.md` y `docs/adr`. El proyecto destino debe tenerlos, aunque empiecen mínimos.
6. Escribe los tickets con la skill `writing-tickets` (sección «Alcance» y criterios numerados), porque la revisora emite un veredicto por criterio.
7. Prueba primero con `--simular`, y después con **un** ticket pequeño supervisado con la skill `piloto-supervision`.

| Pieza | Cómo se reutiliza | Esfuerzo |
|---|---|---|
| Núcleo (`domain/`) y bucle de la pasada (`application/`) | Tal cual: máquina de estados pura, sin nada de JTM | Ninguno |
| Extractor de veredictos y contratos de salida (CRITERIO / HALLAZGO / DUDA / RESUMEN) | Tal cual: regexes y prompts, sin nada específico de JTM | Ninguno |
| Simulación (`simulacion.ts`, `escenarios.ts`) y sus tests | Tal cual | Ninguno |
| Puertas, etiquetas, modelos, N y tiempo máximo | Por configuración (`piloto.config.json`), sin tocar código | Ajustar valores |
| Prompts de las sesiones (`opencode.ts`) | Editando texto: están en español y citan las convenciones del repo | Traducir/ajustar |
| Guardarraíles de `AGENTS.md` | Específicos de JTM; en otro proyecto nacen de sus propios incidentes, con la skill `piloto-cierre-jornada` | Escribir los propios |
| Otro tracker (Jira, GitLab, Azure DevOps) | Adaptador nuevo del puerto `frontera` | Un adaptador |
| Otro agente (Claude Code, Codex CLI…) | Adaptador nuevo del puerto `sesiones` | Un adaptador |
| Otro canal de aviso (Teams, Slack, email) | Adaptador nuevo del puerto `avisos` | Un adaptador |

**Lo que no se ha probado**: el Piloto solo se ha usado en este repo, en Windows con Git Bash, con GitHub (vía `gh`) y con OpenCode. Los adaptadores para otros trackers, otros agentes u otros canales de aviso no existen todavía.

## Límites conocidos

- El adaptador de avisos solo implementa `consola` y `webhook` (un POST JSON a una URL); no hay Teams, Slack ni email.
- La revisora corre sin `--auto`: cualquier permiso `ask` imprevisto la mata (auto-rechazo en sesión no interactiva); todos los límites del repo son `deny` (ADR-0006, con puerta en `piloto/test/permisos.test.ts`).
- La frontera es GitHub Issues vía `gh` CLI; no hay adaptador de Jira, GitLab ni Azure DevOps.
- El extractor de veredictos depende de los formatos de salida de la revisora (líneas «CRITERIO n: …»); las regresiones de formato se han absorbido con regexes tolerantes, verbatim como test cada vez.
- La entrega en modo `rama` usa `gh pr merge --squash`; requiere `gh` autenticado con permiso de merge.
- `modoEntrega: "main"` commitea con `git add -A`: todo lo pendiente del árbol viaja en el commit del ticket (por eso el árbol debe empezar limpio).