# OpenCode v2: sesiones, permisos y procesos — lo que la primera pasada real nos enseñó

Investigación empírica + fuentes primarias, realizada el 2026-09-27 durante la primera pasada real del Piloto (issue #11, paso 4). Cada afirmación lleva su fuente: la documentación de OpenCode v2 o una verificación local (sonda, log o repro). Contexto: la pasada sufrió tres incidentes — `spawn opencode ENOENT`, muerte de la revisora por un permiso, y muerte del coordinador con la sesión viva — y este documento recoge la mecánica que los explica.

## 1. Las sesiones viven en el servicio, no en el proceso que las lanzó

OpenCode v2 es cliente-servicio: un servicio en segundo plano es el dueño de las sesiones, la configuración, los permisos y la ejecución de herramientas; los clientes (TUI, app de escritorio, `opencode run`) solo se conectan a él. [Fuente: docs de OpenCode v2, arquitectura general.]

**Verificado localmente**: la implementadora del #10 siguió corriendo dentro del servicio y terminó con éxito (`"outcome":"succeeded"`, 132 mensajes) después de que el proceso `node` del Piloto — padre del CLI que la había lanzado — muriera con todo su árbol. El CLI `opencode run` es un cliente desechable que recolecta la salida; el bucle del agente no vive en él.

**Consecuencia operativa**: la vida de una sesión NO se mide con la lista de procesos. Se mide en el almacén del servicio (`~/.local/share/opencode/opencode.db`, tablas `session_v2` y `session_message`): por título (`Piloto · papel · #ticket`), por conteo de mensajes creciendo, o por el marcador de fin (`{"outcome":"succeeded"}` en el último mensaje; para sesiones con prompt de contrato, su línea final «RESUMEN: …»).

## 2. Un «ask» mata una sesión no interactiva; un «deny» solo bloquea la operación

El modelo de permisos de v2 son reglas ordenadas `{action, resource, effect}` con efecto `allow`, `deny` o `ask`; gana la última regla que coincide. La política base de todo agente es: todo `allow`, **salvo** `external_directory` (`ask`) y las lecturas de `*.env` (`ask`). [Fuente: https://opencode.ai/v2/docs/permissions]

- `ask` en una sesión interactiva abre el diálogo de aprobación. `ask` en una sesión **no interactiva** (`opencode run` sin `--auto`) es **auto-rechazo**, y un rechazo envenena la sesión entera: «Step interrupted», exit 1. [Fuente: docs («Reject: reject it and every other pending permission request in that session») + verificado localmente: la revisora del #5 murió así por un `cd ..` que salía del repo.]
- `deny` configurado **bloquea la operación y la sesión continúa**: el modelo recibe el error («Permission denied») y sigue trabajando. [Verificado con sonda: un `run` sin `--auto` con `cd ..` respondió «DENEGADO» y terminó bien.]
- `--auto` aprueba los permisos **no denegados explícitamente**: cualquier `ask` pendiente en una sesión con `--auto` se convierte en aprobación silenciosa. [Fuente: `opencode run --help` v2.0.18.]

**Consecuencia operativa**: los límites de una sesión no interactiva se expresan como reglas `deny` (frontera no fatal), nunca confiando en que un `ask` la frene (la mata) ni en que `--auto` la respete (la aprueba). Así se decidió en ADR-0006.

## 3. Directorios externos y shell en Windows

- Salir del directorio del proyecto (`cd ..` y similares) dispara el permiso `external_directory` antes de ejecutar el comando. Un `deny` global sobre esa acción encierra todas las sesiones del proyecto dentro del repo. [Fuente: docs de permisos, sección Directories.]
- En Windows, `npm install -g` no pone un `.exe` en el PATH: pone shims (`.cmd`, `.ps1` y un script sh sin extensión). Un `spawn` **sin shell** de Node solo ejecuta binarios PE reales: `spawn('opencode')` → `ENOENT`; el `.cmd` explícito → `EINVAL` (Node ≥ 20.12/18.20, parche de CVE-2024-27980). Bash interactivo sí ejecuta el shim sin extensión — por eso los humos manuales pasaban y el Piloto no. [Verificado con matriz de sondas `spawnSync`.]
- El paquete `@opencode/cli` sí incluye un `.exe` real (`node_modules/@opencode/cli/bin/opencode.exe`); apuntar la configuración a él resuelve el spawn sin shell. La ruta es estable entre versiones (no incluye el número).
- El shell de cada sesión no persiste el cwd entre llamadas: cada comando arranca en la raíz del proyecto. Los modelos tienden a asumir lo contrario (fue la causa inmediata del `cd ..` de la revisora).

## 4. Configuración: formato V2 y recarga

- `opencode.json` admite el array `permissions` (V2) y convive con el objeto `permission.bash` heredado (V1) por compatibilidad; el formato V2 es el recomendado y el que da orden explícito de reglas. [Fuente: https://opencode.ai/v2/docs/config y /permissions.]
- El servicio recoge los cambios de `opencode.json` **sin reiniciar**: las reglas V2 estuvieron vivas para una sesión nueva inmediatamente después de editar el archivo. [Verificado con sonda.] No rehacer la prueba al revés: reiniciar el servicio desde una sesión propia es suicida (te mata a ti y posiblemente a la pasada).

## 5. El inventario de la supervisión

Para vigilar una pasada sin tocar el árbol de trabajo:

1. **Narración**: la salida del comando `npm run piloto` (calla mientras una sesión corre — `ejecutar()` bufferea su stdout — y el silencio no es señal de cuelgo).
2. **Sesiones**: la BD del servicio, por título (`Piloto · %`). Dos muestras separadas 60 s demuestran actividad (mensajes creciendo).
3. **Frontera y entrega**: `gh issue list --state open --label ready-for-agent` (ojo: el listado con `--label` arrastra retardo del índice de búsqueda de GitHub; la API REST o el filtrado en cliente son la verdad).
4. **Procesos**: solo para confirmar la muerte del **coordinador** (`node`), nunca la de las sesiones.

## Fuentes

- Documentación de OpenCode v2: `https://opencode.ai/v2/docs/config`, `https://opencode.ai/v2/docs/permissions`, `https://opencode.ai/v2/docs/skills`.
- CLI local: `opencode run --help` (v2.0.18), verificado el 2026-09-27.
- Empírico de la primera pasada real: bitácora del issue #11 (incidentes y arreglos `621ba17`, `b8ec29d`), sondas «Sonda de diagnostico · spawn Windows sin shell» y «Sonda · external_directory tras reglas V2».

Pendiente: la causa raíz de la muerte del proceso del coordinador (matanza externa sin stack, ~15:21 del 2026-09-27) requiere los logs del servicio, legibles solo fuera de una sesión (`~/.local/share/opencode/log/opencode.log`).
