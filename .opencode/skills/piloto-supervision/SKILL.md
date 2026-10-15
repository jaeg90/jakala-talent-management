---
name: Piloto Supervision
description: Supervise a Piloto pass in this repo (npm run piloto) — pre-flight checks, live-monitoring rules, permission model, and incident protocol with known failure signatures. Use when launching, watching, or recovering a Piloto pass, or when a pass dies unexpectedly.
---

# Piloto Supervision

You are the supervisor of a Piloto pass (the deterministic orchestrator, ADR-0003). The Piloto implements; Sonnet 5 reviews; the gates decide. You only supervise and record — no code of your own unless explicitly asked.

## Facts that change everything

1. **Sessions live in the service, not in the Piloto's process tree.** The `opencode run` process is a disposable client that streams output; the agent loop runs inside the OpenCode background service. If the Piloto's node process dies mid-session, **the session keeps running** and its work keeps landing in the tree.
2. **Never judge session liveness by the process list.** Query the service database instead: `session_v2` / `session_message` in `~/.local/share/opencode/opencode.db` (SQLite, open `readOnly`), filter by title `Piloto · %`. Two samples 60 s apart (growing message count) prove activity. A finished session ends with `{"outcome":"succeeded"}` or its final «RESUMEN: …» line.
3. **An `ask` permission kills a non-interactive session** (auto-reject poisons the whole session: «Step interrupted», exit 1). A configured `deny` only blocks the operation and the session continues. All session boundaries in this repo are deny rules (ADR-0006).
4. **Sessions never do irreversible git** (`push`, `commit`, `merge` — denied by `opencode.json`). The coordinator runs git directly, not as a session. **You are a session too**: you cannot commit; hand the irreversible step to the human.

## Pre-flight (before `npm run piloto`)

- `opencode --version` resolves, and `piloto.config.json` `sesiones.comando` points to a **real `.exe`** on Windows (`node_modules/@opencode/cli/bin/opencode.exe`), never to a PATH shim (see signatures below).
- `gh auth status` OK; working tree clean on `main`.
- Frontier is exactly the intended tickets: `gh issue list --state open --label ready-for-agent` (API REST is authoritative if the list lags). **No meta-issues in the frontier** — if the spec (#1) or the tracker issue (#11) carries the label, the Piloto will try to implement itself. Removing a label is a human decision: ask first.
- No `needs-grill` tickets pending: the Piloto excludes them from the frontier, but each one is an unanswered grill — resolve it with the human before relaunching.
- Frontier tickets carry their «Alcance» section: `gh issue view <N> --json body` over the frontier list. A ticket without it is scope-ambiguous for fresh-context sessions (ADR-0011): surface it to the human and wait — editing tickets is the human's call.
- Frontier tickets fix the values the revisora will audit (component paddings, sizes, copy, minimum touch targets). A body that doesn't fix a value invites either a serial finding or a devolución (ADR-0012): surface it to the human.
- Cheap smoke of the implementer model: `opencode run --model <implementadora> "Responde exactamente: OK"`.

## While the pass runs

- **Do not touch the tree.** The tree belongs to the implementadora; the diff, to the revisora. No commits, no label changes, no manual edits.
- The Piloto's narration goes quiet while a session runs (output is buffered). Silence is not a hang; check the database.
- **If the coordinator dies** (process gone, no narrated error): check the DB — the current session probably still lives in the service. Let it finish (watch for RESUMEN / outcome marker), then relaunch `npm run piloto`: the new pass retakes the ticket over the orphaned diff (retake pattern, proven with #5 and #10). Keep the diff — never discard orphaned work.
- **Never restart the OpenCode service from a session.** It kills your own session and possibly the pass tree. Service-level actions belong to the human.

## Incident protocol

- Unexpected error → **diagnose, propose the fix, wait for the human's OK** before touching any Piloto code. Config-only fixes are still worth a proposal.
- Verify every fix with a cheap **sonda** before relaunching: a small `opencode run` with a clearly labeled title (`Sonda · …`) so it never pollutes the evidence sessions «Piloto · …».
- Log each incident in the tracker issue (#11) as you resolve it — it is the pass's bitácora.
- Escalation (`ready-for-human` + error comment + stopped pass) is reported as-is. **Never fix it yourself.**

## Ticket devolutions (`needs-grill`, ADR-0012)

A devolución is not an escalation and never a code fix: the ticket body under-determines the implementation, and the Piloto stopped the pass after labeling the ticket `needs-grill` with the doubts as a comment. When that happens:

- The diff stays in the tree for the retoma; nothing is discarded.
- Run a grill with the human on the ticket's doubts. The escalado rule applies to spec, not code: the answers land in the ticket body as antídotos (writing-tickets, ADR-0011), never only in the conversation.
- If a doubt exposes a gap in the design docs (an ambiguous value in a screen spec, a component spec without a token), fix it there once — the rest of the package inherits the decision.
- Then: remove `needs-grill`, restore `ready-for-agent`, relaunch the pass (retoma pattern). A devolución does not consume retries.

## Known failure signatures (first real pass, 2026-09-27)

| Signature | Cause | Fix |
|---|---|---|
| `spawn opencode ENOENT` right after launching a session | npm global shims (`.cmd`/sh) are not executable by Node's shell-less spawn on Windows; PATH is irrelevant | Point `sesiones.comando` at the package's real `.exe` |
| «Step interrupted» + exit 1 right after `permission requested: … ; auto-rejecting` | An `ask` (external_directory, `.env`, anything) in a non-interactive session without `--auto` | Turn it into a `deny` rule in `opencode.json` (non-fatal); review remaining `ask` paths before relaunching |
| Coordinator node dies silently mid-ticket (exit 1, no narrated error, no stack) | External kill of the process tree; sessions survive in the service | Watch the live session to completion, relaunch the pass, retake the ticket |

## Evidence to collect at the end

- Issues closed and their commits (`git log --oneline`, one `feat: … (#N)` per ticket).
- Session inventory from the database: title, message count per session («Piloto · papel · #ticket»).
- Post the evidence comment in the tracker issue (#11): tickets, commits, sessions, and the incidents narrative.
