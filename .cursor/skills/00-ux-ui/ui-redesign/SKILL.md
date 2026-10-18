---
name: ui-redesign
description: Redesign, rebrand, refresh or restyle an existing product's visual identity and UI. Use ONLY when the user explicitly asks for a redesign, rebrand, new look, restyle or visual overhaul of an existing product. If the user has not clearly authorized changing the look and identity, do not use this skill; use ui-design in Preserve mode instead.
---

# UI Redesign

Changing a product's identity is a significant decision that belongs to the user. This skill exists for when they have made it.

## Step 0: Authorization gate (mandatory)

Proceed only if the user's request explicitly asks to redesign, rebrand, refresh, restyle, modernize the whole look, or similar, for the product or a named part of it.

- **Not authorized or ambiguous** ("make it better", "improve the UI", "it looks old" without a request to change it): **stop**. Continue with `ui-design` in Preserve mode: fix layout, hierarchy, UX and states, and mention that a redesign is available if wanted.
- **Authorized but scope unclear:** ask one short question to fix the level and the scope, then proceed.

| Level | Changes | Keeps |
|---|---|---|
| **Refresh** | Colors, type, spacing, component polish, imagery treatment | Logo, structure, layouts, flows |
| **Restyle** | A new visual language across tokens and components | Information architecture, flows, content |
| **Rebrand** | Name-level identity: logo, palette, type, voice, imagery | Only what the user lists |

Work at the lowest level that satisfies the request. Anything above the authorized level, such as changing the logo during a Restyle, needs separate approval. Authorization covers the named scope only (for example "the landing page"), not the rest of the product.

## Step 1: Audit the current state

1. Read the code, tokens and components, and open the running app or screenshots.
2. Write three lists: **Keep** (what users rely on: conventions, workflows, vocabulary, content, accessibility wins), **Fix** (what fails users or the brand), **Change** (what the authorized level covers).
3. Record constraints: stack and component library, URLs, test IDs, i18n keys, brand assets the user insists on, deadlines, supported devices.

Never change business logic, data models, routes, API contracts or copy meaning as part of a redesign.

## Step 2: Define the direction

Apply the same discipline as the Identity brief in `ui-design/references/patterns/landing.md`, and read the relevant files in `ui-design/references/` (foundations, density-and-structure, charts, imagery-and-assets, anti-patterns, the matching pattern and context).

Write a short direction, 10 lines at most:
1. Audience and what the new look must say about the product (3 personality words).
2. What changes and what stays (from your Keep list).
3. Palette with roles and checked contrast; type pairing (with full support for the product's languages); shape language; imagery direction; motion character.
4. Density posture and any structural changes (only if the level allows it).

Be specific to this product and industry, not a trend. If the user wants options, give two clearly different directions with one recommendation; otherwise commit to one.

Present the direction and, for Rebrand or large changes, wait for a go-ahead before migrating many screens. For a Refresh with a clear brief, proceed and report.

## Step 3: Migrate incrementally

Work in this order and keep each step shippable:

1. **Tokens first:** color roles, type scale, spacing, radius, elevation, motion, dark mode. Single source of truth.
2. **Shared components:** buttons, inputs, navigation, tables, cards, badges, charts, with all states.
3. **Key screens:** the highest-traffic or highest-value flows, proving the system.
4. **Remaining screens:** apply the system; avoid one-off exceptions.
5. **Assets:** logo (Rebrand only), icons, imagery, favicons, social images, empty-state art. Source real images (see `imagery-and-assets.md`); no color-block stand-ins.

Prefer small reviewable changes (a branch or commit per step) so the user can stop or roll back at any point. Do not mix refactors with visual changes.

## Step 4: Verify parity and quality

- No functionality, content or states were lost; flows still work; keyboard and screen-reader behavior is not worse.
- Contrast, focus, targets and responsive behavior meet `foundations.md`.
- Density budget and chart rules hold; nothing from `anti-patterns.md` crept in.
- Existing tests, IDs, routes and i18n keys still work.
- Compare before and after at 1440, 1024, 768 and 390 px.

## Step 5: Report

Summarize in a short note: what changed (tokens, components, screens), what you deliberately kept, any compromises or open items (for example assets that need real photography or a licensed font), how to roll back, and what remains if the redesign is partial. Offer `ui-review` for an independent audit.
