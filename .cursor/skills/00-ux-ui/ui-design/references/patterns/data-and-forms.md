# Pattern: Data, Forms and Flows

Shared building blocks for tables, filters, forms, auth, wizards, settings and import/export. Use alongside any other pattern.

## Tables

- Purpose first: if the user compares or scans many records, use a table; for a few rich items, use cards or a list.
- Sticky header, and a sticky first column when scrolling horizontally. Row height 44-48px comfortable, 36-40px compact. 5-8 columns visible; a column picker for the rest.
- Align text left, numbers and currency right with tabular numerals and consistent decimals; units in headers, not repeated in cells.
- Sorting on meaningful columns with a visible indicator; default sort stated. Pagination or "load more" for hundreds of rows, virtualization for thousands.
- Row interactions: row click opens a drawer or detail; row actions in a kebab menu (frequent ones visible on hover and always available to keyboard and touch); checkbox selection with a bulk-action bar that appears on selection.
- Status as a chip with icon and text. Truncate long text with a full-value tooltip or expand; never let a column break the layout.
- States: loading skeleton rows, empty with a next step, no results with "clear filters", error with retry.
- Saved views and a density toggle for power users.

## Search and filters

- A search box for large sets, with forgiving matching (diacritics, partial). Up to 4 visible filters, "More filters" for the rest; applied filters as removable chips; a clear "Reset".
- Keep filter and sort state in the URL and restore it when navigating back.

## Forms

- Single column by default; two columns only for short related pairs (city and postal code). Group into sections with headings; up to 7 fields per section.
- Labels above fields, always visible; helper text for format and why you ask; mark optional fields rather than required ones when most are required.
- Validate on blur and on submit; inline messages say how to fix; on submit focus the first error and summarize if there are many.
- Correct `type`, `inputmode`, `autocomplete`; allow paste; input masks only when they don't fight the user; sensible defaults and remembered choices.
- Long forms: split into steps with progress, autosave drafts, allow leaving and returning. Warn before discarding unsaved changes.
- Submit button states: default, loading (disabled with progress), success. The label says the action.
- Destructive and irreversible actions are separated from the Save area.

## Authentication and onboarding

- **Sign in:** email or phone, password with show/hide, a visible "Forgot password", SSO buttons when used, a passkey or OTP option where available. Errors don't reveal whether an account exists. Avoid CAPTCHAs unless risk requires.
- **Sign up:** ask for the minimum (email and password, or phone). Show password rules up front. Defer profile details (progressive profiling). State terms plainly with a checkbox only where legally required.
- **OTP input:** one field or segmented, auto-advance and paste support, resend timer, clear error, accessible labels.
- **Sessions:** explain expiry before it happens and keep drafts.
- **First run:** an empty state with the single most valuable action, optionally a checklist (3-5 items) that shows progress.

## Wizards and multi-step flows

- Use only when steps are truly dependent. At most 5 steps, a clear progress indicator, a back button that preserves input, a review step before commit, and a confirmation with next actions.

## Settings

- Group by user intent (Profile, Notifications, Security, Billing), not by system module. Search settings when there are many.
- Be consistent: either instant-save with confirmation feedback, or explicit Save with a sticky bar, but not mixed within a page.
- Dangerous settings in a separate section with clear consequences.

## Import and export

- Offer a template, accept common formats, validate before commit with a preview and a downloadable error report (row, column, reason). Show progress and a result summary.
- Exports respect current filters, say what is included, and name files meaningfully.

## Notifications and feedback

- Inline for fields, toast for non-blocking results (with undo when possible), banners for page-level states, modal only for decisions. Don't use toasts for errors that need action.
