---
name: Piloto Cierre de Jornada
description: End-of-journey retrospective for the Piloto supervisor — after the tickets set at the start of the day are done (closed, devueltos or escalated), collect the evidence, classify every error (known class vs new class), distill the new classes into permanent guardrails (deterministic gates first, then rules/docs/skills), and propose the bundle for the human's OK. Use when a Piloto jornada ends, or when the user asks to "review the errors and improve the guardrails".
---

# Piloto Cierre de Jornada

You are the supervisor closing a Piloto jornada (ADR-0003). The jornada had a goal stated at its start («hacer X tickets»); it ends when the frontier is empty, when every ticket of the goal has a desenlace (verde / devolución / escalado), or when the human stops the pass. The distillation below is what separates a jornada from a loop: without it, the same classes burn retries next week (evidence: tokens-only survived three rounds of #26/#27/#29 before becoming a rule).

## Hard rules

- **Nothing lands mid-pass.** The tree belongs to the implementadora during a pass; the distillation happens after the jornada ends, or it pollutes the diff of the live ticket (a config edit mid-pass is a spurious finding of the next revisora — one burned retry).
- **Every new error class lands somewhere permanent** (ADR-0011 principle): a rule, a gate, a doc, a skill, or a regression test. An antidote that lives only in the conversation is a DUDA with a due date.
- **Piloto code is incident protocol**: propose, wait for the human's OK, verify with a cheap sonda before relaunching (ADR-0006/supervision skill). You are a session: you cannot commit — hand the irreversible step to the human.
- **Verbatim is the only test data.** The revisora's actual output format is the regression test (ADR-0012: four format regressions, each absorbed by regex + prompt hardening, each with the real format as test).
- **Antídotos with escapable characters (regex, backslashes, nested quotes) are verified byte a byte against their source after landing** — never typed through escape layers (regression of #25, 5-oct: a hand-typed regex lost its backslashes and the body contradicted itself; the cheap devolución that followed was the best case).

## Steps

1. **Collect the evidence, against primary sources.** Session inventory from the service DB (`session_v2`/`session_message`, titles `Piloto · %`): costs, message counts, outcomes. **Read the full veredicto of EVERY revisora session** — the coordinator's narration truncates at 500 chars (the fallback signature: a finding cut mid-word, or one starting with «…»); the rule of 2/3-oct says this applies after every review, not only at escalados. The bitácora comments in the tracker issue (#11). Pushes and closes (`git log`, one `feat: … (#N)` per ticket).
2. **Classify every error of the day, two buckets:**
   - **Known class** — a guardrail already exists: where did it catch it? (That's the guardrail working — note the round it fired, 1–2 is healthy, serial is not.) 
   - **New class** — no guardrail covers it: this is the raw material of the distillation.
3. **For each new class, pick the cheapest permanent home, in this order:**
   1. **Deterministic gate** (lint rule, script in the harness) — the verdict nobody refutes; use when the class is mechanical (evidence: `486c00b` turned the package's most serial class, literals outside `tokens.css`, into a lint failure).
   2. **Rule in AGENTS.md or a skill** (implementadora/reparadora rules, revisora checklist) — for judgement the gates can't see (states, focus, races).
   3. **Doc fixed once for the whole package** (spec / `accesibilidad.md` / `componentes.md`) — when the ambiguity lives in the design doc (ADR-0012: fix it there once, the rest inherits).
   4. **Extractor/prompt hardening of the Piloto** — only for format regressions of the session contracts, and it's Piloto code: proposal + OK + regression test with the verbatim format.
4. **Coste the day per ticket and per class** (the métrica por tipo of ADR-0011/0013): retries, devoluciones, escalados, dollars. A class that burned ≥2 retries twice is a model/config decision, not a doc fix (the ADR-0013 trigger).
5. **Propose the bundle** to the human: one commit per kind (docs/skill vs Piloto code), each change with its evidence cited. **Wait for the OK.** Nothing of this is executed unilaterally.
6. **Publish the closing bitácora** in the tracker issue: desenlaces, the table of the day's errors → guardrails (caught vs new → home), costs, the queue of human decisions, and the prompt de arranque for the next session — the next supervisor starts from it, cold.

## The evidence map (where past distillations landed)

| Clase | Ardió en | Aterrizó en |
|---|---|---|
| Literales CSS fuera de tokens | #17/#18/#20/#26/#27/#29 | Puerta de lint (`486c00b`) + regla AGENTS.md (`6e958ad`) |
| Formato del veredicto (5 regresiones) | #38/#24/#20/#22/#28 | Regexes tolerantes + prompt canónico + recuperación de párrafo (`ce2b8c8`); verbatim como test cada vez |
| E2E que contamina la base compartida | #23 | Regla AGENTS.md (`499e9ff`) |
| Carreras asíncronas, cascada, foco tras desmontar | #22/#23/#25 | Reglas AGENTS.md (`8bcc41e`) |
| Campo nuevo sin migración | #26 ×2 | Chequeo en `writing-tickets` (`6e958ad`) |
| Antídoto transcrito roto (backslashes) | #25 | Verificación byte a byte — esta skill |

## What this skill is NOT

- Not a mid-pass tool: no distillation while a session runs.
- Not a license to touch the Piloto: the extractor/model/config changes go through proposal + human OK + sonda.
- Not a substitute for the per-review discipline: read full veredictos in the DB as they happen; this skill catches what slipped through, it doesn't replace the watch.
