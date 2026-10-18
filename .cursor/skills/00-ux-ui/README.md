# UI/UX Skills for Cursor

Three Agent Skills that make Cursor design and build interfaces like a senior product designer.

| Skill | Use it for |
|---|---|
| `ui-design` | Building or changing any screen: landing pages, ops dashboards, technical admin consoles, mobile apps, simple consumer UIs, across 9 industry contexts |
| `ui-review` | Auditing an existing UI and reporting prioritized findings (read-only) |
| `ui-redesign` | Changing a product's identity and look. Runs only on explicit request |

## Install

Copy the three folders into one of these locations:

- **One project:** `<your-project>/.cursor/skills/`
- **All projects:** `~/.cursor/skills/`

```
.cursor/skills/
  ui-design/
  ui-review/
  ui-redesign/
```

Restart Cursor or reload the window. If the skills do not appear, check that Agent Skills are enabled in Cursor's settings for your version. Invoke explicitly by typing `/ui-design`, `/ui-review` or `/ui-redesign` in the Agent chat, or let Cursor pick by the skill descriptions.

## Behavior in short

- **Preserve by default.** On an existing product the agent keeps your brand, tokens, fonts and components, and only improves layout, hierarchy, UX and states. It redesigns only when you say so explicitly.
- **Calm density.** Moderate information per viewport; layered disclosure instead of cramming or tab explosions.
- **Charts only when meaningful,** at most 50% of the screen (about 30% ideal).
- **Real images.** The agent sources or generates real imagery instead of colored placeholder blocks, and records licenses.

## Structure

```
ui-design/
  SKILL.md                         entry point: modes, workflow, routing, checklist
  references/
    foundations.md                 typography, color, components, states, a11y, responsive
    density-and-structure.md       density budget, layered disclosure, tab and depth rules
    charts.md                      when to chart, size caps, chart choice, KPI tiles
    imagery-and-assets.md          sourcing, licensing, optimization, no placeholder blocks
    anti-patterns.md               template tells and UX/engineering mistakes
    patterns/                      landing, ops-dashboard, admin-console, mobile-app,
                                   consumer-simple, data-and-forms
    contexts/                      industrial, finance, hr, web-admin, marketing-sales,
                                   education, healthcare, hospitality, real-estate, _template
ui-review/SKILL.md
ui-redesign/SKILL.md
```

## Extend

- Add an industry: copy `references/contexts/_template.md`, fill it in, and add one row to the context table in `ui-design/SKILL.md`.
- Add an interface type: create a file in `references/patterns/` and add a row to the pattern table.
- Pin your own brand: add a `DESIGN.md` to your project (colors, fonts, radius, spacing, tone). Preserve mode reads and follows it.
