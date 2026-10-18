# Skill: Idea Discovery (Stage 00)

## 1. Purpose

This is the **entry gate** of the workflow. It takes a rough, urgent, possibly half-formed request — a new feature, a change, a bug fix, an optimization — and turns it into a **clear, scoped, decision-complete problem statement**. It does not design the solution. It defines the problem well enough that stage `01-planning-design` can design a solution without having to re-ask "wait, what do you actually mean?"

Think of this skill as a **filter + amplifier**: it filters out ambiguity before it becomes expensive (wrong DB schema, wrong API shape, wasted dev time), and it amplifies a 3-line rushed idea into a document a teammate — or a future you, six months later — can read cold and understand.

This skill is written to be **agent-agnostic**: it must work the same whether it's run by Claude, Cursor, Codex, Antigravity, or any future AI coding agent, in chat or in an agentic coding loop. It assumes only two capabilities from the host agent: (1) it can read files in the project, and (2) it can ask the user questions and wait for answers. Nothing here depends on a specific tool-call API, UI widget, or platform feature.

### 1.1 Language Protocol

- **Instructions in this skill file are written in English** — this is for the AI's own parsing/reasoning reliability, not for the user. Read and follow this file in English internally.
- **All user-facing communication and all generated output must be in the user's language** (e.g. Vietnamese if the user writes in Vietnamese). This includes: clarification questions, confirmations, the final `<feature-slug>-idea.md` file content (headings, prose, everything), and any summary shown to the user.
- If the user's language is ambiguous (e.g. mixed English/Vietnamese input), default to the language the user used most in their `idea`/`context`/`goal` fields. If genuinely unclear, ask once, in both languages, then commit to the answer for the rest of the session.

**Heading translation — fixed mapping, not free translation.** Section headings must never be translated ad hoc (e.g. sometimes "Vấn đề", sometimes "Bài toán", sometimes "Sự cố" for the same `Problem` section) — that breaks any downstream parsing (regex, scripts, other agents reading this file by section key). Use the fixed table below for Vietnamese. Do not invent synonyms, do not paraphrase, do not "improve" the wording — copy the mapped text exactly.

| English (canonical key)       | Vietnamese heading (use exactly)                |
| ----------------------------- | ----------------------------------------------- |
| Problem                       | `## Vấn đề`                                     |
| Current Context               | `## Bối cảnh hiện tại`                          |
| Goal                          | `## Mục tiêu`                                   |
| Scope                         | `## Phạm vi`                                    |
| Success Criteria              | `## Tiêu chí thành công`                        |
| Primary Actor(s) & Use Cases  | `## Đối tượng sử dụng chính & Kịch bản sử dụng` |
| Impacted Areas                | `## Nơi bị ảnh hưởng`                           |
| Dependencies                  | `## Phụ thuộc`                                  |
| Data Sensitivity & Compliance | `## Dữ liệu nhạy cảm & Tuân thủ`                |
| Bug Report                    | `## Báo cáo lỗi`                                |
| Constraints                   | `## Ràng buộc`                                  |
| Risks & Unknowns              | `## Rủi ro & Điểm chưa rõ`                      |
| Assumptions                   | `## Giả định (Assumptions)`                     |
| Open Questions                | `## Câu hỏi mở (Open Questions)`                |
| Related Features              | `## Tính năng liên quan`                        |
| Update Log                    | `## Nhật ký cập nhật`                           |

If output is written in English, use the canonical English heading text as-is (it's already the fixed form — see the key comments in Section 7's template).

If a language other than English or Vietnamese is ever needed, define an equivalent fixed mapping table (following this same one-row-per-section-key structure) **before** generating the first output in that language, and reuse it verbatim for every file after — never improvise a translation per-file, even under the 3-round question cap or time pressure.

**Machine-parseable key (language-independent safety net).** Every `##` section heading in the output template also carries a hidden key marker, e.g. `<!-- key: problem -->`, placed immediately after the heading line. This marker is **never translated and never omitted**, regardless of display language. It exists so that any script, regex, or downstream agent can locate a section reliably by its stable key even if the mapping table above is extended to new languages later, or if a heading's visible wording ever needs to change — the marker is the permanent parsing anchor; the visible heading text (per the table above) is just the human-facing label. See Section 7 for the full template with markers.

- Code-like tokens that must stay literal regardless of language: file paths, folder/feature slugs, field names referenced from schemas, technical terms without a natural translation (e.g. "endpoint", "webhook") — keep these in their original form even inside translated prose.

---

## 2. When This Skill Runs

Trigger this skill when the input matches (or is clearly intended to match) the standard idea input format below — regardless of how it's phrased or how rushed it is. Do not require the user to write perfect input; malformed, partial, or free-text input should still be parsed into the format below before proceeding.

Do **not** trigger this skill for:

- Direct implementation requests with no ambiguity ("rename this variable", "fix this typo") — those skip straight to `02-development-execution`.
- Pure Q&A about how the existing system works — that's a read-only question, not a discovery process.

---

## 3. Input Contract

Standard input shape (fields may arrive out of order, in prose, or partially filled — normalize them into this shape as the first step):

```
idea: <What do you want to build/add/change?>
context: <Where does this live, or how does the current system behave?>
goal: <What problem are you solving, or what outcome do you want?>

(Optional)
constraints: <Technical, DB, UI, time constraints, if any>
notes: <Points you're unsure about, options you're torn between>
```

If a required field (`idea`, `context`, `goal`) is missing entirely and cannot be reasonably inferred from the rest of the message or from project context, ask for it directly before doing anything else — don't guess the core intent.

Also classify the request into one of these **types**, from the wording of `idea`/`goal` (this drives which conditional sections of the output template apply — see Section 7):

- **New Feature** — something that doesn't exist yet.
- **Enhancement** — extends or modifies existing behavior.
- **Bug Fix** — existing behavior is wrong/broken.
- **Optimization** — existing behavior is correct but too slow/costly/inefficient.
- **Refactor** — no behavior change, structural/code-health change only.

If the type is ambiguous, make your best read and state it in the output rather than blocking on it — it's low-cost to correct later, so it belongs in `Assumptions`, not a question round.

---

## 4. Process

### Step 1 — Normalize input

Map whatever the user wrote onto the input contract above, including the request **type**. If they wrote a wall of unstructured text, extract everything from it yourself; don't make them reformat.

### Step 2 — Locate the feature slot

Check `/workspace/features/` for an existing feature this request belongs to (same domain, same area of the system, explicit reference by name/number).

- If it clearly extends/fixes an existing feature → use that feature's folder and update its `<feature>-idea.md`.
- If it's new → determine the next sequential number (`NNN`) from existing folders, and propose a short kebab-case slug derived from the idea (e.g. `saved-checkout-address`). Confirm the folder name with the user only if the mapping is ambiguous — otherwise state your choice and proceed.

### Step 3 — Gather project context before asking anything

Before asking the user a single question, read what's already available:

- `/docs` — finalized BA docs relevant to this area (source of truth; never contradict these without flagging it explicitly).
- Other folders in `/workspace/features/` — related or adjacent features, to catch overlap, shared entities, or conflicting assumptions.
- Existing schema/interface files (`postgresql.dbml`, `mongodb.md`, `*.openapi.yaml`, `*.asyncapi.yaml`) in relevant feature folders — to know what data/contracts already exist.
- Relevant code in `backend/`, `services/*`, `frontend/`, `admin/` at a structural level (module/route/service boundaries), not deep implementation detail.

Use this to (a) avoid asking things you can already answer yourself, and (b) surface things the user didn't think to mention (e.g. "there's already an `addresses` collection used by the shipping feature — does this reuse it?").

### Step 4 — Run the gap check

Compare what you now know (input + project context) against the **Completeness Checklist** (Section 5), including the type-specific items that apply to this request. Anything still unresolved is a candidate question.

### Step 5 — Ask, in bounded rounds

Follow the **Question-Asking Protocol** (Section 6) — this is what prevents infinite looping. Ask in the user's language (Section 1.1).

### Step 6 — Draft `<slug>-idea.md`

Once the checklist is satisfied (or the round limit is hit), write the file per the **Output Specification** (Section 7), in the user's language, using the fixed heading mapping (Section 1.1). Mark anything not explicitly confirmed by the user as an `Assumption`, not a fact.

### Step 7 — Present for confirmation

Show the user what will be written (or was written), explicitly calling out the Assumptions section and any Open Questions that remain unresolved. Let them correct anything before treating the file as final. Do not silently proceed to stage `01-planning-design` — that's a separate, explicit step.

---

## 5. Completeness Checklist (Definition of Done)

An idea is "discovery-complete" when all of the following can be answered — either from the user, or confidently from project context:

**Core (all request types):**

- [ ] **Problem** — what's broken, missing, or suboptimal, stated as a problem, not a solution.
- [ ] **Scope boundary** — what's explicitly in scope and what's explicitly out of scope for this pass.
- [ ] **Current behavior** — how the relevant part of the system works today (or "doesn't exist yet").
- [ ] **Success condition** — how you'd know this is done/working (even informally — doesn't need metrics).
- [ ] **Primary actor(s)** — who triggers/uses this (end user, admin, internal service, cron, etc.).
- [ ] **Impacted areas** — which service(s)/module(s)/data store(s) this likely touches, at a structural level.
- [ ] **Hard constraints** — anything that's non-negotiable (must not touch X, must ship by Y, must not add a new DB).
- [ ] **Known open decisions** — anything the user flagged as undecided (from `notes`), captured explicitly rather than resolved by guessing.
- [ ] **Dependencies** — does this rely on another feature/service being ready first, or block one that's already in progress?
- [ ] **Sensitive data touch** — does this involve PII, payment/financial data, auth/credentials, or anything else that later threat-modeling needs to know about? A simple yes/no + what, is enough here — no deep analysis.

**Bug Fix only, additionally:**

- [ ] **Reproduction** — steps to reproduce, or "intermittent/can't reliably reproduce" if that's the case.
- [ ] **Expected vs. actual behavior.**
- [ ] **Severity/blast radius** — who/what is affected, and how badly (cosmetic vs. data-corrupting).

**Optimization only, additionally:**

- [ ] **Current baseline** — current measured or perceived performance/cost, even if informal ("checkout takes ~4s", "this job costs too much compute").
- [ ] **Target** — what "good enough" looks like, even roughly.

This checklist is intentionally **not** about solution design (no "which table", no "which endpoint") — that belongs to stage `01-planning-design`. Idea Discovery only needs to pin down the _problem and its boundaries_ well enough that design can proceed without re-litigating scope.

---

## 6. Question-Asking Protocol (Loop Prevention)

The instruction "keep asking until you have everything" is dangerous without a hard stop. Follow these rules:

1. **Batch, don't drip.** Ask multiple related questions together in one round (group by checklist item), not one at a time across many turns.
2. **Cap at 3 rounds.** If the checklist still has open items after 3 rounds of questions, stop asking and move to step 6 with the remaining gaps written explicitly into an **Assumptions** section (best-guess, clearly labeled) or an **Open Questions** section (left for the user/next stage to resolve) — whichever fits: guess only when a reasonable default exists and the cost of being wrong is low; otherwise leave it open rather than guess.
3. **Prioritize by blocking-ness.** Only ask about checklist items that would materially change the shape of the idea if answered differently. Don't ask about things that are nice-to-know but don't change scope.
4. **Always offer a default.** Every question should come with your recommended answer/option, based on project context and common practice, so the user can confirm with a one-word reply instead of writing a paragraph.
5. **Respect an explicit skip.** If the user says something like "cứ làm theo assumption đi" / "proceed" / "your call" at any point, stop asking immediately, resolve all remaining gaps as Assumptions, and move to Step 6.
6. **Never ask about something already answered.** Re-check the input and project context before every round — don't re-ask a question the user already answered in `notes` or a previous round.
7. **Ask and confirm in the user's language**, per Section 1.1 — never switch to English mid-conversation with the user.

---

## 7. Output Specification

- **Location:** `/workspace/features/<NNN-feature-slug>/<feature-slug>-idea.md`
- **Language:** written entirely in the user's language (Section 1.1), using the fixed heading mapping table — no ad hoc translation.
- **Scope of this skill's output:** only this one file. Do not create `diagrams/`, `interfaces/`, `mongodb.md`, `postgresql.dbml`, or any other artifact — those belong to `01-planning-design` and later stages.
- **If updating an existing feature:** edit the existing `-idea.md` in place; add an entry to the `Update Log` section rather than rewriting history, so the file stays a readable record of how the feature's understanding evolved.
- **Conditional sections:** the template below has a fixed **core** (always present) and **conditional blocks** (only included when relevant — see markers). If a conditional block doesn't apply, omit the whole section rather than including it empty — this keeps the file lean for simple requests while still covering edge cases when they arise. For sections that _do_ apply but have nothing to report, write "Không có" / "None identified" rather than deleting the heading — downstream stages should be able to rely on a stable, predictable structure for the sections that are present.
- **Section order & heading integrity (strict):** for all sections that are included, their relative order MUST strictly follow the template below. Do not reorder sections, do not insert custom top-level (`##`) headings, and do not rename a heading to anything outside the fixed mapping table in Section 1.1. Sub-headings and bullet content _within_ a section may be adapted freely to the situation — only the `##` heading text and its `<!-- key: ... -->` marker are locked.

### `<feature-slug>-idea.md` Template

```markdown
# <Feature Title>

**Feature ID:** <NNN-feature-slug>
**Type:** New Feature | Enhancement | Bug Fix | Optimization | Refactor
**Status:** Draft | Needs Input | Ready for Planning

## Problem <!-- key: problem -->

<1–3 sentences. What's broken, missing, or needed. Stated as a problem, not a solution.>

## Current Context <!-- key: current_context -->

<How the relevant part of the system works today. Reference existing features/modules/data stores by name where relevant. "Does not exist yet" is a valid answer.>

## Goal <!-- key: goal -->

<What outcome/result this should achieve. Why it matters.>

## Scope <!-- key: scope -->

**In scope:**

- <...>

**Out of scope (non-goals):**

- <...>

## Success Criteria <!-- key: success_criteria -->

<How you'd know this is done. Can be informal/qualitative. For Optimization: include baseline and target.>

## Primary Actor(s) & Use Cases <!-- key: primary_actors -->

<Who triggers or uses this, and the core scenario(s) — 1–3 short use cases if it helps clarify, not a full spec.>

## Impacted Areas <!-- key: impacted_areas -->

<Services/modules/data stores likely touched, at a structural level only — no solution design here.>

## Dependencies <!-- key: dependencies -->

<CONDITIONAL — include only if this feature depends on, or blocks, another feature/service. Reference by feature folder name. Omit section if none.>

## Data Sensitivity & Compliance <!-- key: data_sensitivity -->

<CONDITIONAL — include only if this touches PII, payment/financial data, auth/credentials, or similar. Just flag what kind of data and where; deep analysis belongs to threat-modeling in stage 01. Omit section if not applicable.>

## Bug Report <!-- key: bug_report -->

<CONDITIONAL — Bug Fix type only. Sub-fields: Reproduction Steps / Expected Behavior / Actual Behavior / Severity & Blast Radius. Omit section entirely for non-bug requests.>

## Constraints <!-- key: constraints -->

<Hard, non-negotiable limits. "None stated" if genuinely none.>

## Risks & Unknowns <!-- key: risks_unknowns -->

<Technical or business risk worth flagging now — distinct from Open Questions below, which are about missing decisions. This is about "here's what could go wrong." Omit if genuinely none.>

## Assumptions <!-- key: assumptions -->

<Anything not explicitly confirmed by the user, filled in as a reasonable default. Each one flagged so stage 01 can challenge it if wrong.>

## Open Questions <!-- key: open_questions -->

<Anything left genuinely unresolved after 3 rounds of questions — carried forward for the user or the next stage to settle before design proceeds.>

## Related Features <!-- key: related_features -->

<Links/references to other /workspace/features folders that overlap, share data, or are otherwise relevant. Different from Dependencies — this is about overlap/awareness, not blocking order.>

## Update Log <!-- key: update_log -->

- <sequential, human-readable notes each time this file is revisited/updated — no strict date format required, just enough to show how understanding evolved.>
```

Keep every section short and in plain language — this file must be readable in under two minutes by a human doing a review pass, per the project's "readability first" priority. Prefer plain sentences over jargon; this is a problem statement, not a spec.

**Why this shape:** the fixed core covers what every downstream stage needs regardless of request type (`01-planning-design` needs Problem/Scope/Impacted Areas to start designing; `04-quality-assurance` needs Success Criteria to write test cases against; `06-ops-documentation` needs Goal/Scope for changelogs). The conditional blocks exist so that the ~20% of requests that are bug fixes, cross-feature-dependent, or touch sensitive data get the extra structure they need — without bloating the other 80% of simple, self-contained feature requests. The fixed order + locked headings + hidden key markers exist so any later stage — human or AI, regardless of the file's display language — can reliably parse this file by section, forever, without re-adapting to wording drift.

---

## 8. Boundaries — What This Skill Does NOT Do

- No database schema design (tables, collections, fields) — that's `database-design` in stage 01.
- No API/event contract design (endpoints, payloads, `.openapi.yaml`/`.asyncapi.yaml`) — that's `api-design` in stage 01.
- No diagrams (ERD, flow, sequence) — stage 01.
- No code, boilerplate, or seed data — stage 02.
- No implementation-level technical decisions (which library, which pattern) — later stages.
- No deep threat-modeling — flagging sensitive data (Section 7) is enough; full analysis is `threat-modeling` in stage 01.

If the user pushes for solution details during this stage ("nên dùng bảng riêng hay không?"), it's fine to note their leaning under `Assumptions` or as a note, but the skill's output should stay a problem statement — solutioning happens in stage 01 with full context.

---

## 9. Anti-Patterns to Avoid

- **Asking one question per message.** Wastes rounds, burns the 3-round cap on things that could've been batched.
- **Asking things answerable from `/docs` or existing feature files.** Read first, ask second.
- **Silently guessing on high-cost decisions.** If getting it wrong would mean redoing DB design or breaking another feature, it's an Open Question, not an Assumption.
- **Writing the idea.md before the checklist is either satisfied or explicitly capped.** Don't produce a half-formed file just to "have output."
- **Solutioning inside the idea file.** If you catch yourself writing a table name or an endpoint path, stop — that belongs to stage 01.
- **Treating `/workspace` output as final/official.** It's AI-authored and reviewable, not a substitute for `/docs`. Never contradict `/docs` silently; if this idea conflicts with a finalized BA doc, surface that conflict explicitly instead of quietly overriding it.
- **Including every conditional section regardless of relevance.** A one-line bug fix doesn't need a `Dependencies` or `Data Sensitivity` heading sitting empty — omit what doesn't apply.
- **Switching to English mid-conversation** because the skill file itself is in English — internal instructions and user-facing language are separate (Section 1.1).
- **Improvising heading translations or reordering sections.** Even a "nicer sounding" synonym or a "more logical" order breaks downstream parsing — always use the fixed mapping table and the template's fixed order (Section 1.1, Section 7).

---

## 10. Example Walkthrough

**Input:**

```
idea: Tôi muốn khách hàng không phải nhập lại địa chỉ mỗi lần mua hàng.
context: Checkout hiện tại.
goal: Giảm thời gian đặt hàng.
constraints: Không thay đổi database quá nhiều.
notes: Chưa biết nên lưu profile hay address book.
```

**Type classification:** Enhancement (extends existing checkout flow).

**Step 3 (context gathering) finds:** an existing `addresses` collection already used by a `shipping` feature in `/workspace/features/003-shipping-labels/mongodb.md`.

**Step 4–5 (gap check + questions, round 1, batched, in Vietnamese):**

> Vài điểm mình cần chốt trước khi viết idea.md:
>
> 1. Đã thấy `addresses` collection dùng cho shipping — checkout này nên dùng chung, hay tách riêng? _(Đề xuất: dùng chung, đỡ trùng dữ liệu — khớp với "không đổi DB nhiều")_
> 2. Khách có thể lưu nhiều địa chỉ (address book) hay chỉ 1 địa chỉ mặc định trên profile? _(Đề xuất: address book nhiều địa chỉ, vì linh hoạt hơn và không tốn thêm bảng)_
> 3. Áp dụng cho guest checkout hay chỉ tài khoản đã đăng nhập? _(Đề xuất: chỉ tài khoản đã đăng nhập, vì guest không có nơi lưu bền)_

User answers 1 and 2, skips 3 implicitly. Round 2 asks only about #3 (still unresolved, still blocking — changes primary actor scope). User confirms. Checklist now complete → write file **in Vietnamese**, using the fixed heading table (`## Vấn đề <!-- key: problem -->`, `## Bối cảnh hiện tại <!-- key: current_context -->`, ...), in the exact template order. `Dependencies` section omitted (none). `Data Sensitivity` section included: "Địa chỉ giao hàng — không phải dữ liệu thanh toán, mức nhạy cảm thấp", flagged for the later threat-modeling stage. No Assumptions needed for the resolved items, Open Questions empty.

---

## 11. Platform Notes (non-normative)

This file is the single source of truth for the skill's behavior. Per-platform pointer files (`.cursor/rules`, a Claude project instruction, a Codex config entry, etc.) should do nothing more than reference this file and tell the host agent to load and follow it — they should not restate or fork the logic above. If a platform needs metadata this file doesn't have (e.g. Cursor's `globs`/`alwaysApply`), put that metadata in the pointer file, not here, so this file stays portable.
