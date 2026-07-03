# GSTR-2B Reconciliation - Design + Build Record

Date: 2026-06-06. Status: BUILT (uncommitted). Phase 3 roadmap item (see
`2026-06-06-billing-accounts-competitive-roadmap.md` section 4, Phase 3.1).

## Why

Zoho Books and Refrens both auto-reconcile the GST portal's GSTR-2B against the
buyer's purchase bills and bucket every line into match states with a one-click
"accept 2B value". We build GSTR-1 and GSTR-3B but never reconciled 2B - the single
biggest accountant-value gap on the input-tax-credit (ITC) side. Getting this wrong
means a business either over-claims ITC (notice + interest) or leaves credit on the
table. This feature surfaces exactly where books and the portal disagree.

## Scope (and non-scope)

- IN: import a GSTN GSTR-2B JSON for a tax period, match vs posted purchase bills,
  show 4 buckets (matched / amount-mismatch / missing-in-books / missing-in-2B) with
  per-row tax deltas and total "ITC at risk".
- NOT a payment feature (honors `feedback_no_payments_in_billing`). Pure bookkeeping.
- NO schema change: reconciliation is computed on demand and NOT persisted (stateless
  upload). So no logical/schema approval gate was needed.
- v1 is READ-ONLY on the books. "One-click accept 2B value" (mutating a bill's amounts
  to match the supplier's reported value) is a deliberate follow-up - it edits posted
  vouchers, which is a logical change and will be flagged separately.

## Architecture

Pure core (unit-tested, no Nest/Mongo):
`crewroster-backend/src/modules/finance/gst/gstr2b/gstr2b-recon.ts`

- `parseGstr2b(json)` - tolerant parse of `docdata.b2b / b2ba / imp`, rupee->paise,
  handles nested `inv[]` and flat shapes, `itcavl` flag.
- `reconcileGstr2b(twoBRows, bills, {tolPaise=100})` - primary key = (GSTIN, normalized
  invoice no). Same key + amounts within Rs1 => matched; same key + drift => partial
  (with signed deltas); 2B row with no bill => missing_in_books; bill with no 2B row =>
  missing_in_2b. Summary includes `itcAtRiskPaise` = |tax delta| on partials + full tax
  of missing-in-books rows.
- Scoring mirrors `bank-reconciliation/match-engine.ts` conceptually but is a separate
  matcher (2B is unsigned, GSTIN+invoice keyed) - not yet a shared util.
- Tests: `__tests__/gstr2b-recon.vitest.ts` (9 cases, all green).

Service / API:

- `gstr2b.service.ts` loads POSTED `PurchaseBill`s for the period (voucherDate bounds,
  mirrors `Gstr1Service.periodBounds`), maps to `BillRow` (partySnapshot.gstin /
  vendorBillNumber / vendorBillDate / taxableValuePaise / cgst+sgst+igstPaise), runs the
  pure reconciler, returns result + counts. Stateless.
- `gstr2b.controller.ts` POST `/workspaces/:wsId/firms/:firmId/gstr2b/reconcile`.
  Guards + subscription gate + `view_gst_compliance` permission mirror Gstr1Controller.
- Registered in `GstModule`.

Web:

- `lib/api/endpoints.ts` -> `gst.gstr2b.reconcile`.
- `reconcileGstr2bData` server action in `lib/actions/finance/gst.actions.ts`.
- Page `app/dashboard/finance/firms/[firmId]/gst/gstr2b/page.tsx`: month picker +
  JSON dropzone (reads file text client-side, JSON.parse, hands object to the action -
  AntD `beforeUpload` returns false so AntD never POSTs the raw file).
- `components/finance/gst/gstr2b/Gstr2bWorksheet.tsx`: 5 summary tiles + tabbed table.
- i18n complete across en / gu / gu-en / hi-en (`finance.gstr2b.*`).
- Quick-link added on the GST hub page.

## Verification

- BE: `nest build` clean (SWC, 1842 files); 9/9 pure-core vitest green.
- Web: `tsc --noEmit` shows zero errors in any gstr2b/gst.actions/gst page file (the 6
  remaining repo errors are all in the unrelated `app/connect/companies/page.tsx` WIP).

## Owner owes / follow-ups

- Live smoke: download a real GSTR-2B JSON from the GST portal, upload on the page,
  confirm buckets + ITC-at-risk look right against known bills.
- Decide on the v2 "accept 2B value" write path (edits posted bills - logical change).
- Period nuance: v1 matches bills by their own voucherDate in the period. Timing
  differences (bill booked in a different month than the supplier reported) will show as
  missing-in-2B / missing-in-books across adjacent periods; a future "carry-forward /
  multi-period" view can close that.
