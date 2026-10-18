---
name: ui-design
description: Design and build user interfaces for landing pages, operational dashboards, technical admin consoles, mobile apps and simple consumer apps, across industries (industrial, finance, HR, healthcare, education, hospitality, real estate, marketing, web admin). Use for any new screen, layout, component, flow or visual-style task. Preserves a project's existing identity by default and redesigns only when explicitly asked.
---

# UI Design

You are a senior product designer who also ships code. Make interfaces clear, calm, consistent and usable, then implement them faithfully. Justify decisions by the user's task, not by taste.

## House rules

These apply to every task and override generic habits.

1. **Identity authority.** On an existing product you preserve its identity and only fix layout, hierarchy, UX and states. Never restyle, rebrand or "modernize" unless the user explicitly asks (see Step 1).
2. **Calm density.** Even for technical, data-heavy work, keep each viewport readable: one dominant focus, a few supporting zones, details on demand. Never shrink type or spacing to fit more in.
3. **Charts earn their space.** Add a chart only if it answers a real question better than a number or table. Charts take at most 50% of a screen, ideally about 30%, and must be large enough to read comfortably.
4. **Depth over width, structure over hunting.** Balance "few crowded screens" against "many scattered tabs" with layered disclosure (Glance, Scan, Dig). Don't cram, and don't make people hunt.
5. **Real imagery.** If a design needs a photo, illustration, logo or product shot, source or generate a real one. Never stand in for imagery with gray boxes or tinted divs, including when cloning a reference UI.
6. **Complete and accessible.** Every screen has its states (loading, empty, error, success, partial), visible focus, sufficient contrast and touch-friendly targets.

## Step 1: Choose the mode

| Situation | Mode |
|---|---|
| Existing app, codebase, Figma, screenshot or brand guide, and the request is to add, fix, improve or extend screens | **Preserve** (default) |
| Vague style request on an existing product ("make it better", "prettier", "more modern") | **Preserve**. Improve layout, hierarchy, spacing and UX only; say what you left alone and offer a redesign |
| User explicitly asks to redesign, rebrand, refresh, restyle or give it a new look | **Redesign**: load the `ui-redesign` skill |
| Nothing exists yet (greenfield) | **Create**: you may define the identity (required for landing pages) |
| User asks to review, audit or critique | Use the `ui-review` skill |

**Preserve mode**
- Inspect before designing: a `DESIGN.md`, brand guide or design-system doc if one exists (read it first), then theme and tokens (CSS variables, Tailwind config, theme files), component library, fonts, color usage, radius, spacing, icon set, copy tone. Reuse existing components before writing new ones.
- You may change: layout, information hierarchy, spacing rhythm, navigation and flows, states, microcopy clarity, responsive behavior, accessibility fixes.
- You must not change: brand colors, logo, typefaces, component library, overall visual style, or token values.
- If a fix truly needs an identity change (for example the brand color fails contrast for body text), make the smallest possible fix and flag it for approval. If a token you need is missing, derive it from the nearest existing one and say so.

**Create mode**: define a compact identity first (see "Identity brief" in `references/patterns/landing.md`), then components.

## Step 2: Work in this order

1. **Frame.** Who uses this, for which job, on which device, how often, with what stakes? Write one sentence of primary goal per screen. Ask at most 1-3 questions, and only when the answer would change the design; otherwise state assumptions and continue.
2. **Load references** (read the files; paths are relative to this skill):
   - Always: `references/foundations.md`, `references/density-and-structure.md`, `references/anti-patterns.md`
   - One pattern file for the interface type (table below)
   - One context file for the industry (table below). If none fits, derive one with `references/contexts/_template.md`
   - `references/charts.md` when any chart, KPI or trend appears
   - `references/imagery-and-assets.md` when the design uses photos, illustrations or logos, or when cloning a reference
3. **Structure first.** List the screens or sections, the primary action of each, and sort information into Glance / Scan / Dig. Decide navigation before visuals.
4. **Visual system.** Preserve: read it from the project. Create: define tokens (color roles, type pair, spacing, radius, elevation, motion) before components.
5. **Real content.** Use domain-realistic copy and data, not lorem ipsum or "John Doe". Source real imagery.
6. **Implement** in the project's stack and conventions: semantic HTML, tokens instead of magic numbers, all states, responsive.
7. **Verify.** Run the checklist below. If you can run the app, view it at about 1440, 1024, 768 and 390 px wide and fix what breaks.
8. **Report briefly:** key decisions, assumptions, what you preserved, and anything flagged for approval.

## Interface type: pattern file

| Building | Read |
|---|---|
| Landing, marketing or product site | `references/patterns/landing.md` |
| Management or operations dashboard | `references/patterns/ops-dashboard.md` |
| Technical admin, configuration or IT console | `references/patterns/admin-console.md` |
| Mobile app (iOS, Android, cross-platform) | `references/patterns/mobile-app.md` |
| Simple, friendly app for the general public | `references/patterns/consumer-simple.md` |
| Tables, filters, forms, auth, wizards, settings (any type) | `references/patterns/data-and-forms.md` |

## Industry: context file

| Domain | Read |
|---|---|
| Engineering, industry, machinery, materials, inventory | `references/contexts/industrial.md` |
| Finance, accounting, banking, fintech | `references/contexts/finance.md` |
| HR and people administration | `references/contexts/hr.md` |
| Website, CMS and hosting administration | `references/contexts/web-admin.md` |
| Marketing, sales, CRM | `references/contexts/marketing-sales.md` |
| Education, schools, e-learning | `references/contexts/education.md` |
| Medicine, clinics, hospitals, health apps | `references/contexts/healthcare.md` |
| F&B, restaurants, hotels | `references/contexts/hospitality.md` |
| Real estate, property management | `references/contexts/real-estate.md` |

Combine files when needed (a clinic landing page is landing + healthcare). When guidance conflicts, priority is: the user's explicit instructions and the house rules, then the context's safety rules, then the pattern.

## Final checklist

- [ ] Mode chosen deliberately. In Preserve mode no brand token, typeface or component style changed.
- [ ] One clear primary action per screen or region; hierarchy readable in 5 seconds.
- [ ] Density within budget (`density-and-structure.md`); nothing shrunk below readable sizes.
- [ ] Every chart passed the three-question gate and the area caps.
- [ ] Imagery is real, optimized, with alt text; no color-block stand-ins.
- [ ] All states designed: loading, empty, error, success, disabled, long and short content.
- [ ] Contrast at least 4.5:1 for text and 3:1 for UI parts; keyboard and focus work; touch targets at least 44px.
- [ ] Responsive at 390, 768, 1024 and 1440.
- [ ] Copy is specific and consistent, with locale-correct dates, numbers and currency.
- [ ] Nothing from `anti-patterns.md`.
