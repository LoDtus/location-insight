# Shared Template: Feature `README.md`

## Purpose of This File

This is **not a skill** — it's a shared structural contract, referenced by multiple skills instead of being redefined in each one. `README.md` inside a feature folder is the single document AI agents read **before executing any task** against that feature (design continuation, implementation, bug fix, optimization). It is:

- **Not official** — the official, locked-down source of truth is `/docs`. This README is a working document.
- **High-churn** — updated frequently as design decisions land, as opposed to `idea.md` (mostly frozen after Stage 00) or `research.md` (append-only archive).
- **Deliberately lean** — it does NOT contain diagrams, DB schemas, or API contracts. Those were split into `diagrams/`, `mongodb.md`, `postgresql.dbml`, `interfaces/*.yml` specifically because inlining them made this file too long to be a fast pre-task read. README only ever **links** to them.

Because more than one skill touches this file over a feature's lifetime, every section below has an explicit **owner** (who creates/rewrites it) and, where relevant, **patchers** (who may update it later without restructuring it). A patcher only ever edits its assigned section(s) — never reorders, renames, or touches a section it doesn't own.

## Which Skills Reference This File

- `feature-specification.md` (`01-planning-design`, step 06) — **creates** the file for the first time, from `idea.md` + all Stage 01 outputs. Owns the overall structure.
- `technical-feasibility.md` (`01-planning-design`, step 00) — **patches** `Technical Context` / `Dependencies` / `Constraints` / `Artifacts` / `Update Log` on subsequent runs, when README already exists.
- `system-modeling.md`, `database-design.md`, `api-design.md` — append one line each to `Artifacts` when they produce a new linkable file (their own responsibility, not `feature-specification.md`'s job to guess after the fact).
- `threat-modeling.md` — may append to `Open Questions` or add a short risk note to `Technical Context` if something is flagged but not fully resolved.
- Any later-stage skill (`04-quality-assurance` onward) — **read-only** with respect to this file, except `test-design.md` may add a note under `Acceptance Criteria` if it refines a criterion; it does not rewrite the section.

If a future skill needs to write here and isn't listed above, add it to this list explicitly — don't let a skill silently start writing to a section it wasn't assigned.

---

## Language Protocol

Same protocol as `idea-discovery.md` Section 1.1 and `technical-feasibility.md` Section 1.1: this template's instructions are in English; actual `README.md` content is written in the user's language, using the fixed heading mapping below — no ad hoc translation, no reordering, no invented headings, key markers always preserved.

| English (canonical key) | Vietnamese heading (use exactly)               |
| ----------------------- | ---------------------------------------------- |
| Overview                | `## Tổng quan`                                 |
| Goals & Scope           | `## Mục tiêu & Phạm vi`                        |
| Actors                  | `## Đối tượng liên quan`                       |
| Functional Requirements | `## Yêu cầu chức năng`                         |
| Business Rules          | `## Quy tắc nghiệp vụ`                         |
| User Flow Summary       | `## Tóm tắt luồng người dùng`                  |
| Technical Context       | `## Bối cảnh kỹ thuật`                         |
| Dependencies            | `## Phụ thuộc`                                 |
| Constraints             | `## Ràng buộc`                                 |
| Artifacts               | `## Tài liệu liên quan (Artifacts)`            |
| Acceptance Criteria     | `## Tiêu chí nghiệm thu (Acceptance Criteria)` |
| Open Questions          | `## Câu hỏi mở (Open Questions)`               |
| Update Log              | `## Nhật ký cập nhật`                          |

---

## Fixed Structure

Section order is locked, same discipline as `idea.md`/`research.md`: no reordering, no custom top-level `##` headings, no renaming outside the table above.

```markdown
# <Feature Title>

**Feature ID:** <NNN-feature-slug>
**Status:** Draft | In Review | Approved | In Progress | Done
**Last Updated:** <bump this whenever any section changes — no need for a full changelog entry unless the change is consequential, see Update Log below>

## Overview <!-- key: overview -->

<!-- OWNER: feature-specification.md (write once; rarely touched after) -->

<2–4 sentences. Plain-language summary of what this feature is — condensed from idea.md's Problem + Goal.>

## Goals & Scope <!-- key: goals_scope -->

<!-- OWNER: feature-specification.md -->

**In scope:**

- <...>

**Out of scope:**

- <...>

## Actors <!-- key: actors -->

<!-- OWNER: feature-specification.md -->

<Who's involved — end users, admins, external systems, cron jobs. Short, one line per actor.>

## Functional Requirements <!-- key: functional_requirements -->

<!-- OWNER: feature-specification.md -->

- **FR-01 (<short name>):** <...>
- **FR-02 (<short name>):** <...>

## Business Rules <!-- key: business_rules -->

<!-- OWNER: feature-specification.md — CONDITIONAL, omit if the feature has no rules beyond its FRs -->

- **BR-01 (<short name>):** <...>

## User Flow Summary <!-- key: user_flow_summary -->

<!-- OWNER: feature-specification.md -->

<Short numbered prose summary of the main flow(s) — a condensed narrative, not the diagram itself. Link the real diagram under Artifacts.>

## Technical Context <!-- key: technical_context -->

<!-- OWNER: feature-specification.md (initial write) | PATCHER: technical-feasibility.md (on later runs) -->

<Current-state technical decisions in plain language — one or two sentences per decision. Point to research.md for full reasoning instead of repeating it here. This section is the one most likely to go stale — keep every statement short enough to re-verify at a glance.>

## Dependencies <!-- key: dependencies -->

<!-- OWNER: feature-specification.md | PATCHER: technical-feasibility.md -->
<!-- CONDITIONAL — omit if none -->

<Other features/services this depends on, or that depend on this. Reference by feature folder name.>

## Constraints <!-- key: constraints -->

<!-- OWNER: feature-specification.md | PATCHER: technical-feasibility.md -->

<Hard, non-negotiable limits — carried from idea.md, may gain new entries if feasibility work surfaces one.>

## Artifacts <!-- key: artifacts -->

<!-- OWNER: feature-specification.md (initial links) | APPEND-ONLY BY: system-modeling.md, database-design.md, api-design.md, technical-feasibility.md — each appends its own line when it produces a file, immediately, not retroactively -->

- Diagrams: <links into diagrams/, added by system-modeling.md and database-design.md>
- API Contracts: <links into interfaces/, added by api-design.md>
- Database Schemas: <links to mongodb.md / postgresql.dbml, added by database-design.md>
- Technical Research: <link to research.md, added by technical-feasibility.md — only if research.md exists>

## Acceptance Criteria <!-- key: acceptance_criteria -->

<!-- OWNER: feature-specification.md (draft) | REFINED BY: test-design.md at QA stage (does not rewrite this section, only adds detail alongside it in its own stage-04 output) -->

- [ ] **AC-01:** Given ... When ... Then ...

## Open Questions <!-- key: open_questions -->

<!-- OWNER: shared — feature-specification.md carries over unresolved items from idea.md; threat-modeling.md may append -->
<Anything still genuinely unresolved. Empty if none.>

## Update Log <!-- key: update_log -->

<!-- OWNER: shared, append-only -->
<!-- One line per CONSEQUENTIAL change only — e.g. a Technical Context decision was superseded, scope changed. Routine/trivial edits (typo fixes, a Two-way-Door decision update) do NOT need an entry — keep this log short and worth reading, not a full audit trail. -->

- <short note, what changed and why, referencing the relevant research.md Decision Record if applicable>
```

---

## Rationale — Why Own/Patcher Split Instead of a Single Writer

`idea.md` and `research.md` each have exactly one writer, so a simple "this skill writes this file" rule was enough for them. README is different: it's the one document nearly every Stage 01 skill needs to leave a trace in (a new diagram exists, a new API contract exists, a technical decision changed), while still needing to read like one coherent document rather than a patchwork. The owner/patcher/append-only split resolves this without needing a heavier mechanism (like a build step that assembles README from fragments):

- **One owner per section** who can rewrite it wholesale (usually `feature-specification.md`, since it does the initial synthesis).
- **Named patchers** who may update an owned section later, but only by editing the existing statement — not restructuring it.
- **Append-only lists** (`Artifacts`) where every producing skill adds exactly one line for its own output, immediately when that output is created — this avoids a single skill having to remember and re-derive links to files it didn't create.

Any skill not listed as owner/patcher/appender for a section must not write to it. If a future skill needs to, update this file's "Which Skills Reference This File" list first — don't let write access grow implicitly.
