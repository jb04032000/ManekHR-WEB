---
name: Open Design
description: Use when the owner wants to design or redesign a crewroster-web page with open-design's design intelligence instead of frontend-design or ui-ux-pro-max. Triggers on "open-design", "use open-design", "redesign this page with open-design", "design this page". It brings open-design's visual directions, design process, anti-AI-slop bar, and self-critique to a page, then implements the result in-place in the project stack (Next.js App Router, AntD v6, cr- tokens, 4-locale i18n) with all existing logic preserved.
---

## Open Design

Bring open-design's design intelligence to a crewroster-web page, then implement the result in-place in the real project stack. open-design is the design brain; this skill is the builder. Use this skill in place of `frontend-design` or `ui-ux-pro-max` whenever the owner asks to design or redesign a page "with open-design".

There is no running app, no MCP, and no screenshots. The design intelligence lives in this file plus the open-design repo read from disk at `D:\Work\Projects\other\open-design`.

### When to use

- "redesign /connect/marketplace using open-design, make the listing grid feel premium ..."
- "use open-design to rebuild this page ..."
- "design a new <X> page with open-design ..."

Works for an existing page (preserve its logic, redesign the look) or a brand-new page (scaffold following the playbook and wire to existing endpoints, or flag clearly if the backend is missing).

### What this is, and what it is not

- IS: open-design's design thinking (layout, hierarchy, rhythm, restraint, type scale, the anti-slop bar, the self-critique) applied to a page, rendered in crewroster-web's own design system.
- IS NOT: a copy of open-design's HTML, palettes, or fonts into the repo. Do not import open-design's OKLch palettes or font stacks as-is. Color, type, and components always come from the project. See the Translation contract below.

### Inputs

Parse from the invocation: (1) the target, which is a route (`/connect/marketplace`), a URL (`localhost:3001/connect/marketplace`), or a file path; (2) the redesign instruction. Ask the owner only if the target is missing or the intent is genuinely ambiguous. The owner wants fewer steps, so infer surface, audience, and tone from the page and the instruction rather than asking. open-design's full intake form is for its app; here, ask at most one short question, and only when you truly cannot proceed.

## Workflow

Track these as todos and update them live as you go.

### A. Understand the target (project-aware)

1. Use the `code-review-graph` MCP tools FIRST (required by `crewroster-web/CLAUDE.md`), then Read. Resolve the route to files, for example `/connect/marketplace` maps to `app/connect/marketplace/page.tsx` plus its components under `components/...`.
2. For any Connect surface, read `docs/connect/README.md` and `docs/connect/PROGRESS.md` first (required by CLAUDE.md). They hold the Connect canonical UI and the binding standards.
3. Separate LOGIC from PRESENTATION. Logic is data fetching (`lib/actions/*`, TanStack Query), mutations, RBAC (`<Can>`, `useMyPermissions`), routing, and state (zustand, react-hook-form). Presentation is layout, markup, styling, and copy. You will preserve logic exactly and redesign only presentation.
4. Learn the house style: read `app/globals.css` (the `cr-` tokens), `tailwind.config.js`, `lib/theme.ts` (the AntD v6 theme), the Team v2 reference page `app/dashboard/team/page.tsx`, and the atoms in `components/ui/` (`StatTile`, `DsTable`, `DsCard`, `DsModal`, `DsDrawer`, `DsButton`, `DsBadge`, `EmptyStateLayout`, `BulkActionBar`, `SegmentedToggle`, `HeaderRightActions`, `InfoTooltip`).

### B. Design with open-design's intelligence

5. Embody the specialist for this page type (see Embody the specialist below). Pick the closest open-design skill and read its references for depth: `D:\Work\Projects\other\open-design\skills\<type>\references\layouts.md` and `checklist.md` (for example `dashboard` for a data or admin page, a landing or marketing skill for a public Connect page). If that path is absent, use the embedded guidance in this file and continue.
6. Choose a visual direction as a LENS (see The 5 visual directions). Internal `/dashboard` pages lean modern-minimal or tech-utility; public Connect and marketplace pages can lean warm-soft or editorial. The lens informs posture (border weight, radii, accent budget, type scale, rhythm), never the literal palette.
7. State the design intent before writing: the section list, the layout regions, which AntD components and atoms map to each part, the empty, loading, and error states, the responsive behavior, accessibility, and the real copy. Keep it short and inline. This is the owner's cheap redirect point, not a hard stop.

### C. Implement in-place (project conventions)

8. Edit the page and its components at the same paths. Reuse existing atoms and components. Follow `../MODULE-PLAYBOOK.md` and the Team v2 reference.
9. AntD v6 only. Honor the banned-form table in `crewroster-web/CLAUDE.md`: `<Alert title=>` not `message=`, `<Tabs items=>`, `<Modal open=>`, `<Drawer size=>`, `<InputNumber suffix=/prefix=>`, `destroyOnHidden`, `styles={{ popup }}`, and `menu={{ items }}` on Dropdown. Tailwind and `cr-` tokens go on raw HTML only, never on AntD components.
10. Every new string is an i18n key added to all four locales: `app/messages/{en,gu,gu-en,hi-en}.json`. No hardcoded copy. The repo lints this through `eslint-plugin-i18next` and `npm run detect:hardcoded-i18n`.
11. Preserve every RBAC gate, the data wiring, the routing, form round-trip integrity, and soft-delete behavior. No stubs, no TODOs, no placeholders, no em-dashes.

### D. Self-critique and verify

12. Run the Anti-AI-slop checklist, the matched skill's P0/P1/P2 checklist, and the 5-dimension self-critique (plus the critic, brand, a11y, and copy lenses). Fix every P0 and anything that scores under 3.
13. Verify, scoped to the files you touched to avoid memory pressure: `npm run check:i18n`; `npx eslint <changed files>`; `npm run detect:hardcoded-i18n`; and the banned-AntD `rg` self-check from CLAUDE.md. Run `npm run build` for a full typecheck only when the machine can take it; prefer scoped checks otherwise. Report results plus the list of files changed.
14. Do not run git. The owner stages and commits. Tell the owner to view the page live at `localhost:3001<route>` (start the dev server with `npm run dev`).

## open-design design intelligence (embedded)

### Embody the specialist (pick the persona first)

- Data, admin, or dashboard page: systems designer. Information density is the feature. Tabular numerics, restrained decoration, clear table and filter design. open-design `dashboard` skill.
- Public, marketing, or landing page: brand designer. One hero, a few well-paced sections, real copy, one decisive flourish.
- Multi-screen flow or form-heavy page: interaction designer. Real states, sensible defaults, generous hit targets, real screens not "feature one" placeholders.
- Marketplace, catalog, or listing grid: a systems and brand blend. Strong card rhythm, clear trust signals, fast scanning, real imagery.

### The 5 visual directions (use as a lens, render in cr- tokens)

Full specs (palettes in OKLch, font stacks, posture cues) live in `D:\Work\Projects\other\open-design\apps\daemon\src\prompts\directions.ts`. Read that file only if the owner explicitly wants a fresh aesthetic, which is a logical change (see the Translation contract). Otherwise use these as posture lenses:

- editorial-monocle: print-magazine calm. Generous whitespace, large headings, borders and whitespace instead of shadows, one accent used at most twice.
- modern-minimal (Linear, Vercel): quiet and precise. Hairline borders, tabular numerics, one accent for links and the primary action, content-led, no hero art.
- warm-soft (Stripe pre-2020, Headspace): cream surfaces and gentle radii. Friendly, soft, one accent plus one editorial flourish, real imagery over icons.
- tech-utility (Datadog, GitHub): data-dense. One type family is acceptable here, tabular numerics everywhere, dense tables with hairline borders, inline status pills.
- brutalist-experimental (Are.na): loud type, visible grid, full-strength borders, asymmetric columns. Use sparingly, only when the brief asks for a statement.

### Anti-AI-slop checklist (audit before shipping)

- No aggressive purple or violet gradient backgrounds.
- No generic emoji feature icons.
- No rounded card with a left coloured border accent.
- No hand-drawn SVG humans, faces, or scenery.
- No invented metrics ("10x faster", "99.9% uptime") without a real source. An honest placeholder (a dash, a grey block, a labelled stub) beats a fake stat.
- No filler copy ("Feature One", lorem ipsum).
- No icon next to every heading.
- No gradient on every background.
- One accent, used at most twice per screen. One decisive flourish, not three competing ones.
- Pair a display face with a quieter body face. In this repo fonts come from the project tokens, so honor this through the token type scale, not by importing new fonts.

### The self-critique (run before you call it done)

Primary pass: score yourself 1 to 5 on five dimensions. Anything under 3 is a regression. Fix the weakest, then re-score. Two passes is normal.

1. Philosophy: does the posture match the brief, or did you drift back to a default?
2. Hierarchy: does the eye land in one obvious place per screen, or is everything competing?
3. Execution: typography, spacing, alignment, contrast, are they right or just close?
4. Specificity: is every word, number, and image specific to this page?
5. Restraint: one accent at most twice, one flourish?

Lens pass (from open-design's critique panel): critic (hierarchy, type, contrast, rhythm, space), brand (consistency with the rest of the app and the Connect canonical UI), a11y (WCAG AA contrast, focus, labels, keyboard), copy (tone and specificity).

## Translation contract (the bridge, read this twice)

open-design thinks in standalone HTML with its own palettes and fonts. crewroster-web has a locked design system. So:

- Use open-design's directions and design systems as a design-thinking lens (layout, hierarchy, rhythm, restraint, type scale, spacing, the anti-slop bar, the critique). Do not import their palettes or fonts literally.
- Render with the project's own system: `cr-` tokens (`app/globals.css`), Tailwind on raw HTML only, AntD v6 themed via `lib/theme.ts`, and the existing `components/ui` atoms.
- Stay consistent with sibling pages and the Connect canonical prototype (`docs/connect/`).
- If the owner explicitly wants a new aesthetic or new token values, that is a LOGICAL change, not polish. Propose it and flag it for approval (per the polish-vs-logical-change rule in the workspace CLAUDE.md). Never silently re-skin the design system.
- Context sensitivity: internal `/dashboard` pages stay tight to Team v2 and the tokens. Public Connect and marketing surfaces get more aesthetic latitude, still expressed through the tokens and the canonical Connect UI.

## Reference index

- open-design directions: `D:\Work\Projects\other\open-design\apps\daemon\src\prompts\directions.ts`
- open-design process, anti-slop, and critique: `D:\Work\Projects\other\open-design\apps\daemon\src\prompts\discovery.ts`
- open-design critique panel roles and weights: `D:\Work\Projects\other\open-design\packages\contracts\src\critique.ts`
- open-design per-type skills: `D:\Work\Projects\other\open-design\skills\<type>\references\{layouts.md,checklist.md}`
- open-design design systems: `D:\Work\Projects\other\open-design\design-systems\<name>\DESIGN.md`
- project module standard: `../MODULE-PLAYBOOK.md`
- AntD v6 and code-review-graph rules: `crewroster-web/CLAUDE.md`
- reference page to copy patterns from: `app/dashboard/team/page.tsx`
- reusable atoms: `components/ui/`

## Output to the owner

End with a short report in plain language: the page you redesigned, the persona and direction lens you used, what changed, the checklist and critique result, the verification result, and the list of files touched. Remind the owner to view it at `localhost:3001<route>`, and that they stage and commit (this skill never runs git).
