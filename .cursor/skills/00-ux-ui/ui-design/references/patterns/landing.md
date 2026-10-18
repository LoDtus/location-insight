# Pattern: Landing Page

Goal: one visitor, one decision. Everything on the page moves a specific audience toward one primary action (sign up, book, buy, contact, download).

## Identity first (Create mode)

A landing page needs a coherent identity. If the project already has one, **preserve it** and skip this section. If there is none and the user asked for a new page, define it before layout:

**Identity brief** (write it down in 8 lines, then use it as tokens):
1. Audience and the one thing they want.
2. Brand idea in one sentence, and 3 personality words (for example "precise, warm, confident").
3. Palette: neutral scale + one primary + one accent + semantic colors, derived from the personality and the industry context, not from a trend. Check contrast.
4. Type: one display or heading face with character plus one text face (or one family used well); verify full Vietnamese support when relevant.
5. Shape language: radius, stroke, density of ornament; consistent across buttons, cards, inputs and imagery.
6. Imagery direction: photography, illustration or 3D; subject, lighting, color grade (see `imagery-and-assets.md`).
7. Logo: simple SVG wordmark plus symbol, works at 16px and in one color.
8. Voice: how the page speaks (plain, expert, friendly), and 3 words to avoid.

The identity should feel specific to the subject: a plant-nursery page and a freight-software page must not look alike.

## Structure (reorder to fit the goal)

1. **Header:** logo, 4-6 links, one primary CTA. Sticky and compact on scroll.
2. **Hero:** headline stating the outcome in 12 words or fewer, one supporting sentence, primary CTA plus one quiet secondary, and a visual that shows the real product or subject. Include one trust cue (a real number, rating or recognizable proof) above the fold.
3. **Proof strip:** real client logos or press, or flagged sample content.
4. **Problem and value:** what hurts today and what changes.
5. **How it works:** 3-4 steps, only if it truly is a sequence.
6. **Benefits and features:** grouped by user outcome, up to 6; show the product in context rather than listing icons.
7. **Deeper proof:** case study, results with real numbers, testimonials with name and role. A chart appears only if it is the proof.
8. **Pricing or offer** (if applicable): 2-3 plans, a recommended one, clear differences, no hidden fees.
9. **FAQ:** 5-8 real objections answered.
10. **Final CTA:** the same action and label as the hero.
11. **Footer:** navigation, contact, legal, language.

## Rules

- One primary action, repeated with the same label at natural decision points. Secondary links stay visually quiet.
- Copy is concrete: who, what, result, proof. No filler adjectives. Headlines are the story if only they are read.
- Vary section layouts and backgrounds for rhythm; keep a single grid and spacing system. Section padding 64-120px desktop, 40-64px mobile.
- Forms ask for the minimum (3-4 fields); explain what happens next.
- Motion: one deliberate hero moment, subtle scroll reveals at most; no parallax that harms reading; respect reduced motion.
- Mobile: single column, 16px+ body, thumb-reachable CTA, optional sticky CTA bar, compressed images.
- Performance and SEO: one `h1`, descriptive title and meta, Open Graph tags, semantic sections, LCP image prioritized, no layout shift, fast fonts.
- Accessibility: contrast, focus states, alt text, no text baked into images, captions for video.
- Credibility: no invented testimonials, logos, certifications or statistics presented as real. Mark sample content clearly and list it for replacement.
- Industry adaptation: read the matching context file; it changes tone, imagery and proof (for example healthcare needs credentials and privacy cues; hospitality is photography-led).
