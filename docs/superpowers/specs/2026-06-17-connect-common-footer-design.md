# Connect common footer — design

**Date:** 2026-06-17
**Status:** Approved (owner said "go")
**Scope:** `crewroster-web` only. No backend, no mobile.

## Problem

The signed-in Connect surface renders two different footers, which produces three
visible defects:

1. **Duplication on the feed.** `app/connect/layout.tsx` renders `ConnectAppFooter`
   (a full-width thin bottom bar) on every `/connect/*` page. `FeedScreen.tsx`
   _additionally_ renders `RailFooter` at the bottom of its right rail. So the feed
   shows footer links twice — once in the right rail, once at the page bottom.
2. **Inconsistency.** Only the feed has the rail footer. Every other page shows just
   the bottom bar. On short pages the bar reads as floating with a dead gap above it.
3. **Dead links.** The footers link to `/help`, `/privacy`, `/terms` — none of which
   exist as routes. Only `/about` resolves. (`/terms` exists only as `/terms/connect`
   and `/terms/erp`; there is no privacy page anywhere in the product.)

## Decision

**One common footer, rendered once per page.** `ConnectAppFooter` becomes the single
"Connect footer" used across the whole signed-in surface. `RailFooter` is folded into
it and removed. This is the owner's explicit ask: a _common_ footer, consistent
everywhere, with no repeats.

Rationale for bottom placement over a rail-pinned footer: only some Connect pages have
a right rail, so a rail footer can never be the _common_ footer for rail-less pages. A
single quiet bottom footer is consistent on every page type, appears naturally at the
end of an infinite feed ("you are all caught up"), and is impossible to duplicate
because the shell renders it exactly once.

## What the common footer contains

A single `<footer>` with a top border spanning full width; inner content aligned to the
page content column (`--cn-content-max-w`, so the footer's left edge lines up with page
content at both sidebar states instead of a hardcoded `1380px`).

- **Links (real routes only):** About (`/about`) · Contact (`/contact`) · Terms
  (`/terms/connect`).
- **Deferred links:** Help and Privacy are intentionally omitted — those pages do not
  exist yet. Their i18n labels (`help`, `privacy`) are kept in the catalogue so the
  links drop straight back in when the pages are built. (Documented in a code comment.)
- **Brand line:** "Made in India · Zari360 © {year}".
- **Mobile language toggle:** the existing `md:hidden` `LocaleToggle` stays (the header
  globe switcher is desktop-only).
- **Sample-content note:** the existing self-contained `SampleContentNote` is reused at
  the bottom of the footer (it has its own `NEXT_PUBLIC_CONNECT_DEMO_NOTICE=off`
  kill-switch and inline 4-locale copy). Previously feed-only; now shown wherever the
  common footer shows, which is honest while the network carries seeded demo accounts.

## Where it shows / does not show

No change to the existing visibility rule. The shell keeps rendering the footer on every
`/connect/*` page **except** the full-screen workspaces already excluded via
`HideOnPaths`: `/connect/inbox`, `/connect/stores/<id>`, `/connect/pages/<id>`. A footer
on those dense, app-like consoles is noise and also drags their sticky rail off-screen.

The bottom-pin behaviour (`min-h-[calc(100dvh-12rem)]` + `mt-auto`) stays, so the footer
sits flush at the bottom on short pages with no floating gap.

## Changes

| File                                        | Change                                                                                                                                                                                                                               |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `components/connect/ConnectAppFooter.tsx`   | Becomes the common footer: add About + Contact links, brand line, reuse `SampleContentNote`, align width to `--cn-content-max-w`, point Terms at `/terms/connect`. Update doc comment.                                               |
| `features/connect/feed/FeedScreen.tsx`      | Remove `RailFooter` import + its render in the right rail.                                                                                                                                                                           |
| `components/connect/index.ts`               | Remove the `RailFooter` export.                                                                                                                                                                                                      |
| `app/design-system/DesignSystemGallery.tsx` | Swap the `RailFooter` gallery entry to the common footer (or drop it).                                                                                                                                                               |
| `components/connect/RailFooter.tsx`         | Delete (folded into the common footer).                                                                                                                                                                                              |
| `app/messages/{en,gu,gu-en,hi-en}.json`     | Add `connect.appFooter.{about,contact,madeIn,copyright}` (reusing the existing `railFooter` native copy + the existing `contact` label). Remove the now-unused `connect.feed.railFooter` block from all four locales (keeps parity). |

`SampleContentNote.tsx` is **kept** and reused (not deleted).

## Verification

- `npm run check:i18n` — parity across all four locales, no banned chars.
- `npx tsc --noEmit` clean for touched files.
- `npm run lint` clean for touched files.
- Visual smoke: feed shows exactly one footer (bottom, no rail repeat); a rail page
  (e.g. search/network) and a plain page each show one bottom footer; inbox + a manage
  console show none; links resolve; mobile shows the language toggle.

## Out of scope / follow-ups

- Building the Help and Privacy pages (owner will do later; slots kept ready).
- A network product handling personal data should have a privacy policy — flagged, not
  built here.
