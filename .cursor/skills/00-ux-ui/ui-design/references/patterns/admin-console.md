# Pattern: Technical Admin Console

Audience: administrators, engineers, IT and support staff. They value precision, control, safety and auditability over decoration. They tolerate higher information needs, but still not a wall of data: keep the calm-density rules.

## Layout

- **Navigation:** left sidebar grouped by domain (Overview, Resources, Access, Monitoring, Settings) with section labels; at most 7 groups; command palette (`Ctrl/Cmd+K`) for jumping to anything.
- **Resource pages:** list, then a **master-detail** pane or detail page with a sticky header (name, ID with copy button, status, environment, primary actions) and tabs for aspects (Overview, Configuration, Activity, Permissions, Logs). First tab is a summary.
- **Environment awareness:** production versus staging shown persistently and unmistakably (header badge, tinted top bar, never only color).
- **Configuration forms:** grouped sections with descriptions, sensible defaults, sticky save bar showing unsaved changes, a "reset to default" per field when it matters. Move rare options into an "Advanced" accordion.

## Rules

- **Safety:** destructive or production-affecting actions need a specific confirmation (name the resource and the effect; typing the resource name for the most dangerous). Offer **preview or diff before apply**, dry-run when possible, and undo or rollback. Keep a clearly separated "Danger zone".
- **Auditability:** show who changed what and when; link changes to an activity log; timestamps show relative time on the surface and absolute time with time zone on hover.
- **Logs and events:** monospace, filter by level and time range, search, pause live tail, copy line, link to context. Never auto-scroll while the user is reading.
- **Permissions:** role-by-resource matrix with search, grouping and tri-state toggles; explain inheritance; show effective access for a user.
- **Secrets:** shown once, masked by default with reveal and copy; never in URLs or logs.
- **Status and health:** simple semantic states with cause and next step ("Degraded: queue lag 4 min, view queue").
- **Errors:** include the error code, a plain-language cause and a remedy, plus a "copy details" action for support.
- **Identifiers:** monospace for IDs, hashes, paths and code; tabular numerals; truncate in the middle with full value on hover and copy.
- **Bulk operations:** select, preview impact, run with progress and a result report (what succeeded, what failed, why, retry failed).
- **Keyboard:** shortcuts for frequent actions, visible hints, full keyboard operation of tables and menus.
- **Density:** regular rows (36-40px) by default with a compact toggle; keep 5-8 columns visible with a column picker.

## Don'ts

- Raw JSON or YAML as the only way to configure something. Offer a form and an optional advanced editor.
- Modals stacked in modals; wizards for tasks that are one form.
- Burying critical state (environment, quota, outage) in a settings page.
- Hiding permission failures: say what permission is missing and who can grant it.
- A dozen top-level tabs; use grouped navigation and search.
