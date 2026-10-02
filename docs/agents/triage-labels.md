# Etiquetas de triage

Las skills hablan en términos de cinco roles de triage canónicos. Este archivo mapea esos roles a las cadenas de etiqueta reales que se usan en el issue tracker de este repo.

| Rol en mattpocock/skills | Etiqueta en nuestro tracker | Significado                                   |
| ------------------------ | ---------------------------- | --------------------------------------------- |
| `needs-triage`           | `needs-triage`               | Falta evaluar este issue                      |
| `needs-info`            | `needs-info`                 | Esperando más información de quien lo reportó |
| `ready-for-agent`       | `ready-for-agent`            | Especificado por completo, listo para un agente autónomo |
| `ready-for-human`       | `ready-for-human`            | Requiere implementación humana               |
| `wontfix`               | `wontfix`                   | No se va a abordar                           |

Cuando una skill mencione un rol (p. ej. "apply the AFK-ready triage label"), usa la cadena de etiqueta correspondiente de esta tabla.

Roles locales, añadidos a los cinco canónicos porque este repo los necesita:

| Etiqueta en nuestro tracker | Significado |
| --------------------------- | ----------- |
| `needs-grill` | El cuerpo del issue no determina la implementación (ADR-0012): una sesión de contexto fresco lo devolvió con dudas numeradas. Requiere una sesión de grill con el humano; su desenlace aterriza en el propio cuerpo (antídotos, ADR-0011) y el issue vuelve a `ready-for-agent`. No es `needs-info` (la información no la trae quien reportó) ni `ready-for-human` (no requiere implementación humana). |

Edita la columna derecha para adaptarla al vocabulario que realmente uses.
