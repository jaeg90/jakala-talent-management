---
name: Writing Tickets
description: Write or edit the GitHub tickets of this repo — the «Alcance» section (Aplica a / Fuera de alcance), verbatim spec portions, scoped acceptance criteria, and declared blocking edges (ADR-0011). Use when creating, rewriting, splitting, or pre-flight-checking a ticket for the Piloto.
---

# Writing Tickets

Every ticket here is built by a fresh-context session that receives ONLY the ticket body (ADR-0003), and reviewed against that same body. The body is the whole spec the agents see: self-contained, scoped, verifiable in the diff it produces. A global criterion without a scope verdict is a burned retry (ADR-0011: pass 3 of the Lino package, ~5 of 9 findings were scope artifacts).

## Steps

1. Gather the material: the design docs the ticket touches (`docs/design/new-design/`), the parent epic, and the tickets it blocks or is blocked by.
2. Write the body from the template below. Quote the ticket's portion of the screen spec VERBATIM — the session cannot read the design doc, only the body.
3. Scope every global criterion to what the ticket builds (rule below). Where a flow's other half lives in another ticket, name that ticket by number.
4. Declare every dependency in «Bloqueado por», including implicit ones: a verification that needs another screen's state blocks on that screen's ticket.
5. Completion check, per ticket: each acceptance criterion passes or fails by looking at the diff alone, and every global criterion in play has a scope verdict in «Alcance».

## Template

```markdown
## Parent

#<epic>

## Alcance

**Aplica a:** <what this ticket adds or modifies — screens, sections, files it owns>.
**Fuera de alcance:** <what coexists: unmigrated views and their criteria (name their tickets), flows whose other half lives in another ticket (name them), shared-file exclusions (e.g. the rules styling unmigrated views)>.

**Tipo:** dominio | pantalla | transversal

## Qué construir

<The verbatim §NN portion this ticket builds, plus the connective prose from the design docs.>

## Criterios de aceptación

- [ ] <Each verifiable in the diff of this ticket; global criteria worded scoped: «valores solo de tokens.css en lo que este ticket añade o modifica».>

## Bloqueado por

- #<N>

## Bloquea a

- #<N> <only when it cuts across other work>
```

## The scoping rule: diff plus named exclusions

A global design criterion (tokens as the only visual source, the accessibility contract, accessible dates) applies to WHAT THE DIFF ADDS OR MODIFIES, plus the exclusions the ticket names:

- A legacy view mounted into its route is excluded BY NAME: «Team.tsx solo se monta en su ruta; su rediseño es #17».
- Shared files (`styles.css`) carry explicit section exclusions, or the reviewer applies global criteria to everything the diff touches.
- Real defects in what the ticket builds stay in scope: the rule excludes coexistence, never defects.

## Size

One implementación session (45 min) must be able to build the ticket. If the body holds more than one screen or more than one domain concept, split at the system's real seams (domain rules vs API vs UI bridge), and let each child declare its edges. Keep the parent's number for its natural core; children are new issues.

## Dependencies

«Bloqueado por» is parsed mechanically (`## Bloqueado por` plus `#N` in the section). Dependencies that exist only in verification still count: a seed ticket that must show a screen's state blocks on that screen's ticket even though it touches no code of it.
