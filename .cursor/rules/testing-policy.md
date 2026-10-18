---
description: Mandatory rules for adding or editing tests (backend & frontend). Applies whenever the agent creates/edits test files, edits code that affects existing tests, or the user describes a bug encountered in the past.
globs:
alwaysApply: false
---

# Testing Rule

This rule applies to **adding** or **editing** tests across any stack. Tests in these projects are **entirely AI-generated** and **run automatically via scripts** — so this rule focuses on guarding against the failure modes typical of AI-written tests, not on teaching basic testing knowledge.

## 0. Scope

- Applies only to **unit tests** and **integration tests**, at the **backend** and **frontend** layers.
- **Never** create, suggest, or escalate toward **e2e tests** in any form (including "e2e-like" integration tests that chain through many real layers to compensate). If a request genuinely requires e2e to verify correctly, state that limitation explicitly instead of building an oversized integration test to cover for it.
- Do not write tests for: trivial getters/setters with no logic, pure CSS/styling, or the internal behavior of third-party libraries.

## 1. Source of Truth for Test Behavior (priority order)

When writing or editing a test, the agent must determine the correct behavior from the following sources, **in this order of priority**:

1. **Bug reproduction description** provided by the user in the current conversation (if any) — this is direct evidence of an actual failure and takes top priority.
2. **Feature documentation/spec** — e.g. a feature's README.md, API design, database design, or finalized acceptance criteria (e.g. under `/workspace/features/<feature>` or `/docs`).
3. **Current code**, used only when (1) and (2) are unavailable. This is the lowest-priority fallback.

If sources conflict (e.g. the code does one thing but the doc or bug report says another), the agent **must not unilaterally decide** which side is correct (neither silently "fixing" the code nor silently rewriting the test to match). Stop, clearly report the conflict, and wait for a decision.

When a test is written based solely on (3) — no doc, no bug report — **flag this clearly** in the output/report: the test hasn't been verified against a spec and carries lower confidence.

## 2. Regression Tests From Described Bugs

When the user describes a bug they encountered in the past along with how to reproduce it — **even without explicitly asking for a test** — the agent must automatically create a corresponding regression test, following this process:

1. Write a test that reproduces the bug's triggering conditions.
2. **Attempt** to run the test against the pre-fix state to confirm it actually fails (proving the test catches the bug). This is not always possible — e.g. the bug was already fixed on another branch, the current code accidentally already fixes it, the required dependency/environment doesn't exist yet, the bug only occurs in production, or it simply can't be reproduced in the test environment. When it's not possible, **report the reason clearly instead of assuming the test is valid** — never fabricate a failure artificially just to satisfy this step.
3. After the fix, run the test again to confirm it passes.
4. Name or comment the test with a short reference to the originating bug, so its purpose is traceable later (if this test fails again in the future, it signals the bug has resurfaced).
5. Do not delete or modify this type of test during refactors unless the behavior it protects has genuinely changed as intended — and state the reason explicitly when doing so.

## 3. Stack Detection & Following Existing Conventions

- Before writing tests, the agent must identify the test runner/framework already used in that project (Jest, Vitest, pytest, etc.) and any stack-specific rules already present in `.cursor/rules`.
- Follow the existing file-naming and file-location conventions in the repo (co-located vs. a separate test directory). Do not restructure existing folders on your own.
- If the project has no established convention yet (new project), pick the most common convention for that stack and state that choice clearly in the report.

## 4. Test Quality — Guarding Against Common AI-Generated Test Failures

- **No tautological tests**: never write a test that merely re-asserts whatever a mock returns, with no real verification value.
- **Test behavior, not implementation detail**: tests must not break from internal refactors that don't change external behavior.
- **When a meaningful edge case or error path exists, it must be covered.** Do not test only the happy path — but also do not invent edge cases or error paths that have no real meaning just to satisfy this rule (e.g. a pure `normalizeLocale(locale) => locale.trim().toLowerCase()` utility may have no meaningful error path, and that's fine).
- Mock/stub appropriately per layer: unit tests isolate dependencies; integration tests may use a real DB/service or a test container — avoid over-mocking to the point the test loses meaning.
- Never weaken an assertion, narrow a test's scope, increase a timeout, add a mock, or change a fixture solely to turn a failing test green without a verified reason. Example of a forbidden move: silently changing `expect(result).toEqual(...)` to `expect(result).toBeDefined()` just to make a red test go green.

## 5. Test Lifecycle Tied to Code Changes

- New feature **with testable logic or behavior** → a corresponding test is mandatory. (A feature that is purely a constant/config/schema with no verifiable logic does not require a bloated test just to satisfy this rule — see Section 0.)
- Refactor of existing code: if a test starts failing, do **not** immediately edit the test. First determine whether the **behavior contract** has actually changed:
  - Refactor → test fails → check the behavior contract → if behavior is unchanged, fix the code; if behavior changed as intended, update the test.
- Bug fix → follow Section 2 (regression test).

## 6. Mandatory Verification — Tests Must Actually Run

- After generating or editing tests, the agent **must run the real test script** and read the actual result — writing the test file is not considered "done."
- **Never** skip, comment out, or alter a test just to make it pass when the underlying code genuinely has a bug. If a test fails, report clearly what failed and why, and let the user decide whether to fix the code or the test.
- Do not edit a test to match the current code purely to reach a green state, unless it has been confirmed via Section 1 that the code is correct and the test itself was wrong.

## 7. Reporting

After each round of adding/editing tests, the agent summarizes:
- The list of tests added/modified, flagging which ones are regression tests (with the related originating bug).
- The source of truth used for each group of tests (bug report / doc / code fallback).
- The scripts run and their actual results (pass/fail).
- Any uncovered gaps, or any source conflicts (Section 1) that remain unresolved.