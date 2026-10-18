# Density and Structure

The core problem: improving UX by merging everything into few screens leads to crammed UIs; improving UI by splitting everything leads to many tabs and paths. Resolve it with **layered disclosure**, not by choosing a side.

## Principle

> Fewer screens must not mean more stuff per screen: add depth inside the screen (drawers, panels, expandable rows), not width.
> More structure must not mean more hunting: add an overview, search and cross-links.

## Layers

| Layer | User question | Where it lives |
|---|---|---|
| **Glance** | "What's the state? What needs me?" (under 5 seconds) | Top of the screen: status, 1-2 primary numbers, alerts, the primary action |
| **Scan** | "Show me the working set." | Same screen: lists, tables, filters, one supporting chart |
| **Dig** | "Tell me everything about this one thing." | Side drawer, split view, expandable row, modal for short tasks, or a detail page when it is a destination (shareable URL, long editing) |

Every screen is designed top-down through these layers. P1 information belongs in Glance, P2 in Scan, P3 in Dig.

## Density budget per viewport

Reference viewport: 1440x900 desktop, 390x844 mobile.

| Element | Budget |
|---|---|
| Information blocks visible without scrolling (cards, tables, charts, panels) | 4-6 on desktop, with exactly one dominant; 2-3 on mobile |
| KPI tiles in a row | 3-5 |
| Charts in one viewport | 1-2 on desktop (3 only as small multiples); 1 on mobile |
| Table columns visible by default | 5-8; the rest behind a column picker or an expandable row |
| Table rows visible | 8-12 at comfortable height (44-48px rows; 36-40px in compact) |
| Visible filters | up to 4, the rest under "More filters"; show applied filters as removable chips |
| Form fields per visible section | up to 7, in one column (two columns only for short related pairs) |
| Tabs on one object | up to 5 (6 with "More") |
| Primary actions per region | 1 |

Hard floors: body text 14px or larger, 16px or more between cards, 24px or more between sections. If content doesn't fit the budget, apply the reduction ladder below instead of shrinking.

## Reduction ladder (when a screen feels too dense)

1. **Remove.** Does anyone need this? Which role, how often?
2. **Defer.** Move P3 to Dig (drawer, expand, tooltip with a link).
3. **Regroup.** Sections with clear headings, accordions for rarely used groups, summary lines that expand.
4. **Split by question.** If the screen answers two unrelated questions, give each its own tab or page.
5. **Last resort: new page.** Only when the content is a destination in its own right.

## Structure rules

1. One screen per **job to be done**, not per database table.
2. Within one object (a machine, patient, order, campaign), use tabs for aspects. First tab is an **Overview** that summarizes the others and links into them. Tab content must be useful on its own.
3. Prefer **in-context disclosure** (drawer, panel, inline expand) for peeking. Navigate away only when the user will work there for more than a minute or needs a shareable URL.
4. Depth limit: a frequent task is at most 2 navigation steps from its module home; a rare task at most 3. Every page has a URL.
5. Provide global search and cross-links (object names are links), so users never need to remember paths.
6. Keep context while diving: sticky object header (name, status, primary action), breadcrumbs, back returns to the previous filter state.

## Smell tests

- A user must open 3 or more tabs to answer one question: **too fragmented**. Merge tabs, add an overview.
- One screen answers 2 or more unrelated questions, or needs horizontal scrolling to be understood: **too crammed**. Split by question, defer to Dig.
- More than 6 tabs, or nested tabs: regroup or move rare tabs into "More" or settings.
- Users keep exporting to a spreadsheet to compare: add a comparison view or saved views.
- Two screens differ only by a filter: make it one screen with a saved view.

## Making dense domains calm

- **Summaries before raw data:** status badges, deltas, one-sentence digests ("3 machines need attention").
- **Master-detail split** instead of navigating: list on the left, detail on the right.
- **Saved views and presets** for the way each role works; remember last state.
- **Density toggle** (Comfortable default, Compact opt-in) for power users. Never default expert-compact for general users.
- **Inline editing and quick actions** on rows (hover or kebab menu) rather than new pages.
- **Bulk-action bar** appears only when rows are selected.
- **Sticky headers** (table header, first column, object banner) so context survives scrolling.
- **Typographic structure over boxes:** headings, spacing and alignment before borders and cards.
