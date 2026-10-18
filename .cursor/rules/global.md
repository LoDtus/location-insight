# GLOBAL RULES (APPLIES TO ALL STACKS)

---

## 1. CORE ENGINEERING PRINCIPLES

- Readability > Maintainability > Conciseness
- Prefer simple, explicit solutions over complex ones
- Avoid over-engineering
- Follow existing patterns in each codebase
- Keep changes minimal and incremental

---

## 2. LANGUAGE & TYPE SAFETY

- Use strict typing where available (TypeScript / Python typing / etc.)
- Never use unsafe types (e.g. `any` in TypeScript)
- Prefer explicit types over implicit inference when clarity is needed

---

## 3. NAMING & CONSISTENCY (HIGH LEVEL ONLY)

- Use consistent naming within each stack
- Do not mix naming conventions in the same context
- Follow existing project naming style if already defined

---

## 4. CODE QUALITY RULES

- Keep functions small, single-responsibility, and easy to understand
- Avoid deep nesting and overly complex logic
  - Maximum recommended nesting depth: 7 levels (see exception rules in architecture section if applicable)
- Prefer early return over deeply nested conditional structures
- Follow DRY principle (avoid duplicated logic)
- Prefer clarity over clever or overly abstract implementations

---

## 5. ERROR HANDLING (UNIVERSAL)

- Always handle errors in async operations
- Never silently ignore errors
- Always log or surface errors appropriately
- Do not suppress exceptions without justification

---

## 6. SECURITY BASICS

- Never expose sensitive data (tokens, passwords, secrets)
- Never log sensitive information
- Always treat external input as untrusted
- Sanitize inputs where applicable

---

## 7. DEPENDENCY CONTROL

- Do not introduce new dependencies without justification
- Prefer stable, widely adopted, production-ready libraries
- Avoid experimental or unmaintained packages

---

## 8. ARCHITECTURE AWARENESS (GENERIC ONLY)

- Respect module boundaries in all systems
- Avoid tight coupling between components
- Avoid circular dependencies where applicable
- Use standard import mechanisms supported by the stack (e.g. path alias if available)

---

## 9. DEVELOPMENT DISCIPLINE

- Always understand existing code and its intent before making changes
- Refer to official documentation or specs only when necessary:
  - behavior is unclear
  - library usage is uncertain
  - version-specific behavior may affect correctness

- Do not introduce unnecessary refactors
- Avoid modifying unrelated parts of the system
- Prefer incremental, small, and safe changes over large-scale rewrites
