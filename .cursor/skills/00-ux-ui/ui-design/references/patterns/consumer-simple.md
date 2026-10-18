# Pattern: Simple, Friendly Interface for the General Public

Audience: non-technical people, any age, often on a phone, often infrequent users. They don't read; they scan. The interface should feel obvious, forgiving and unhurried.

## Principles

- **One task per screen, one obvious next step.** At most one primary button; everything else is visually quieter.
- **Low density.** Aim for 3-5 meaningful elements per screen. Whitespace is a feature. No dense tables; use lists and cards with generous padding.
- **Plain language.** Everyday words, short sentences, no internal jargon or abbreviations. Buttons say what will happen ("Book appointment", "Pay 250,000 ₫").
- **Large and readable.** Body text 16-18px, key actions 48px or taller, strong contrast, labels on icons. Don't depend on gestures or hover.
- **Guided.** For multi-step tasks use a stepper with "Step 2 of 4", clear back, saved progress, and a review step before commitment.
- **Forgiving.** Accept varied input formats (phone numbers, dates), autofill and sensible defaults; allow undo; never lose typed data; explain errors in human terms and say how to fix them.
- **Reassuring.** Show confirmation of outcomes ("Booked: Tuesday 9:00, with a map and a reminder"). Show privacy and payment security cues where money or personal data is involved.
- **Limited navigation.** At most 5 top-level destinations with visible labels; a persistent way to get help.

## Layout recipes

- **Home:** greeting or status, one primary card ("What do you want to do?"), a short list of recent or upcoming items, help.
- **Lists:** 56-72px rows, a clear title, one line of secondary text, a status chip with text, large tap area.
- **Forms:** single column, one question group at a time on mobile, inline help, input masks that help rather than block.
- **Empty and first-use:** illustration or photo, one sentence of guidance, one action.
- **Onboarding:** none if possible; otherwise 2-3 screens with value, then a first success within a minute.
- **Support:** visible help, contact options in the user's usual channel, and plain error pages that offer a way back.

## Visual tone

Warm, clear and friendly rather than clinical or flashy: rounded but not childish shapes, a restrained palette with one confident brand color, real photography or friendly illustration with consistent style. Match the industry context for tone and trust.

## Data

Show personal progress or history simply (one number, one small bar or ring). Avoid dashboards. Charts, if any, are small, labeled in words ("You walked 20% more this week"), and secondary to text.

## Accessibility for older and less experienced users

- Contrast above 4.5:1, no low-contrast placeholder instructions, text resizable to 200%.
- No time-limited actions without warning and extension; no auto-advancing carousels.
- Confirm irreversible steps with plain consequences; offer phone or chat help for payments.

## Mistakes

- Clever copy that hides meaning; icon-only controls; hamburger-only navigation.
- Pushing sign-up before showing value; requiring accounts for simple tasks.
- Packing "helpful" extras that crowd the main action.
