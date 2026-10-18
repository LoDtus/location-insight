# Charts and Data Visualization

Charts are optional. Add them only when they make the interface better, and keep them readable.

## The gate: add a chart only if all three are true

1. It answers a **named question** ("Is output trending down this month?").
2. The **shape** matters: trend, comparison, distribution, composition, relationship or geography.
3. A number, a delta or a small table would do the job **worse**.

If any answer is no, use a KPI tile, a table or a sentence. Do not add charts to fill empty space.

## Space limits

- Total chart area is **at most 50%** of the screen or page and **ideally about 30%** (roughly one dominant chart plus one small supporting visual).
- Desktop: 1-2 charts per viewport; 3 only as small multiples of the same chart type. Mobile: 1 per fold.
- Large enough to read: primary chart at least 280-360px tall and 480px wide on desktop; supporting chart at least 240px tall; on mobile at least 200px tall and full width.
- Never squeeze 3-4 charts side by side to look "rich". One strong chart beats four weak ones.
- On landing pages, use a chart only when it is the proof (a real result), never as decoration.

## Pick the form

| Question | Use |
|---|---|
| Change over time (6+ points) | Line, or area for a single series; bars for discrete periods |
| Compare categories | Horizontal bars sorted by value (zero baseline) |
| Part of a whole | Stacked bar or a single donut with at most 5 segments; otherwise a sorted bar |
| Distribution | Histogram or box plot (technical audiences only) |
| Relationship | Scatter, with labeled outliers |
| Progress to target | Bullet bar or progress bar, not a gauge |
| A few exact values | Table or KPI tiles |
| Geography | Map only when location is the point |

Avoid: pie with more than 5 slices, 3D, dual axes, radar for non-experts, gauges and speedometers, animated counters, rainbow palettes, decorative gradients.

## Rules

- **Title states the question or takeaway**, not the metric name ("Downtime fell 18% since March"). Add units, period and data freshness ("Updated 5 min ago").
- Label axes with units; bars start at zero; sort categories; use direct labels instead of legends where possible; at most 5-6 series.
- Emphasize one series with the brand or accent color and mute the rest. Keep the same color for the same meaning across the product. Use colorblind-safe palettes and never encode meaning by color alone.
- Show thresholds, targets and events as light annotation lines.
- Light gridlines, no chart borders, no ornaments. Tooltips on hover and focus with exact values.
- Provide a table or text summary alternative for accessibility.
- Design states: loading skeleton, empty ("No data for this period"), error with retry, partial data.
- Time-range control with a sensible default; remember the choice.
- Handle real data: sparse series, outliers, long labels, negative values.

## KPI tiles

- Value (large, tabular numerals), label, delta with direction and comparison period ("+4.2% vs last month"), optional sparkline. 3-5 per row.
- A tile should link to the filtered list behind it.
- Define non-obvious metrics (OEE, ROAS, occupancy) in a tooltip or help link.

## Implementation

- Use the project's chart library; if none, pick a light one (Recharts, Chart.js, ECharts, uPlot) and wrap it in a responsive container with a fixed aspect or min-height.
- Use realistic sample data with plausible noise and seasonality, never `Math.random()` flat noise or perfect linear ramps.
- No animation longer than 300ms; respect `prefers-reduced-motion`.
