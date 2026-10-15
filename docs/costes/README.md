# Costes medidos de las sesiones de IA

## Qué hay aquí

| Fichero | Qué contiene |
|---|---|
| `openrouter-actividad.csv` | Export de actividad de OpenRouter (colocación del humano): una fila por día y modelo, con peticiones, tokens y coste. |
| `sesiones-piloto.csv` | Una fila por sesión del Piloto: fecha, ticket, papel, modelo, mensajes, tokens por tipo y coste. Generado por el script. |
| `resumen.md` | Totales y desgloses: todas / Piloto / interactivas, por papel, por modelo, por ticket, por día y porcentaje de caché. Generado por el script. |
| `README.md` | Este fichero. |

## Cómo se generan

Dos pasos:

1. Copiar la base de sesiones de OpenCode (`opencode.db*`, en `~/.local/share/opencode/`) a `.tmp/` — la base nunca se sube al repo (`.tmp/` está ignorada).
2. `npm run costes` (es decir, `node scripts/costes-sesiones.mjs`): lee la base en solo lectura y sobrescribe `sesiones-piloto.csv` y `resumen.md`.

De las sesiones interactivas solo salen agregados, nunca títulos (pueden contener texto personal).

## Medido frente a estimado

Todo lo que hay en esta carpeta es **medido**: sale del registro que OpenCode guarda por mensaje (coste, tokens, modelo) y de la factura de OpenRouter. Las **estimaciones** (coste sin IA, horas de trabajo) están en el documento del TFM, no aquí.

## Conciliación con OpenRouter

El export de actividad de OpenRouter (`openrouter-actividad.csv`, 27-sep → 13-oct de 2026) totaliza **229,52 USD**, **1.234.446.658 tokens** y **10.771 peticiones**. Según el humano, todo el uso de OpenRouter en ese periodo es de JTM.

Por modelo (calculado del CSV):

| Modelo | Coste (USD) | % del coste | Tokens | % de tokens | Peticiones |
|---|---|---|---|---|---|
| GLM 5.3 | 91,60 | 39,9 % | 317.769.832 | 25,7 % | 2.196 |
| DeepSeek V4 Pro 0813 | 78,86 | 34,4 % | 639.634.497 | 51,8 % | 6.144 |
| GPT-6.1 Sol Pro | 42,72 | 18,6 % | 60.808.541 | 4,9 % | 494 |
| Claude Sonnet 5 | 8,14 | 3,6 % | 3.960.626 | 0,3 % | 93 |
| GPT-6 Luna Pro | 7,26 | 3,2 % | 186.927.095 | 15,1 % | 1.659 |
| GLM 5.3 Flash | 0,93 | 0,4 % | 25.325.361 | 2,1 % | 161 |
| GPT-6 Luna | 0,00 | 0,0 % | 20.706 | 0,0 % | 24 |
| **Total** | **229,52** | 100 % | **1.234.446.658** | 100 % | **10.771** |

Diferencia con el total de `resumen.md` (lo que OpenCode registra): **219,91 USD** (medición del 15-oct-2026). OpenRouter factura **9,60 USD más (un 4,4 %)**. La base incluye una sesión del 15-oct (0,59 USD) fuera de la ventana del export; en la ventana común (27-sep → 13-oct), OpenCode registra 219,33 USD frente a los 229,52 de OpenRouter: **10,19 USD (un 4,7 %)**.

Qué dicen los datos de la diferencia:

- Los huecos por día van **en ambas direcciones**: el 30-sep OpenCode registra 19,35 USD frente a 14,10 en OpenRouter; el 01-oct, 6,98 frente a 14,45. No es, pues, solo «sesiones borradas de la base local»: el coste que OpenCode registra por mensaje y el que OpenRouter factura no son la misma contabilidad (variantes del modelo, caché escrita, redondeos).
- El modelo «GPT-6 Luna» (sin Pro, 24 peticiones, 0,0025 USD) aparece **solo en el export**, sin ninguna sesión en la base local: el único resto claro de uso que la base no conserva.
- Los nombres del export corresponden a los ids de la base (GLM 5.3 = `z-ai/glm-5.3`, DeepSeek V4 Pro 0813 = `~deepseek/deepseek-pro-latest`, GPT-6 Luna Pro = `openai/gpt-6-luna-pro`, GPT-6.1 Sol Pro = `openai/gpt-6.1-sol-pro`, GLM 5.3 Flash = `~z-ai/glm-flash-latest`, Claude Sonnet 5 = `anthropic/claude-sonnet-5`).

Nota del humano: el modelo «Claude Sonnet 5» del 27-sep se usó como revisora en una primera prueba y se descartó.