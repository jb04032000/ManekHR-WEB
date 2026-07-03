# Connect rail footer (LinkedIn-style) — design

**Date:** 2026-06-17
**Status:** Approved (owner said "go")
**Scope:** `crewroster-web` only. No backend, no mobile.
**Builds on:** `2026-06-17-connect-common-footer-design.md` (the single common footer +
bottom-pin). This adds the right-rail presentation and mutual exclusion.

## Problem

The common footer sits at the page bottom. On infinite-scroll pages (feed, marketplace,
jobs, search) the bottom is never reached, so the footer is effectively invisible there.
LinkedIn solves this by placing the footer at the bottom of the sticky right rail, where
it stays reachable. We removed the old `RailFooter` during the common-footer unification;
this restores it — but made mutually exclusive with the bottom footer so they never
double up (the original duplication complaint).

## Decision

Show the footer in the **right rail** on pages that have one, and at the **page bottom**
otherwise (and on phones, where the rail is hidden). Exactly one shows per page/breakpoint.

The right rail already implements the LinkedIn sticky pattern (`Rail.tsx`): a tall rail
bottom-sticks to the viewport, so a footer at its bottom scrolls into and stays in view.
All Connect right rails use the same `xl` (1280px) breakpoint and all route through
`Rail` (directly or via `ConnectRightRail`), so one injection point covers every current
and future right-rail page.

## Components

- **`RailFooter` (recreated):** the ambient rail-mode footer. Same links + copy as the
  bottom footer via the shared `connect.appFooter` i18n (About `/about`, Contact
  `/contact`, Terms `/terms/connect`; Help/Privacy still deferred), plus the brand line
  and `SampleContentNote`. Compact 11px / `--cr-text-4`, no card chrome. Emits
  `data-connect-rail-footer-bp={breakpoint}` for the mutual-exclusion rule.
- **`ConnectAppFooter` (unchanged):** the page-bottom bar.
- **`SampleContentNote` (unchanged):** reused in both; only the visible footer shows it.

## Mechanism

1. **One injection point.** `Rail` renders `<RailFooter breakpoint={breakpoint} />` as the
   last child of its sticky inner wrapper when `side === 'right'` and `footer !== false`
   (new prop, default `true`). This auto-covers feed, search, network, stores hub,
   marketplace, notifications-prefs, and jobs (via `ConnectRightRail`). The two dense
   manage consoles (`ManageStorefrontScreen`, `ManageCompanyPageScreen`) pass
   `footer={false}` — they stay footer-free, as today.
2. **Mutual exclusion (CSS, no JS).** The shell's bottom-footer wrapper gets
   `data-connect-bottom-footer`. `globals.css` hides it at the rail's breakpoint when a
   rail footer is present:
   ```css
   @media (min-width: 1024px) {
     body:has([data-connect-rail-footer-bp='lg']) [data-connect-bottom-footer] {
       display: none;
     }
   }
   @media (min-width: 1280px) {
     body:has([data-connect-rail-footer-bp='xl']) [data-connect-bottom-footer] {
       display: none;
     }
   }
   @media (min-width: 1536px) {
     body:has([data-connect-rail-footer-bp='2xl']) [data-connect-bottom-footer] {
       display: none;
     }
   }
   ```

   - At/above the breakpoint: rail visible → rail footer shows, bottom footer hidden.
   - Below the breakpoint: rail (and its footer) `display:none` → media rule inactive →
     bottom footer shows.
   - Rail-less pages: no marker → bottom footer always shows.
   - Result: exactly one footer, every page, every width. SSR-safe (marker present at
     SSR, so no flash). `:has()` is supported in all current browsers; breakpoints are
     Tailwind defaults (no custom `screens`).

## Changes

| File                                                    | Change                                                                           |
| ------------------------------------------------------- | -------------------------------------------------------------------------------- |
| `components/connect/RailFooter.tsx`                     | Recreate (ambient, shared i18n, `SampleContentNote`, breakpoint marker).         |
| `components/connect/Rail.tsx`                           | Add `footer?: boolean` (default true); render `RailFooter` for `side==='right'`. |
| `components/connect/index.ts`                           | Re-add `RailFooter` export.                                                      |
| `features/connect/entities/ManageStorefrontScreen.tsx`  | `<Rail side="right" footer={false}>`.                                            |
| `features/connect/entities/ManageCompanyPageScreen.tsx` | `<Rail side="right" footer={false}>`.                                            |
| `app/connect/layout.tsx`                                | Add `data-connect-bottom-footer` to the footer wrapper.                          |
| `app/globals.css`                                       | Add the three mutual-exclusion media rules.                                      |
| `app/messages/{en,gu,gu-en,hi-en}.json`                 | Add `connect.appFooter.aria` ("Connect footer").                                 |
| `app/design-system/DesignSystemGallery.tsx`             | Add a `RailFooter` demo back (parity).                                           |

## Verification

- `check:i18n` parity; tsc + lint clean for touched files.
- CSS reproduction: a rail page at ≥xl shows ONE footer in the rail (no bottom);
  resized below xl shows ONE bottom footer (no rail); a rail-less page shows the bottom
  footer; a manage console shows none.
- Visual smoke (owner): scroll feed/marketplace/jobs at desktop — footer reachable in the
  rail; shrink window — footer moves to the bottom; no page ever shows two.

## Out of scope

- Help/Privacy pages (still deferred; labels kept).
- Any non-`xl` right rail would need its `bp` marker (already handled — `RailFooter`
  emits the rail's actual breakpoint, and all three breakpoints have a rule).
