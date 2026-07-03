# Landing UX modernization plan

**Date:** 2026-06-14
**Context:** The network-led redesign shipped and the content is right. The remaining complaint is that the page _looks dated_. This plan is about look-and-feel and interaction, not copy or positioning (those stay).

## Why it currently reads as "old"

From the design system (Newsreader serif display, Inter body, cream/indigo/gold, `mkt-card` bordered rounded boxes, `py-16/20/24` rhythm, CSS-only mocks, fade-up reveal only):

1. **Serif headlines (Newsreader)** give an editorial/newspaper feel. Modern product sites (Linear, Vercel, Stripe, Framer) lead with a tight geometric/grotesk sans.
2. **Every section is "heading + a row of bordered cards."** Steps (3), modules (5), audience (4), trust (4), pillars (3) all use the same boxed-grid pattern. That repetition is the single biggest "template from 2018" signal.
3. **Thin borders everywhere, low depth.** Visible 1px borders on cream read as utilitarian. Modern UIs use soft elevation, subtle gradients, and borderless surfaces.
4. **Cream-on-cream-on-cream.** Little sectional contrast, so the page feels flat and long.
5. **Schematic CSS mocks**, not real product, so nothing looks "live."
6. **Motion is just fade-up + one pulse.** No hover depth, no scroll-linked storytelling.

## The moves (prioritized)

### P1 — high impact, low risk (do first)

- **Bento layout** for the three pillars and the five tools: varied cell sizes, asymmetry, a couple of cells carrying a live module mock, the rest tight text. Kills the uniform card-row monotony.
- **Depth over borders:** drop most 1px borders for soft layered shadows + faint gradient fills; widen whitespace. Fewer visible boxes.
- **Sectional contrast / rhythm:** make the trust wedge (and/or final CTA) a full-bleed dark indigo band; alternate light/tinted/dark so the page has a beat instead of one cream wash.
- **Hover + hero micro-interaction:** cards lift with an accent glow on hover; the hero mock auto-cycles its Network -> Marketplace -> Hiring views (the legend is already there) so it feels alive in the first 3 seconds.

### P2 — medium

- **Typography refresh:** tighten display tracking, raise size/weight contrast. Brand decision below.
- **Scrollytelling "how it works":** the three steps connected by an animated progress line that fills as you scroll, instead of three static cards.
- **Hero depth:** soft layered shadows + a subtle animated gradient/aurora background; optional light parallax on the mock.

### P3 — bigger investment

- **Replace CSS mocks with real product screenshots** (the biggest single "feels modern and real" jump).
- **Scroll-linked animation** beyond fade-up (staggered, directional, parallax) via the existing motion layer.

## The one brand decision (headline font)

- **A. (Recommended) Hybrid:** keep Newsreader serif only for the big hero H1 as a signature, switch all section headings to the sans. Cleaner and modern while keeping a bit of character.
- **B. Full modern sans:** drop serif entirely, use a tight grotesk for all headings. Most "tech-modern," least character.
- **C. Keep serif everywhere:** only do the layout/depth/motion work. Lowest effort, keeps current identity, addresses most of the "old" feel via P1 alone.

## Guardrails (unchanged)

- Keep all verified copy, the four locales, WCAG AA, and hero LCP (hero stays no-entrance-animation; only the in-mock loop animates).
- Honest signals only — no invented numbers, logos, or testimonials.
- Respect `prefers-reduced-motion` for every new animation.
