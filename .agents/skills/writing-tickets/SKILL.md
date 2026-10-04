---
name: Writing Tickets
description: Write or edit the GitHub tickets of this repo — the «Alcance» section (Aplica a / Fuera de alcance), verbatim spec portions, scoped acceptance criteria, and declared blocking edges (ADR-0011). Use when creating, rewriting, splitting, or pre-flight-checking a ticket for the Piloto.
---

# Writing Tickets

Every ticket here is built by a fresh-context session that receives ONLY the ticket body (ADR-0003), and reviewed against that same body. The body is the whole spec the agents see: self-contained, scoped, verifiable in the diff it produces. A global criterion without a scope verdict is a burned retry (ADR-0011: pass 3 of the Lino package, ~5 of 9 findings were scope artifacts).

## Steps

1. Gather the material: the design docs the ticket touches (`docs/design/new-design/`), the parent epic, and the tickets it blocks or is blocked by.
2. Write the body from the template below. Quote the ticket's portion of the screen spec VERBATIM — the session cannot read the design doc, only the body. Never summarize or paraphrase the quote, however long the ticket already is: a summary reopens the exact ambiguity the quote came to close.
3. Scope every global criterion to what the ticket builds (rule below). Where a flow's other half lives in another ticket, name that ticket by number.
4. Declare every dependency in «Bloqueado por», including implicit ones: a verification that needs another screen's state blocks on that screen's ticket.
5. Completion check, per ticket: each acceptance criterion passes or fails by looking at the diff alone, and every global criterion in play has a scope verdict in «Alcance».

   **Gate check, per ticket (and per antidote):** every gate stays green with this ticket's diff ALONE. If the diff substitutes a contract consumed outside «Alcance» (a route, a response shape, a schema under live views, a function another ticket shares), the body names how those consumers keep passing — thin adapters keeping the old routes and shapes, or the ticket that reconnects them. The opposite is a deferred DUDA (ADR-0012): a gate that goes red with this diff alone will be found mid-pass, when it costs a devolución. The check applies also to every antidote that lands in a body after a grill: an antidote without its own gate check is a devolución with a date.

   **Migration check, per ticket:** a ticket that adds a field to a model (or any persisted shape) declares the migration of the existing data — where the value comes from for rows that already exist, or «no existing data» if the store is new. An added field without a declared migration is a deferred DUDA (evidence: #26, 5-oct — two devoluciones on `en_equipo_desde` before the body said where old rows' dates came from).

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

## The precision rule: fix the values the revisora will audit

The revisora audits the diff against the body AND the repo's design docs (`componentes.md`, `accesibilidad.md`, `tokens.css`), criterion by criterion (ADR-0012). Any value those docs fix that the body doesn't quote is a finding waiting for its round — or a DUDA if two readings are reasonable:

- Quote verbatim the component rows the ticket builds (padding, gaps, sizes, states) and the accessibility contract rows it must satisfy (touch targets, ARIA, copy).
- A global value that applies here (e.g. the 44px minimum touch target on mobile) is named in the criteria, scoped as always.
- If the design docs and the screen spec disagree (§01 fixes the login card at 20px radius; tokens say cards are 16px), the body adjudicates — or the ticket is a DUDA from round one. Don't ship a contradiction.

The values the body fixes include the **public contracts other tickets consume**. When an edge between tickets transports a contract (a route, a response shape, a schema under live views, an event), the body of the ticket that builds it fixes it with exact names: route, verb, response code, request and response bodies with their field names — anchored to the repo's existing pattern («como `POST /api/plantilla/temas/:id/retirar`») so the session inherits the style instead of guessing it. «Consumes the API of #N» without the shape fixed in #N's body is a DUDA with a due date. When two tickets share a data transformation (a projection, an aggregation, a format), the first body names the piece it delivers (type and signature) and the second declares consuming it — «the other half lives in the other ticket» applies to functions, not only to screens.

**A repo-state quote is a verifiable claim, not context.** «X already exists in `main`», «flow Y lives in Z»: verify it against the code at the moment of writing it, never from memory — the same discipline as a spec value. An antidote with a wrong repo quote is worse than a gap: it closes the ambiguity with the wrong answer and the session implements it with confidence.

**Every threshold or comparison with «hoy» (today) fixes its unit.** Timezone and who computes it — a single source of truth for the decision (who calculates), separate from who renders. Three date systems silently mixing around a 14-day threshold (server UTC, browser local, E2E-relative fixtures) is the twin of the character-count ambiguity (UTF-16 vs code points): one domain value, two reasonable units, two different diffs. The E2E fixtures say which timezone they build their dates in, so a threshold doesn't dance around midnight.

**When a ticket extends work built by an earlier ticket and cites design docs, adjudicate the doc against what was built.** If they diverge, the body says which one rules and what this ticket extends — a fresh-context session that finds doc ≠ code with no adjudication has two reasonable readings, the exact definition of a DUDA.

## Size

One implementación session (45 min) must be able to build the ticket. If the body holds more than one screen or more than one domain concept, split at the system's real seams (domain rules vs API vs UI bridge), and let each child declare its edges. Keep the parent's number for its natural core; children are new issues.

## Dependencies

«Bloqueado por» is parsed mechanically (`## Bloqueado por` plus `#N` in the section). Dependencies that exist only in verification still count: a seed ticket that must show a screen's state blocks on that screen's ticket even though it touches no code of it.
