# Skill: Technical Feasibility (Stage 01 / Step 00)

## 1. Purpose

This skill resolves **technical unknowns** left over from `idea.md` — things that need investigation, comparison, or a proof-of-concept before real design can start. It is the bridge between "we know *what* problem we're solving" (Stage 00 output) and "we know *how* we're going to build it" (the rest of Stage 01).

This is the **only optional skill** in `01-planning-design`. Most requests don't need it — they reuse patterns already established in the project. Running it unconditionally on every feature would waste time and produce noise; skipping it when it's genuinely needed produces expensive design mistakes discovered mid-implementation. Section 2 gives the exact trigger conditions.

**Design philosophy for long-term stability:** this file intentionally does **not** contain a list of current technologies, libraries, or "recommended stacks" — those go stale within months. Instead, it defines a fixed **evaluation lens** (Section 5) and a fixed **decision-record format** (Section 7) that stay valid regardless of what technology exists at the time. The skill's job is to apply that lens consistently, not to know what's trendy.

This skill is agent-agnostic (Claude, Cursor, Codex, Antigravity, or any future agent) and assumes only: the agent can read project files, can optionally use a web-search tool if available (not required), and can ask the user questions and wait for answers.

### 1.1 Language Protocol

Same protocol as `00-idea-discovery/idea-discovery.md` Section 1.1: internal instructions in this file are English; all user-facing communication and all generated output are in the user's language. Do not re-derive the rule — follow it as defined there. Heading translation for **this skill's own output** (`research.md`) uses the fixed table below (same "no synonyms, no reordering, no dropped key markers" discipline as the idea.md table):

| English (canonical key) | Vietnamese heading (use exactly) |
|---|---|
| Decision Record | `## Bản ghi quyết định` |
| Context | `### Bối cảnh` |
| Options Considered | `### Các phương án đã xem xét` |
| Decision | `### Quyết định` |
| Consequences | `### Hệ quả` |
| Reversibility | `### Khả năng đảo ngược` |

Every heading carries its key marker (e.g. `<!-- key: context -->`), never translated, never omitted — see Section 7 for the full template.

---

## 2. When This Skill Runs (Trigger Conditions)

Run this skill only if **at least one** of these is true for the feature:

- [ ] `idea.md` has an `Open Question` or a `notes`-derived point that is technical in nature (not a business/scope decision).
- [ ] The feature needs a library, framework, or external service **not already used elsewhere in this project**.
- [ ] The feature integrates with a third-party API, payment gateway, or webhook **for the first time** in this codebase.
- [ ] The feature has a performance/scale expectation that's uncertain given the current architecture.
- [ ] The feature requires a data migration whose approach isn't obvious from existing patterns.
- [ ] The feature spans multiple services (per `Impacted Areas` / `Dependencies` in idea.md) and the integration pattern — sync REST, async event, webhook, shared DB — isn't already decided.
- [ ] The feature would introduce an architectural pattern **never used before** in this project (first WebSocket channel, first queue, first scheduled job, first cache layer, etc.).

**If none apply:** skip this skill entirely and go straight to `01-system-modeling.md`. Do not create empty output just to "complete the pipeline."

---

## 3. Input Contract

Read, in order:

1. `<feature>-idea.md` — specifically `Open Questions`, `Constraints`, `Dependencies`, `Impacted Areas`, and `Data Sensitivity & Compliance` (if present).
2. **Precedent first, research second** — scan `/workspace/features/*/research.md` (other features' prior decision records) and `/docs/ARCHITECTURE.md` for a decision that already covers this same question. A project that re-decides the same technical question per-feature drifts into inconsistency fast — reuse before you research.
3. Actual project structure (`backend/`, `services/*`, `frontend/`, `admin/`, `infra/`) to know what's genuinely already in use versus what would be new.

---

## 4. Process

### Step 1 — Triage
Classify each trigger reason into one category: **Technology Choice**, **Integration Feasibility**, **Performance & Scale**, **Data Migration**, **Cross-Service Pattern**, or **New Architecture Pattern**. This category becomes metadata on the decision record (Section 7) and determines which parts of the Decision Criteria (Section 5) matter most.

### Step 2 — Check for precedent
For each item, search for a prior decision in the project that already answers it (Section 3, point 2). If found: adopt it by default — state "reusing decision from `<other-feature>/research.md`" and move on. Only deviate from precedent with an explicit, stated reason (e.g. the old choice doesn't fit this feature's constraints) — never silently diverge, since that's how a project ends up with three different HTTP client libraries for no reason.

### Step 3 — Research (only if no precedent exists)
Gather a **short list of realistic options** (2–4, not an exhaustive survey) and evaluate each against the fixed Decision Criteria (Section 5). Default toward the option that best fits what the project already does, unless there's a concrete reason not to — novelty is a cost, not a feature, for a solo/small-team developer maintaining this long-term.

### Step 4 — Optional technical spike
If a question genuinely can't be resolved by reasoning or documentation alone ("will this library actually work with our existing auth middleware"), a small, **time-boxed, throwaway** proof-of-concept is allowed. Rules:
- Isolated — its own scratch folder/branch, never merged into the real code path.
- Has one job: answer a specific go/no-go question, not to become a first draft of the feature.
- Gets deleted (or explicitly marked as a disposable prototype, never as production code) once it has answered the question.
- The **result** of the spike (what was learned) goes into the decision record — the spike code itself is not a deliverable of this skill.

### Step 5 — Decide and record
Resolve each item using the format in Section 7. Use the **threshold rule**: if an item's answer is a one-line, low-risk, obvious pick (e.g. "use the HTTP client already used everywhere else in the project"), resolve it directly inside `idea.md`'s `Assumptions` section — do **not** create a `research.md` entry for a non-decision. Only genuinely non-obvious, trade-off-bearing, or hard-to-reverse choices earn a full decision record.

### Step 6 — Update idea.md
Move resolved `Open Questions` out of that section — either inlined (trivial cases) or referenced by decision ID ("resolved — see `research.md` Decision Record 2"). Anything still genuinely unresolved after this step stays in `Open Questions` and is explicitly carried forward into `threat-modeling.md` / `design-consistency-check.md` as a known risk, not silently dropped.

### Step 7 — Present for confirmation
If any resolution required a judgment call the user should weigh in on (especially anything flagged low-reversibility in Section 5), ask — batched, capped at 3 rounds, always with a recommended default — following the exact protocol already defined in `idea-discovery.md` Section 6. Don't re-invent question-asking rules here; reuse that protocol.

---

## 5. Decision Criteria (the stable evaluation lens)

Apply these to every option under consideration. This list is deliberately generic and technology-independent — it's what keeps this file useful for years without editing, regardless of what specific tools exist at the time.

- **Fit with existing stack** — does the project already do something similar? What's the switching/learning cost of introducing something new next to it?
- **Solo/small-team maintainability** — this project is frequently built and maintained by one full-stack person. Weight heavily against anything with a steep learning curve or that requires specialized ongoing expertise to operate.
- **Long-term upkeep health** — is it actively maintained upstream? (Ties directly to the project's naming/security rule: no archived or ~2-years-unmaintained dependencies.)
- **Reversibility** — how expensive would it be to undo this choice later if it turns out wrong? Treat every decision as either a "two-way door" (cheap to reverse — decide fast, don't over-analyze) or a "one-way door" (expensive/slow to reverse — data format choices, core protocol choices, anything that gets baked into many other features). One-way doors get more scrutiny and should usually be surfaced to the user rather than decided silently.
- **Operational cost** — hosting, licensing, infra complexity, ongoing ops burden — not just build cost.
- **Alignment with stated project priorities** — readability > maintainability/upgradability/debuggability > performance > brevity. When two options are close, the more readable/boring one wins.
- **Security & compliance impact** — cross-check against `Data Sensitivity & Compliance` in `idea.md`; anything touching PII/payment/auth gets flagged forward to `threat-modeling.md` regardless of which option is picked.
- **Cross-service compatibility** — does it work cleanly across the project's actual multi-service topology (main backend + independent services), or does it assume a single-service monolith?

---

## 6. Build vs. Buy / Adopt vs. Build Heuristic

For anything in the **Integration Feasibility** category (third-party services, commodity capabilities):

- **Commodity capability** (auth, payment processing, transactional email/SMS, file storage, search infra) → default to an existing managed service/library unless there's a specific, stated reason to build it in-house. Reinventing commodity infrastructure is a maintenance tax with no product upside.
- **Core product differentiator** — the thing that's actually the point of this feature — → build in-house, or at minimum don't let a third-party dependency own the core logic.
- When genuinely unsure which bucket something falls into, ask the user rather than guessing — this is a business judgment as much as a technical one.

This heuristic is intentionally generic (no vendor names) so it doesn't need updating as specific services come and go.

---

## 7. Output Specification

- **Location:** `/workspace/features/<NNN-feature-slug>/research.md` — **conditional**, created only when at least one item cleared the Step 5 threshold (a real trade-off decision, not a one-liner).
- **Language:** user's language, fixed heading mapping (Section 1.1) — no ad hoc translation, no reordering, no invented headings, same discipline as `idea.md`.
- **Also update:** `<feature>-idea.md` per Step 6.
- **Multiple decisions, one file:** if a feature has several resolved items, they're multiple "Decision Record" entries in the same `research.md`, numbered sequentially — don't create one file per decision.
- **If revisiting later:** append new Decision Records rather than editing old ones; if a past decision is being reversed, add a new record with `Status: Supersedes Decision Record <N>` rather than deleting history — this file is meant to explain *why* a choice was made, including choices that were later reversed.

### `research.md` Template

```markdown
# Technical Research — <Feature Title>

## Decision Record 1 — <Short Title> <!-- key: decision_record -->

**Status:** Proposed | Accepted | Superseded by Decision Record <N>
**Category:** Technology Choice | Integration Feasibility | Performance & Scale | Data Migration | Cross-Service Pattern | New Architecture Pattern
**Door Type:** Two-way (cheap to reverse) | One-way (expensive to reverse)

### Context <!-- key: context -->
<What question this answers, and why it came up. Reference the relevant idea.md Open Question.>

### Options Considered <!-- key: options_considered -->
| Option | Fit with existing stack | Maintainability (solo-dev) | Reversibility | Notes |
|---|---|---|---|---|
| <A> | | | | |
| <B> | | | | |

### Decision <!-- key: decision -->
<What was chosen, and the one or two deciding factors from Section 5 that tipped it.>

### Consequences <!-- key: consequences -->
<What this commits the project to. Anything it rules out. Anything it flags forward to threat-modeling or database-design.>

### Reversibility <!-- key: reversibility -->
<Concretely, what it would take to undo this later if needed.>

---

## Decision Record 2 — <Short Title> <!-- key: decision_record -->
...
```

---

## 8. Boundaries — What This Skill Does NOT Do

- No schema design — that's `database-design.md`.
- No API contract design — that's `api-design.md`.
- No full threat/security analysis — only flag security-relevant trade-offs; deep analysis is `threat-modeling.md`.
- No production code — spike code (Step 4) is strictly throwaway.
- No re-litigating a decision that already has precedent elsewhere in the project (Step 2) — that's how tech-stack sprawl happens.

---

## 9. Anti-Patterns to Avoid

- **Researching something the project already decided elsewhere.** Check precedent first, every time.
- **Creating `research.md` for a trivial, obvious pick.** Use the Assumptions section of `idea.md` instead — don't bloat the feature folder with non-decisions.
- **Picking bleeding-edge/unproven tools without discussing reversibility.** If it's a one-way door, say so explicitly and let the user weigh in.
- **Letting a spike quietly become the real implementation**, skipping `system-modeling`/`database-design`/`api-design` entirely. A spike answers one question; it is never itself the design.
- **Silently deciding a one-way-door item.** Low-reversibility choices go through the question-asking protocol (Step 7), not a unilateral AI call.
- **Running this skill on every single feature regardless of need.** Re-check Section 2 before starting — most features should skip this entirely.

---

## 10. Example Walkthrough

**From idea.md, `notes`:** "Chưa biết nên dùng thư viện nào để xử lý gửi notification real-time, và có cần thêm message queue không."

**Step 1 (triage):** Category = New Architecture Pattern + Technology Choice.

**Step 2 (precedent check):** Finds `/workspace/features/003-shipping-labels/research.md` already has a Decision Record for "async event delivery between backend and services" — this project already uses Redis pub/sub for that purpose in the shipping feature.

**Step 3–5:** Since a precedent exists and fits, no new options are researched. This resolves as a one-liner: "Reusing the Redis pub/sub pattern from `003-shipping-labels` for real-time notification delivery — same category, same constraints, no new decision needed." Because this is a trivial, low-risk reuse, it's written directly into `idea.md`'s `Assumptions` section — **no `research.md` is created** for this item alone.

**Separately, a second question in the same feature** ("có nên tích hợp trực tiếp một dịch vụ SMS bên thứ 3 hay không") has no precedent, involves a paid external vendor, and is a one-way door once customer-facing SMS templates depend on a specific provider's API. This one **does** warrant a `research.md` Decision Record — 2–3 SMS vendor options compared against Section 5's criteria, explicit `Door Type: One-way`, and the choice surfaced to the user for confirmation before finalizing.

---

## 11. Platform Notes (non-normative)

Same as `idea-discovery.md` Section 11: this file is the single source of truth for this skill's behavior. Platform-specific pointer files (`.cursor/rules`, Claude project instructions, Codex config entries) should only reference and load this file, not restate or fork its logic.