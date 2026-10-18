# Imagery and Assets

## Principle

When a design calls for an image, **produce a real image**. Final output never uses gray rectangles, tinted divs or gradient boxes as stand-ins for photos, illustrations, product shots, avatars or logos. This applies equally when cloning or reproducing a reference UI: reproduce the image content and its role, not an approximation made of colored blocks.

A temporary placeholder is acceptable only while the real asset is being produced, and it must be replaced or listed as an open item in your report.

## Sourcing ladder (use the first that works)

1. **Project assets:** existing images, brand kit, design files the user supplied.
2. **Generate** with any image-generation tool or MCP available in the session: hero art, illustrations, textures, product mockups, abstract backgrounds, rendered concepts.
3. **Download from free, commercially usable libraries:** Unsplash, Pexels, Pixabay, Wikimedia Commons (check each file's license), Openverse. Icons: Lucide, Phosphor, Tabler, Heroicons. Illustrations: unDraw, Open Peeps and similar. Fetch with the terminal or a fetch tool.
4. **Author it yourself:** SVG for icons, patterns, diagrams, simple logos and abstract art; CSS for gradients and shapes that are genuinely decorative.

If network access or downloading is blocked, say so plainly, use the next rung (generated or SVG), and list exactly which files should be swapped for real photography and where they live.

## Rules

- Match what the image must communicate. Real food, real rooms, real equipment, real interfaces beat generic stock. Choose images that **depict the actual subject** of the page.
- One visual language per product: photography, flat illustration, or 3D, with consistent crop, color grade, lighting, corner radius and treatment.
- Consistent aspect ratios (16:9, 4:3, 1:1, 3:4), with a defined focal point so crops work on mobile.
- Text over images needs a scrim or a quiet area to reach 4.5:1 contrast.
- Avatars: use real or generated portraits where appropriate, with initials as the fallback.
- New brand logos (Create or authorized Redesign only): simple SVG wordmark plus symbol, legible at 16px, with a one-color version. In Preserve mode, never alter the existing logo.

## Rights and honesty

- Check the license and keep a record of source and license for every downloaded asset in `assets/CREDITS.md` (or the project's convention).
- Do not use third-party trademarks, logos or brand artwork as if they belonged to the product. Do not copy copyrighted artwork or scrape paid stock.
- Do not present identifiable real people as customers, doctors or endorsers without rights. Mark invented testimonials, client logos, numbers, certifications and reviews as **sample content** to be replaced; never present them as real in a production design.
- Generated renderings of properties, products or results must be labeled illustrative where a viewer could take them for the real thing.

## Technical

- Save to the project's asset folder (for example `public/images/`) with descriptive kebab-case names.
- Export WebP or AVIF with a fallback if needed; hero images ideally under 200KB; use `srcset` and `sizes`; set `width` and `height`; `loading="lazy"` below the fold; high priority for the hero image only.
- Compress SVGs, keep a `viewBox`, use `currentColor` for icons so they follow theme tokens.
- Provide dark-mode variants for images with baked-in backgrounds.
- Alt text describes purpose, not appearance; decorative images get empty alt.
