# RFQ board redesign - bring /connect/rfq to the Jobs-board bar (2026-06-10)

Owner ask: improve the Quote requests page to match the reference mock, reusing the
Jobs module patterns (server-driven board, counted facets, URL filters, KPI strip,
skeletons). Explicitly EXCLUDED by owner: the "how it works" steps strip
(Find an open request -> Send your quotation -> ...) - remove it.

## Research findings / decisions

- The Jobs board is the canonical pattern: SSR-seeded URL filters
  (`app/connect/jobs/page.tsx` parse -> `useBoardFilters` client engine with
  debounce + stale-response guard + history.replaceState), one `$facet`
  aggregation for rail counts (`jobs.service.ts boardFacets`), `FacetGroup`
  counted checklists, KPI strip, per-route `loading.tsx` skeletons.
- Current RFQ board filters 100 loaded rows in memory; no facets, no URL state,
  no paging, no buyer identity on cards, no loading.tsx (binding-rule violation).
- Reference mock signals mapped to REAL data (no fabricated signals - same
  principle the Jobs/RFQ code already documents):
  - "low ₹X" per card -> new denormalized `Rfq.lowestQuotePrice` maintained on
    quote create/update/withdraw/decline (min over live quotes).
  - "N match what you supply" -> the viewer's ACTIVE marketplace listing
    categories (`Listing.ownerUserId + status='active'`) intersected with RFQ
    categories. No listings -> the toggle/ribbon/KPI sub-line hide.
  - "1 shortlisted · 2 won" -> NEW quote status `shortlisted` (buyer action,
    mirrors the jobs application shortlist) + `accepted` = won. Also adds the
    missing buyer `decline` action (status existed; endpoint did not).
  - "Verified buyers only" -> DROPPED. Persons have no verification concept in
    the identity model (jobs code invariant: "person rows are never badged").
    We will not fabricate a trust signal.
  - Buyer name on cards -> client-side batch enrichment via the existing
    `getPeople` action (clone of jobs `useBoardEmployers`), no BE change.
  - Status rail buckets: Open / Closing soon / Awarded. Closing soon = open AND
    neededBy within 3 days (same CLOSING_SOON_DAYS the card already uses).
  - "Include Negotiable requests" -> only meaningful with a budget filter:
    budget range normally excludes no-budget RFQs; the checkbox ORs them back in.
  - "No quote from me yet" -> viewer's live-quoted rfqIds excluded server-side.

## Backend (logical change, additive)

1. `quote.schema.ts`: add `shortlisted` to QUOTE_STATUSES.
2. `rfq.schema.ts`: add `lowestQuotePrice: number|null`.
3. `rfq-board-query.helpers.ts`: districts csv ($in, case-insensitive), statuses
   csv (open|closing-soon|awarded buckets via $or), includeNegotiable, q also
   matches category; clause composition via $and (q-$or + status-$or coexist).
4. DTO: extend `RfqBoardQueryDto` (districts, statuses, includeNegotiable,
   notQuotedByMe, matchedToMyWork); new `RfqBoardFacetsQueryDto` (filters only).
5. Service: viewer-aware `listBoard` (+notQuotedByMe/+matchedToMyWork),
   `boardFacets` ($facet: total/category/district + status bucket counts +
   matchedToMyWork/notQuotedByMe counts), richer `boardStats` (openTotal,
   newToday, matchesMyWork, supplyCategories, myOpenRequests, quotesOnMyOpen,
   myQuotesTotal, myQuotesShortlisted, myQuotesWon), `shortlistQuote`,
   `declineQuote`, enriched `listMyQuotes` (+rfq snapshot), lowestQuotePrice
   recompute on every quote mutation.
6. Controller: `GET board/facets` (throttled), `POST quotes/:id/shortlist`,
   `POST quotes/:id/decline`; board/stats now read `req.user.sub`.
7. Module: register the `Listing` model (read-only) for supply categories.
8. Tests: extend `rfq-board-query.helpers.vitest.ts`; keep service suite green.

## Web

1. `rfq.types.ts` + `rfq.actions.ts`: mirror the new contract (facets action,
   shortlist/decline actions, MyQuoteView, extended BoardFilters/BoardStats).
2. New `useRfqBoardFilters.ts` (clone of jobs `useBoardFilters`: URL sync,
   debounce, stale guard, load more, page size 20).
3. New `useBoardBuyers.ts` (clone of `useBoardEmployers` on `getPeople`).
4. `app/connect/rfq/page.tsx`: parse searchParams -> filters + `?tab=`,
   Suspense fallback, SSR-seed board page 1 + facets + stats + mine + myQuotes.
5. `RfqBoard.tsx` rebuild: KPI strip with sub-lines, URL-synced tabs, search
   band + button, counted category chips (facets), rail | results grid, active
   chips, sort, Load more, NO how-it-works strip.
6. `RfqFilterRail.tsx` rebuild in the Jobs rail visual family: Status checklist
   with counts, District FacetGroup (reused from jobs), Budget + include-
   negotiable, "Show me" (matched-to-my-work switch, no-quote-from-me-yet),
   Posted radios, Clear all.
7. `RfqCard.tsx`: interaction contract (relative root + stretched title link),
   buyer row, "Matches your work" ribbon, low-quote line, Send quote / Update
   quote action, negotiable budget label.
8. Detail screen + QuoteCard: buyer Shortlist/Decline actions, shortlisted tone.
9. Skeletons: `RfqHubSkeleton` + `app/connect/rfq/loading.tsx` +
   `app/connect/rfq/[id]/loading.tsx` (binding rule).
10. i18n: extend `connect.rfq.*` in all 4 locales; remove the howItWorks keys.

## Verification

- BE: `nest build` + scoped vitest (`rfq` module only, --no-file-parallelism).
- Web: scoped tsc/lint on touched files, i18n 4-locale parity, skeleton parity.
