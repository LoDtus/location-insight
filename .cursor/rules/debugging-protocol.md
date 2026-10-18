---
description: Mandatory protocol for finding and fixing bugs. Applies to any request of the form "fix bug X", "why is Y broken", debug sessions, root-cause investigation.
globs:
alwaysApply: false
---

# Debug & Fix Protocol

## Core Principle

> **Never modify code until the root cause is confirmed with concrete evidence, and never consider a fix "done" until every location affected by the same root cause has been checked.**

Do not jump straight from "read the bug description" to "edit code." Work through the Phases below in order. Each Phase has a **Gate** — a condition that must be satisfied before moving to the next Phase. If a Gate is not satisfied, stop and ask the user instead of guessing.

Users typically **only describe the first symptom they noticed**, not the full scope of impact. The agent must proactively widen the investigation, not limit itself to exactly what was described.

---

## Phase 0 — Symptom Capture

Before doing anything, write down clearly:

- **Observed symptom** (the user's description, verbatim).
- **Conditions**: when, where, what input/state triggers it, whether it's reproducible.
- **Unknowns**: parts of the description that are vague or missing (e.g. unclear whether the bug is backend or frontend, unclear which specific input triggers it).

**Gate 0**: If the description isn't enough to identify at least one concrete starting point for investigation (a file, function, endpoint, log line, stack trace...), ask the user before proceeding — do not guess.

---

## Phase 1 — Reproduce & Trace

- Try to actually reproduce the bug (run the code, read logs, write a throwaway test if needed) rather than inferring purely from reading static code.
- Trace the data flow / call chain from the point where the symptom was observed **backward to where it originates** — do not stop at the point where the symptom surfaces, since that is usually where the consequence is noticed, not where the fault begins.
- If reproduction isn't possible, explicitly state that the conclusion is based on static reading, not confirmed by experiment — and flag lower confidence accordingly.

**Gate 1**: Must identify at least one concrete path from cause → effect (data flow / call chain), not just "seems related."

---

## Phase 2 — Root Cause Isolation

- State clearly: **"Root cause is: ..."** — a specific, verifiable statement, not a vague description like "probably some logic handling issue."
- Provide **evidence**: a code snippet, log output, runtime value, or test case that demonstrates it — do not state a root cause based on pure speculation.
- Distinguish clearly between:
  - **Symptom fix**: makes the reported behavior go away, but the underlying cause may still be present.
  - **Root cause fix**: fixes the actual point of origin.
- If there are multiple plausible hypotheses and not enough evidence to pick one, list them all and either ask the user or propose a fast way to verify (add logging, write a small test) before fixing.

**Gate 2**: Do not proceed to Phase 3 unless the root cause has been stated with concrete evidence. If only a symptom fix (not a root cause fix) can be found, say so explicitly to the user before fixing — do not silently apply a symptom fix and report it as resolved.

---

## Phase 3 — Blast Radius Analysis

This is the step most often skipped, and the main reason fixes end up scoped to "only the exact spot the user described":

- Starting from the confirmed root cause (usually a shared function/module/logic), **search the entire codebase** for every caller/consumer of that logic — not just within the file currently being edited.
- For each call site found, assess whether it is actually affected by the same root cause, or merely shares the function without being impacted.
- List **every affected location** explicitly, including ones the user never mentioned in the original bug description.
- If the faulty logic is shared/core logic, explicitly call out the risk level of the fix, since a single change will ripple across multiple places.

**Gate 3**: A clear list of "affected locations" must exist before writing the fix. If the number of affected locations is large, or the change touches shared/core logic, confirm the intended fix scope with the user before proceeding — do not silently fix everything without asking when the risk is high.

---

## Phase 4 — Fix Proposal (before writing code)

Before touching real code, present concisely:

1. Root cause (confirmed in Phase 2).
2. Proposed fix (where, how — the minimal change needed to address the root cause, avoiding unrelated changes).
3. List of affected locations that need to be updated in sync (from Phase 3).
4. **Risks**: existing behaviors that might change as a result of this fix, especially cases that currently work correctly but depend on the same logic.
5. How the fix will be verified afterward (Phase 6).

**Gate 4**: If the fix touches logic used by many other places, or lacks test coverage, explicitly flag the risk of "may affect existing behavior" and get confirmation before implementing, rather than confidently fixing and reporting it as done.

---

## Phase 5 — Implementation

- Only modify what was scoped in Phase 3 & 4. Do not opportunistically refactor or touch unrelated code while in there.
- For each location changed, preserve the current correct behavior of other cases that share the same logic — if different cases now need different handling, branch explicitly rather than blindly overwriting shared logic.
- If, while implementing, a new affected location is discovered that wasn't in the Phase 3 list, stop, add it to the list, and report back before continuing — do not silently widen the fix scope.

---

## Phase 6 — Regression Verification

- Re-test the original symptom (confirm it's actually gone).
- Re-test **every location in the Phase 3 blast-radius list** — not just the location the user originally described.
- If a test suite exists: run tests related to the modified module, not only newly written tests.
- If no automated tests exist, explicitly list the cases the user should manually verify (since the agent can't run everything itself).

**Gate 6**: Do not report "fixed" unless at minimum: (a) the original symptom is confirmed gone, and (b) the blast-radius locations have been checked, to the extent verification was possible.

---

## Phase 7 — Report

The final report must state, not just "fixed it":

- What the root cause actually was (not a restatement of the symptom).
- Which files/locations were changed, and why each one needed to change.
- Which locations were checked and confirmed **not** affected (so the user knows the scope that was actually reviewed, not just assumed).
- Any remaining risk (parts that couldn't be verified, or edge cases still uncertain).

---

## Failure Modes & Safeguards

Following the Phases above is necessary but not sufficient — several failure modes exist that no amount of process discipline fully eliminates on its own. Treat these as things to actively watch for and flag, not solved problems.

### A. False confidence in the root cause
- A root cause explanation can sound coherent and well-reasoned while still being pure inference from static code reading rather than confirmed behavior. Stating a root cause "with evidence" per Gate 2 is not a guarantee — distinguish explicitly between "confirmed by reproduction/logs/tests" vs. "inferred from reading code" and report which one it is.
- Watch for **stopping at the first plausible explanation** (confirmation bias) when multiple contributing causes may exist. If evidence only partially explains the symptom, say so instead of treating it as fully resolved.
- Don't default to "it's a code bug." Rule out data/config/environment/cache/version-mismatch causes first when the fix would otherwise be a code change to work around bad state.
- **Chesterton's Fence**: code that looks wrong may be an intentional workaround for a different issue. Before removing/changing something that "looks like a bug," check its history/intent (git blame, comments) rather than assuming it's simply wrong.

### B. Blast radius has hard limits
- Text/symbol search cannot see everything: dynamic dispatch, reflection, string-based routing, event/message-queue consumers, and config-driven wiring won't show up in a grep/symbol search. Flag this limitation explicitly rather than implying the search was exhaustive.
- In a multi-service architecture, shared logic may be consumed by services outside the current workspace (via API, queue, etc.) that the agent has no visibility into. State this boundary explicitly instead of silently treating "not found in this repo" as "not affected."
- Search indexes can lag or exclude gitignored-but-still-deployed files. If confidence in search completeness is low, say so.

### C. Fixes that mask rather than resolve
- Adding try/catch, null-checks, or default values can make a symptom disappear without addressing the root cause — and worse, it can suppress the error signal that would make the real bug easier to find later. Treat any fix of this shape as a **symptom fix** by default and label it as such, even if it "works."
- Prefer a checkpoint/commit before a multi-file fix so a wrong-direction fix can be cleanly reverted rather than left half-applied.
- Resist scope creep: unrelated "improvements" made while in the code should be called out separately, not folded silently into the bug fix.

### D. Verification can be fake
- "Verified" must mean actually executed (ran the code, ran the test, checked the log) — not re-reading the diff and reasoning that it should work. State explicitly whether verification was executed or only reasoned about.
- A test written to confirm the agent's own understanding of the root cause will pass even if that understanding is wrong — it proves consistency with the hypothesis, not correctness of the hypothesis. Where possible, verify against independent evidence (actual reproduction, existing test suite, user-provided repro steps).
- For non-deterministic bugs (race conditions, timing, environment-dependent behavior), a symptom disappearing after one fix and a few retries is weak evidence. Say so explicitly rather than declaring it resolved.

### E. Process-level risks
- Long conversations dilute rule adherence. For long or multi-step debugging sessions, periodically restate which Phase/Gate is currently active before taking further action.
- Don't over-gate: only stop and ask at genuinely high-risk points (shared/core logic, low test coverage, large blast radius). Gating on everything trains the user to rubber-stamp confirmations without reading them, which defeats the purpose.
- Don't assume the reported behavior is actually a bug. It may be a misunderstanding of intended behavior. If evidence suggests the "bug" might be a spec/expectation mismatch rather than a defect, say so before proceeding to fix anything.