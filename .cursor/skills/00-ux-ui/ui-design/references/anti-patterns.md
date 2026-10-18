# Anti-patterns

Things that make an interface feel generated, careless or unsafe. Some are acceptable when the brand or product truly calls for them; they are never acceptable as unexamined defaults.

## Process
- Redesigning, restyling or "modernizing" an existing product without being asked.
- Replacing the project's components, fonts or colors with your own; inventing new tokens when equivalents exist.
- Starting with visuals before structure and primary actions are clear.
- Silently changing brand colors, logo or typefaces to fix an issue instead of flagging it.
- Cloning a reference with colored divs instead of real imagery.

## Visual "template tells"
- Purple-to-blue gradients, neon glows, glassmorphism on everything, decorative blurred blobs.
- Identical rounded cards with the same soft shadow chopping every page into a grid; cards inside cards.
- The default hero: centered gradient headline, two buttons, three feature cards, then a fake logo strip.
- A tracked-out ALL-CAPS eyebrow above every heading; one word in a headline accented in a different color; numbered 01/02/03 markers for content that is not a sequence.
- Emoji used as icons; mixed icon sets or stroke weights; icon tiles above every heading.
- Overused default type pairings chosen without reason; gray body text on tinted backgrounds; pure black on pure white.
- Bounce and elastic easing, entrance animation on every section, hover lifts on every card.
- Stock imagery that does not depict the subject (handshakes, laptop-on-desk for a factory app).

## Layout and UX
- Cramming a viewport: tiny type, no gaps, 10+ blocks visible, 12-column tables with nothing hidden.
- Fragmenting a task across many tabs and sub-tabs; nested tabs; unlabeled icon-only navigation.
- Modals inside modals; modals for content that deserves a page; full page loads to peek at a record.
- Several equal primary buttons competing; "Submit" and "OK" labels; destructive actions styled like safe ones.
- Hidden essentials: hover-only actions with no touch alternative, important state only in color, unexplained disabled buttons.
- Placeholder-only labels; validation that appears only after submit and clears the form; blocking paste.
- Infinite scroll with a footer people need; carousels that hide key content; autoplaying media with sound.
- Empty states that just say "No data"; errors that say "Something went wrong".
- Dark patterns: fake urgency ("only 1 left"), hidden fees until the last step, confirm-shaming, forced account creation.

## Data and charts
- Charts as decoration; more than two charts competing in one viewport; charts that dominate the screen.
- Pie charts with many slices, 3D, dual axes, truncated bar axes, rainbow palettes, gauges for simple percentages.
- Random-looking sample data; metrics without units, period or comparison; KPIs nobody can act on.
- Raw JSON, database column names or internal IDs shown to end users.

## Content
- Lorem ipsum, "John Doe", "Acme Inc", round fake numbers, invented testimonials or logos presented as real.
- Buzzword headlines and filler ("Elevate your workflow", "Seamless solutions"); marketing voice inside admin tools.
- Inconsistent names for the same thing across screens; mixed date, number or currency formats.

## Engineering
- Clickable `div`s instead of buttons and links; removed focus outlines; missing alt text or labels.
- Hard-coded colors, spacing and font sizes instead of tokens; magic numbers for layout.
- Images without dimensions; unvirtualized huge lists; layout shift on load.
- Hover-only tooltips holding required information; disabled zoom.
