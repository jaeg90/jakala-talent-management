# Documentación de dominio

Cómo deben consumir las skills la documentación de dominio de este repo al explorar el código.

## Antes de explorar, lee esto

- **`CONTEXT.md`** en la raíz del repo, o
- **`CONTEXT-MAP.md`** en la raíz si existe: apunta a un `CONTEXT.md` por contexto. Lee los que sean relevantes al tema.
- **`docs/adr/`**: lee los ADRs que afecten al área en la que vas a trabajar. En repos multi-contexto, revisa también `src/<context>/docs/adr/` para decisiones específicas de un contexto.

Si alguno de estos archivos no existe, **procede en silencio**. No señales su ausencia ni sugieras crearlos por adelantado. La skill `/domain-modeling` (accesible vía `/grill-with-docs` y `/improve-codebase-architecture`) los crea perezosamente cuando de verdad se resuelven términos o decisiones.

## Estructura de archivos

Repo single-contexto (la mayoría de los repos):

```
/
├── CONTEXT.md
├── docs/adr/
│   ├── 0001-event-sourced-orders.md
│   └── 0002-postgres-for-write-model.md
└── src/
```

Repo multi-contexto (presencia de `CONTEXT-MAP.md` en la raíz):

```
/
├── CONTEXT-MAP.md
├── docs/adr/                          ← decisiones de todo el sistema
└── src/
    ├── ordering/
    │   ├── CONTEXT.md
    │   └── docs/adr/                  ← decisiones específicas del contexto
    └── billing/
        ├── CONTEXT.md
        └── docs/adr/
```

## Usa el vocabulario del glosario

Cuando tu output nombre un concepto de dominio (en el título de un issue, una propuesta de refactor, una hipótesis, un nombre de test), usa el término tal y como lo define `CONTEXT.md`. No derives hacia sinónimos que el glosario evite explícitamente.

Si el concepto que necesitas aún no está en el glosario, es una señal: o estás inventando lenguaje que el proyecto no usa (reconsidéralo), o hay un hueco real (anótalo para `/domain-modeling`).

## Señala conflictos con ADRs

Si tu output contradice un ADR existente, señálalo explícitamente en lugar de sobrescribirlo en silencio:

> _Contradice el ADR-0007 (event-sourced orders), pero merece reabrirse porque…_
