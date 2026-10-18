# Pattern: Management and Operations Dashboard

Audience: managers, supervisors and operators who check it daily. It must answer three questions in seconds: **What is happening? What needs me now? How are we doing against target?**

## Layout (desktop reference)

- **Shell:** left sidebar 220-260px (collapsible to icons), top bar with search, notifications, date range, organization or site switcher, user menu. Page header with title, scope filters and one primary action.
- **Zone A, needs attention (Glance):** alerts, overdue items, exceptions, as an actionable list (not a banner wall). Hide the zone when empty, or show a reassuring "All clear".
- **Zone B, KPIs (Glance):** 3-5 tiles with value, delta vs target or previous period, optional sparkline. Each links to its filtered list.
- **Zone C, trend (Scan):** one primary chart (about 30% of the page, never above 50% combined), plus at most one small supporting visual. See `charts.md`.
- **Zone D, working set (Scan):** a table or list of work items (orders, tickets, machines, tasks) with status, owner and due date. Row click opens a drawer (Dig).

Optional fifth zone for recent activity. If everything is "important", nothing is: pick one dominant block.

## Rules

- **Actionable by default:** every number or status leads somewhere (a filtered list, a record, a task).
- **Comparison and context:** show target, previous period or threshold next to every key metric; state the period and data freshness.
- **Status language:** a small semantic set (for example OK, Attention, Critical, Inactive) with consistent color plus icon plus text.
- **Role-aware:** a manager sees team-level, an operator sees "my work". Prefer role presets or saved views to a dozen filters.
- **Date range and filters** in one place at the top; applied filters shown as chips; state persists.
- **Real-time:** update numbers subtly (no flashing), show "last updated", and handle stale or disconnected data explicitly. Stale is never shown as zero.
- **Drill path:** Overview, then list, then record in a drawer. Breadcrumbs when entering a detail page.
- **Export and share:** CSV and print-friendly view for reports; a shareable URL that preserves filters.
- **Wall or TV mode** (when needed): larger type, 4-6 elements, auto-refresh, no interaction.
- **Density:** comfortable by default; offer compact for power users (see `density-and-structure.md`).

## Responsive

- Tablet: sidebar collapses; KPI tiles wrap 2 per row; table keeps key columns.
- Mobile: single column in priority order (needs attention, KPIs, list); no wide tables (use cards); at most one small chart per fold.

## Common mistakes

- A "dashboard of everything" with 8+ charts and no hierarchy.
- KPI tiles with no baseline, so a number can't be judged.
- Dense table above the fold pushing the Glance layer away.
- Alerts that can't be acknowledged, snoozed or traced to a cause.
