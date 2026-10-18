# Foundations

Universal rules. In Preserve mode, apply them through the project's existing tokens; never swap the tokens themselves.

## Hierarchy and layout
- One focal point per screen. Rank content P1 (always visible), P2 (visible on scroll or in a secondary zone), P3 (on demand).
- Group by proximity: space between groups is at least 2x the space inside a group. Use whitespace before borders, borders before fills.
- Use an 8px grid (4px for fine adjustments). Gutters 16 or 24px. Section spacing 24-48px in apps, 64-120px on landing pages.
- Align to few vertical edges. Left-align text and numbers' labels; right-align numeric columns.
- Reading width 45-75 characters for prose. App shells may be fluid; marketing content max-width 1120-1280px.
- Cards are for independent, scannable objects, not a default wrapper. Never nest cards in cards.

## Typography
- One family, or two with clearly different roles. Maximum 3 weights.
- Scale roughly 12 / 14 / 16 / 20 / 24 / 32 / 40 (ratio 1.125-1.25). Body 14-16px in apps, 16px+ on landing pages and mobile. Nothing meaningful below 12px.
- Line-height 1.4-1.6 for body, 1.1-1.3 for headings. Tabular numerals in tables, prices and metrics.
- Avoid long ALL-CAPS text, justified text and low-contrast gray for primary content.
- **Vietnamese and other diacritic-heavy scripts:** pick a font with a full Vietnamese subset (for example Be Vietnam Pro, Inter, Noto Sans, Roboto, Source Sans 3), use line-height of at least 1.4, and test long strings, since translated text is often 20-40% longer.

## Color
- Define roles, not hues: neutral scale (9-11 steps), one primary, optional accent, semantic success / warning / danger / info, plus surface and border tokens. Roughly 60% neutral, 30% secondary surfaces, 10% brand and accent.
- Contrast: 4.5:1 for body text, 3:1 for large text, icons, borders of inputs and focus rings.
- Never rely on color alone: pair status color with an icon or text.
- Reserve saturated color for actions and status. Tint neutrals slightly toward the brand hue; avoid pure black on pure white.
- Dark mode is a separate token set, not an inversion. Test contrast again.

## Components
- Button hierarchy: one primary per region, then secondary, tertiary (ghost), destructive. Label with a verb ("Save changes", not "Submit"). Heights 32 / 40 / 48px.
- Pick one or two corner radii and one shadow scale for the whole product.
- Use one icon set, one stroke weight, sizes 16 / 20 / 24. Icon-only buttons need an accessible name and tooltip.
- Inputs 40px high on desktop, 44-48px on touch. Labels above fields, always visible (no placeholder-only labels). Helper text under, errors under.
- Badges and chips: short labels, consistent semantics across the product.

## States (design all of them)
Default, hover, focus-visible, active, disabled (say why or hide), loading, empty, error, success, partial data, offline, no permission, first use, and extreme content (very long, very short, many items).
- Loading: skeletons for content areas, spinner only for short actions; keep layout stable.
- Empty: say what belongs here, why it is empty, and offer the next action.
- Error: say what happened and how to fix it, keep the user's input, offer retry. No blame, no apology boilerplate.
- Destructive actions: name the object and consequence in the confirmation, prefer undo to "are you sure".

## Navigation and feedback
- At most 7 top-level destinations. Always show where the user is. Breadcrumbs at depth 3 or more. Reflect filters, tabs and pagination in the URL.
- Use real links and buttons, not clickable divs.
- Feedback: inline for fields, toast for non-blocking confirmation, modal only for decisions that need a choice. Toasts must not hold essential information.

## Motion
- Micro-interactions 120-200ms, transitions 200-300ms, ease-out for entering. Animate `transform` and `opacity` only; never `transition: all`.
- Motion must explain a change (opening, moving, confirming), not decorate. Honor `prefers-reduced-motion`.
- At most one orchestrated moment per page (for example a hero reveal). No fade-and-slide on every section.

## Accessibility baseline
- Semantic HTML first, ARIA only when needed. Landmarks, one `h1`, ordered headings, skip link.
- Everything keyboard reachable with a visible `:focus-visible` ring; never remove outlines without a replacement.
- Touch targets at least 44x44px (48dp on Android) with spacing. No information only on hover.
- Support 200% zoom and text scaling without clipping. Images have meaningful alt text, decorative images empty alt.
- Forms: associated labels, errors linked to fields, correct `type`, `inputmode` and `autocomplete`, never block paste.

## Responsive
- Mobile-first. Breakpoints near 640, 768, 1024, 1280.
- Wide tables become cards, or scroll horizontally with a sticky first column. Respect safe areas on mobile.
- Reorder by priority on small screens, don't just stack in source order.

## Performance and robustness
- Images sized with width and height, lazy-loaded below the fold, modern formats. Fonts with `font-display: swap`, subset as needed.
- Virtualize lists beyond about 50 rows. Avoid layout shift.
- Handle truncation deliberately: wrap or truncate with a full-value path; flex children need `min-width: 0` to truncate.

## Content and localization
- Sentence case, active voice, specific verbs, consistent terms for the same thing across the product.
- Use `Intl` or the framework's formatters for dates, numbers and currency; follow the user's locale (for example Vietnamese: dd/MM/yyyy, 1.234.567 ₫). Show time zones when deadlines matter.
- Write real, domain-specific sample content.
