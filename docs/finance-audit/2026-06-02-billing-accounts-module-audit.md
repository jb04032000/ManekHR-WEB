# Billing & Accounts (Finance) Module - Senior Audit Register

Date: 2026-06-02
Auditor: assistant acting as senior CA + accountant + full-stack/UX engineer
Method: 8 parallel read-only area audits across `crewroster-web` + `crewroster-backend`.
Scope: 179 web pages, 81 backend controllers, 35 finance sub-modules.

> **How to read this.** Every row below is an audit _lead_, captured from a fast
> read-only pass. Line numbers and logic reads are NOT yet ground-truth. Each
> finding MUST be re-verified against live source before any fix is written
> (that verification happens inside the slice that owns the finding). Treat this
> register as the prioritized work-list, not as proven defects.

Priority key:

- **P0** correctness / data-loss / wrong-money / wrong-tax / security
- **P1** broken flow / dead link / unpersisted state / API-contract mismatch
- **P2** UX gaps (loading/empty/error states, validation, a11y, i18n, AntD v6)
- **P3** polish / copy / consistency

Status key: `open` / `verifying` / `fixing` / `done` / `wontfix` / `stale`

---

## 0. Cross-cutting themes (recur across many areas - fix as patterns)

| #   | Theme                                                                                 | Where it shows up                                                                                                   | Approach                                                                                                          |
| --- | ------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| X1  | **Allocation / concurrency re-validation must happen INSIDE the posting transaction** | payment-receipt, payment-out, cheques, sale-invoice amountDue                                                       | Re-read the target doc inside the session and assert `sum(alloc) <= due` before `$inc`; reject on drift.          |
| X2  | **Fiscal-year lock not enforced on every voucher write**                              | confirmed on JV/CN/DN/Contra; UNCONFIRMED on expenses, payment-in/out, loans, fixed-assets, depreciation, mfg       | Audit every write path for `fyLock.assertOpen()`; add where missing.                                              |
| X3  | **No trial-balance / posting-balance assertion**                                      | no TB service; FY-close can proceed while Dr≠Cr                                                                     | Add a trial-balance aggregation + `assertBalanced()` gate before FY close and as a report.                        |
| X4  | **Critical money/tax math has `.todo()` / missing tests**                             | disposal (0/13), depreciation-run (~3/30), debit-notes (none), journal-vouchers (none), GST aggregation, allocation | Write real unit tests per slice; this is the owner's "100s of tests" mandate.                                     |
| X5  | **AntD v6 deprecations**                                                              | call-todos (`destroyOnClose`), inventory (`Drawer width`, `Select popupStyle`), others                              | Sweep per slice; lint rule already exists for some dirs.                                                          |
| X6  | **Missing loading / empty / error states**                                            | trial-balance, stock summary, credit-notes section, many report pages                                               | Standardize on the shared skeleton + Alert error + Empty patterns per slice.                                      |
| X7  | **Hardcoded Gujarat state code `'24'` in sales tax preview**                          | VoucherEditor / LineItemsTable                                                                                      | Derive from `firm.gstin[0:2]` (and party state) - preview must equal server snapshot at Post.                     |
| X8  | **Dead payment-gateway remnants** (Razorpay/Cashfree fields + webhook bridge)         | firm.schema, payment-receipt `createFromWebhook`, PaymentReceiptForm mode options                                   | Known inert remnants from the recording-only teardown - remove schema fields, dead methods, gateway mode options. |
| X9  | **Public customer portal does not enforce token `scope`**                             | portal-public.service reads invoices/receipts/aging without checking `ctx.scope`                                    | **SECURITY - treat as urgent.** Gate every portal read by scope; add IDOR tests.                                  |

---

## 1. SECURITY (do first regardless of slice order)

| ID    | P   | Issue                                                                                                                                                               | file:line (reported)                              | Fix                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      | Status |
| ----- | --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| SEC-1 | P0  | Public portal read endpoints don't check `ctx.scope` - a token scoped to `statement` can pull invoices/receipts/aging (IDOR). Portal is unauthenticated/token-only. | `party-portal/portal-public.service.ts`           | **DONE 2026-06-02.** Service-level `assertScope(ctx, required)` on statement/invoices/receipts/aging + invoice-PDF ownership check (403 before any DB hit); `getContext` now returns `scope`; web `PortalShell` renders only permitted tabs (`?tab=` guessing can't reach a hidden tab - backend 403s it). 7 unit tests in `__tests__/portal-scope.vitest.ts`. NOTE: cross-PARTY isolation was already solid (partyId derived from the verified token, never request input; PDF routes assert ownership) - the gap was same-party scope/least-privilege. | done   |
| SEC-2 | P1  | Recycle-bin restore / permanent-delete have ZERO audit trail.                                                                                                       | `recycle-bin.service.ts:52-75`                    | Inject AuditService, log actor/entity/workspace on both.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | open   |
| SEC-3 | P1  | Accountant-invite accept binds `accountantWorkspaces` but maps to no RBAC role - invited accountant has unenforced permission level.                                | `accountant-invite/*`                             | Bind invite to a seeded role / explicit module-permission enforcement.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | open   |
| SEC-4 | P1  | Trial-balance / report services trust wsId/firmId params without fail-fast caller assertion at service boundary.                                                    | `reports/financial-statements.service.ts:136-182` | Confirm guard chain; add defensive assertion.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | open   |

---

## 2. Onboarding & Setup (SLICE 1 - in progress)

| ID   | P   | Issue                                                                                                                                                                    | file:line (verified)                                        | Fix                                                                                     | Status    |
| ---- | --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------- | --------------------------------------------------------------------------------------- | --------- |
| ON-1 | P0  | Wizard Step 2 collects `address`/`phone`/`email` but Firm schema has no such fields → Mongoose strict drops them → silent data loss.                                     | `firm.schema.ts` (no fields) + `firms/new/page.tsx:217-225` | Add structured `address`/`contact` to Firm (or brandProfile) + persist in wizard step2. | verifying |
| ON-2 | P1  | "Add business address" checklist item checks `brandProfile.address` which is never written → can never go green.                                                         | `firms.service.ts:~367`                                     | Point check at the real persisted field once ON-1 lands.                                | verifying |
| ON-3 | P1  | Checklist links to `settings?tab=brand` / `?tab=general` routes that don't exist (real pages: `settings/branding`, `settings/numbering`, `settings/gstins`). Dead links. | `firms.service.ts:~360-388`                                 | Repoint each item to its real leaf route.                                               | verifying |
| ON-4 | P1  | "Configure voucher series" marks done from `step3Done` (which collects role + rounding), not from an actual series existing. Wrong signal.                               | `firms.service.ts:~385`                                     | Compute done from a real voucher-series existence check.                                | verifying |
| ON-5 | P2  | Steps 2 & 3 have no validation; no autosave/draft; reload-resume works but is jarring; vague copy ("Recommended", terse "Fetch Details").                                | `firms/new/page.tsx`                                        | Per-field validation, clearer copy, info icons where genuinely helpful.                 | verifying |
| ON-6 | P2  | Wizard uses a bare `<Spin>` for load; inconsistent with skeleton pattern.                                                                                                | `firms/new/page.tsx:164`                                    | Replace with a structured skeleton.                                                     | verifying |
| ON-7 | P3  | `setupChecklistState.dismissedFields` is dead (referenced on dashboard, never set).                                                                                      | `page.tsx:79-80`                                            | Either wire dismiss or remove.                                                          | verifying |

(Onboarding gets a full design + market research + rebuild + tests as Slice 1.)

---

## 3. Sales / Order-to-Cash

| ID    | P    | Issue                                                                             | file:line (reported)                                  | Fix                                  |
| ----- | ---- | --------------------------------------------------------------------------------- | ----------------------------------------------------- | ------------------------------------ |
| SAL-1 | P0   | Hardcoded firm state `'24'` in tax preview → preview≠posting for inter-state/RCM. | `VoucherEditor.tsx:595`, `LineItemsTable.tsx:113-117` | Derive from firm/party GSTIN.        |
| SAL-2 | P0   | No guard against `isReverseCharge && isBillOfSupply` both true.                   | `sale-invoice.service.ts:200-229,286`                 | Mutual-exclusivity validation.       |
| SAL-3 | P1   | `findByPaymentLinkId` may omit firm scope (also a payment-gateway remnant).       | `sale-invoice.service.ts:175-180`                     | Remove with X8 cleanup or add scope. |
| SAL-4 | P1   | No client validation on line items (discount>100, negative rate).                 | `LineItemsTable.tsx:231-360`                          | min/max + inline errors.             |
| SAL-5 | P1   | Convert (quote→order→invoice) has no confirm + no same-party validation.          | `convert-voucher.service.ts:48-128`                   | Confirm modal + reject mixed-party.  |
| SAL-6 | P2   | Credit-notes section on invoice detail lacks error state.                         | `sales/invoices/[id]/page.tsx:42-53`                  | Add catch + Alert.                   |
| SAL-7 | P2   | Shipping & EWB tabs use uncontrolled `Form.Item`s with no save path.              | `VoucherEditor.tsx:368-409,488-498`                   | Wire to form/state or remove.        |
| SAL-8 | P2/3 | LateFeeSchedule DTO/schema field-name mismatch (`value` vs `ratePercent`).        | DTO + service:488-495                                 | Align names.                         |

Tests: RCM+BoS conflict, multi-GSTIN state resolution, unregistered-party fallback, convert same-party, e-invoice HSN-by-AATO, payment-link isolation.

---

## 4. Purchases & Expenses

| ID    | P   | Issue                                                                                    | file:line (reported)                                         | Fix                                                         |
| ----- | --- | ---------------------------------------------------------------------------------------- | ------------------------------------------------------------ | ----------------------------------------------------------- |
| PUR-1 | P0  | Payment-out allocation re-validation/locking not fully inside txn (race).                | `payment-out.service.ts:138-197`                             | Re-read bill in session; assert.                            |
| PUR-2 | P0  | Bill `partySnapshot` (PAN/type) can be stale at post → wrong TDS.                        | `payment-out.service.ts:149-224`                             | Re-snapshot party inside txn.                               |
| PUR-3 | P0  | Bill 194Q TDS + payment 194C/H/J TDS - no double-deduction deconfliction.                | `payment-out.service.ts:228`, `purchase-bill.service.ts:184` | Track cumulative; guard + test.                             |
| PUR-4 | P0  | Capital-goods ITC amortisation schedule created but never released (ITC stuck).          | `capital-goods-itc.service.ts:69`                            | Implement 60-month release cron.                            |
| PUR-5 | P1  | PaymentOut idempotency lock not released on exception.                                   | `payment-out.service.ts:122-135`                             | try/finally release.                                        |
| PUR-6 | P1  | Purchase-bill stock inward falls back to default godown silently for multi-godown firms. | `purchase-bill.service.ts:217-226`                           | Require godown when batch-tracked.                          |
| PUR-7 | P1  | Expense form hardcodes `isIntraState=true` → wrong CGST/SGST vs IGST split.              | `ExpenseVoucherForm.tsx:83`                                  | Derive from firm vs supplier state.                         |
| PUR-8 | P1  | OCR adapters (Tesseract, Google DocAI) are stubs (confidence 0).                         | `ocr.service.ts`, adapters                                   | Gate behind clear "manual entry" message until implemented. |
| PUR-9 | P3  | `isDeleted` soft-delete queries lack composite index.                                    | `purchase-bill.schema.ts:112`                                | Add `{workspaceId,firmId,isDeleted}` index.                 |

Tests: 194Q+194C double-deduction, Rule-47A self-invoice, allocation race, capital-goods ITC split, expense TDS thresholds, intra/inter-state split.

---

## 5. Payments / Bank / Cash / Cheques / Loans

| ID    | P   | Issue                                                                                                               | file:line (reported)                                                                           | Fix                                        |
| ----- | --- | ------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- | ------------------------------------------ |
| PAY-1 | P0  | Razorpay/Cashfree credential fields on Firm + gateway mode options + webhook bridge - dead, recording-only product. | `firm.schema.ts:143-155`, `PaymentReceiptForm.tsx:35-36`, `payment-receipt.service.ts:397-426` | Remove (X8).                               |
| PAY-2 | P0  | Payment-receipt allocation not re-validated at post (over-allocation/negative due under concurrency).               | `payment-receipt.service.ts:56-61,298-328`                                                     | Re-check in session (X1).                  |
| PAY-3 | P0  | Cheque bounce: charges `atomicDebit` failure leaves reversal posted but bank not debited (no rollback).             | `cheques.service.ts:368-386`                                                                   | Single txn; rethrow on charges failure.    |
| PAY-4 | P0  | Loan last-EMI principal can exceed opening (rounding drift breaks amortisation invariant).                          | `loan-accounts.service.ts:100-107,155-159`                                                     | Cap last principal to opening; test drift. |
| PAY-5 | P1  | Bank statement running balance includes reversed ledger entries.                                                    | `bank-accounts.service.ts:434-449`                                                             | Filter `isReversed:false`.                 |
| PAY-6 | P1  | Party ledger uses `$setWindowFields` (Mongo 5.0+) with no version guard.                                            | `party-ledger.service.ts:60-70`                                                                | Document/guard min version.                |
| PAY-7 | P1  | Webhook system-actor hardcoded ObjectId may break audit FK (remnant).                                               | `payment-receipt.service.ts:406`                                                               | Remove with X8.                            |
| PAY-8 | P2  | Allocation InputNumber allows fractional paise.                                                                     | `PaymentAllocationTable.tsx:63-65`                                                             | step=0.01 + integer-paise guard.           |
| PAY-9 | P3  | Credit-note reversal doesn't revert orphaned payment allocations.                                                   | payment-receipt + credit-note                                                                  | Revert `unappliedPaise` on CN.             |

Tests: concurrent double-allocation, paise overflow, amortisation drift/prepay, reconciliation reversal-pairs, cross-firm match isolation, bounce rollback.

---

## 6. Books core (Journal / Ledger / Returns / Fiscal Year)

| ID   | P   | Issue                                                                                            | file:line (reported)                                       | Fix                                    |
| ---- | --- | ------------------------------------------------------------------------------------------------ | ---------------------------------------------------------- | -------------------------------------- |
| BK-1 | P0  | JV lines not validated `>= 0` (negatives bypass balance semantics).                              | `journal-vouchers.service.ts:70-79`                        | Non-negative guard + schema validator. |
| BK-2 | P0  | Contra form sends account IDs but service does `findByCode` → 404 contract mismatch.             | `ContraVoucherForm.tsx:43-44` vs `contra.service.ts:82-91` | Align IDs vs codes.                    |
| BK-3 | P0  | Credit-note >5L CDNR ITC-reversal gate enforced server-side but no UI to satisfy it.             | `credit-notes.service.ts:304-317`                          | Add status select + CA-cert upload UI. |
| BK-4 | P1  | Debit-note 194Q reversal is "informational only" (manual), should auto-reverse proportional TDS. | `debit-notes.service.ts:175-188`                           | Auto-post reversal + test.             |
| BK-5 | P1  | No trial-balance service / GL aggregation endpoint (X3).                                         | ledger module                                              | Build it.                              |
| BK-6 | P1  | FY close has no mandatory Dr=Cr assertion (X3).                                                  | `fiscal-year.controller.ts:74-79`                          | Assert balanced before close.          |
| BK-7 | P1  | Contra allows from==to account (no guard).                                                       | `ContraVoucherForm.tsx` + `contra.service.ts`              | Reject same account.                   |
| BK-8 | P2  | JV/Contra forms don't surface FY-lock (disabled dates) → repeated 400s.                          | `journal-vouchers/new/page.tsx:39-46`                      | Disable closed-FY dates.               |
| BK-9 | P2  | JV `costCentre` lost in JV→LedgerEntry mapping.                                                  | `ledger-posting.service.ts:1429-1436`                      | Map costCentre.                        |

Tests: JV balance invariant, FY-close-blocks-imbalance, CN 5L gate, DN TDS reversal, posting coverage for payment/expense/contra.

---

## 7. Inventory / Manufacturing / Job-Work

| ID    | P   | Issue                                                                                                   | file:line (reported)                   | Fix                              |
| ----- | --- | ------------------------------------------------------------------------------------------------------- | -------------------------------------- | -------------------------------- |
| INV-1 | P0  | Negative-stock guard not enforced in stock-transfers (warning-only despite `allowNegativeStock=false`). | stock-transfers.service                | Reject outward > available.      |
| INV-2 | P0  | Paise overflow risk in valuation (qty×cost rounding, no clamp).                                         | stock-summary.service:198              | Clamp / BigInt.                  |
| INV-3 | P0  | MV input cost not snapshotted at consumption (uses live Item avg).                                      | manufacturing-vouchers.service:391-396 | Record `costAtConsumptionPaise`. |
| INV-4 | P0  | Job-work ITC-04 deemed-supply not auto-set on 365-day breach.                                           | jw-lot.service:51                      | Nightly cron to flag.            |
| INV-5 | P0  | JWO lot decrement lacks firm scope (cross-firm consume).                                                | jw-outward-challan.service:250+        | Add firm/workspace filter.       |
| INV-6 | P0  | BOM explosion has no cycle guard.                                                                       | bom.service                            | Acyclic visited-set guard.       |
| INV-7 | P1  | ITC-04 Q4 boundary excludes Apr 1 entries (`$lt` off-by-one).                                           | itc04.service:67-75                    | Fix end-month boundary.          |
| INV-8 | P1  | Stock inward allows costPaise=0.                                                                        | stock-movements.service:169            | Require/default cost.            |
| INV-9 | P3  | AntD v6 deprecations in inventory (Drawer width, Select popupStyle).                                    | inventory components                   | Sweep.                           |

Tests: BOM cycles, cross-firm lot, valuation overflow, ITC-04 Q4 boundary, deemed-supply cron.

---

## 8. Fixed Assets

| ID   | P   | Issue                                                                   | file:line (reported)           | Fix                                 |
| ---- | --- | ----------------------------------------------------------------------- | ------------------------------ | ----------------------------------- |
| FA-1 | P0  | Block-summary disposal uses cost not NBV → overstates depreciation/WDV. | reports.service:181            | Use NBV.                            |
| FA-2 | P0  | ITC reversal timing vs partial-month depreciation can over/under-claim. | disposal.service:57-74         | Recompute after partial-month post. |
| FA-3 | P0  | No warning when assets lack IT-Act block (silent Unclassified).         | reports.service:153            | Validate block assignment.          |
| FA-4 | P1  | Transfer never sets status='transferred' (filters return empty).        | disposal.service:205-233       | Set status.                         |
| FA-5 | P1  | 180-day rule helper exists but never called (Companies Act gap).        | depreciation-math.service:87   | Integrate into first-FY compute.    |
| FA-6 | P1  | Depreciation runs not gated by period lock (X2).                        | depreciation-run.service:81-83 | Add lock check.                     |
| FA-7 | P2  | Disposal tests 0/13, depreciation-run ~3/30, reports untested (X4).     | \*.spec.ts                     | Implement.                          |

---

## 9. Reports & GST compliance

| ID    | P   | Issue                                                                      | file:line (reported)                         | Fix                                                                        |
| ----- | --- | -------------------------------------------------------------------------- | -------------------------------------------- | -------------------------------------------------------------------------- |
| RPT-1 | P0  | P&L gross profit ignores opening/closing stock (closingStock hardcoded 0). | financial-statements.service:254,234         | Implement stock balances.                                                  |
| RPT-2 | P0  | Balance sheet may double-count income/expense into equity.                 | financial-statements.service:366-371         | Fix equity computation; assert Assets=L+C.                                 |
| RPT-3 | P0  | Cash-flow opening/closing logic inverted; ignores multiple bank accounts.  | financial-statements.service:456-457,409-413 | Real opening/closing per account.                                          |
| RPT-4 | P0  | GSTR-1 builder lacks rate validation; tax may not reconcile.               | gstr1/builders/b2b.builder:135               | Validate rate; assert tax≈txval×rate.                                      |
| RPT-5 | P0  | GSTR-3B 3.1(d) RCM may include non-RCM output tax.                         | gstr3b.service:251-252                       | Filter reverseCharge.                                                      |
| RPT-6 | P1  | Party-statement all-parties mode has no backend endpoint (dead UX).        | party-statement/page.tsx:20-24               | Add endpoint or hide mode (note: 4c added party-wise-pl earlier - verify). |
| RPT-7 | P1  | Aging bucket boundaries not asserted (double-count risk).                  | party-ledger.service:12-21                   | Boundary tests.                                                            |
| RPT-8 | P2  | GSTR-1 page double-multiplies paise (`*100`).                              | gstr1/page.tsx:66                            | Remove `*100` if paise.                                                    |
| RPT-9 | P2  | Trial-balance / report pages lack skeleton + error states (X6).            | trial-balance/page.tsx:80                    | Add states.                                                                |

Tests: TB balanced, BS tie-out, P&L gross-profit, GSTR-1 aggregation, GSTR-3B RCM.

---

## 10. Periphery (Reminders / Party Intelligence / Portal / Misc)

| ID    | P   | Issue                                                                                  | file:line (reported)                | Fix                          |
| ----- | --- | -------------------------------------------------------------------------------------- | ----------------------------------- | ---------------------------- |
| PER-1 | P0  | Portal scope IDOR (= SEC-1).                                                           | portal-public.service:134-212       | Gate by scope.               |
| PER-2 | P1  | Reminder dispatcher null-owner fallback yields invalid User IDs (silent send failure). | reminder-dispatcher.service:449-462 | Fail explicitly.             |
| PER-3 | P1  | Machine-maintenance reminder rule lookup passes a User ID in the partyId slot.         | reminder-dispatcher.service:655-660 | Separate global-rule lookup. |
| PER-4 | P2  | Party-intelligence shipped as Wave-0 shells but surfaced in capabilities.              | party-intelligence.module:75-90     | Confirm + gate or finish.    |
| PER-5 | P2  | call-todos uses deprecated `destroyOnClose` (X5).                                      | call-todos/page.tsx:312,351         | `destroyOnHidden`.           |
| PER-6 | P3  | call-todos shows truncated partyId/assignedTo instead of names.                        | call-todos/page.tsx:152,189         | Resolve names + links.       |

---

## Slice roadmap (order of execution)

1. **Onboarding & Setup** (Section 2) - **DONE 2026-06-02, browser-verified**. Firm schema gained structured `address` + `contact` + per-GSTIN address; wizard save hardened with a per-step whitelist (fixes silent data loss + mass-assignment); setup checklist rewritten (real done-checks + real routes, bogus items dropped); wizard rebuilt on shared `BusinessProfileFields` (skeleton, validation, GSTIN autofill, info icons); canonical finance **Business Profile** settings page added and the duplicate editor removed from workspace settings (redirect card); seller address wired into the **web** print themes; Billing & Accounts breadcrumb **User Guide** added; 6 backend unit tests pass. tsc + eslint clean (web), nest build clean (BE).
   - **Slice-1 follow-ups (deferred, documented):** (a) backend print engine (emailed PDFs, theme-classic/theme-modern) renders firm name + GSTIN but no seller-address block - add address rendering there too; (b) i18n the new onboarding / Business Profile / redirect-card strings across all 4 locales (currently hardcoded EN, matching the pre-existing wizard); (c) optional: GSTIN-lookup could also return + prefill the principal address.
2. **Portal security (SEC-1..4)** - urgent; small, high-risk. Scope gating + audit + IDOR tests.
3. **Sales / Order-to-Cash** (Section 3) - highest-volume daily flow; tax-preview correctness (X7) is money-critical.
4. **Payments / Bank / Cash / Cheques / Loans** (Section 5) - concurrency/allocation (X1) + remove gateway remnants (X8).
5. **Books core** (Section 6) - trial balance + FY-close balance gate (X3) + posting integrity.
6. **Purchases & Expenses** (Section 4) - TDS/ITC correctness.
7. **Reports & GST** (Section 9) - statutory statements + GSTR aggregation correctness.
8. **Inventory / Mfg / Job-Work** (Section 7).
9. **Fixed Assets** (Section 8).
10. **Periphery** (Section 10) + cross-cutting test backfill (X4) + AntD v6 sweep (X5).

Each slice: verify findings → market research where UX/standards matter → build best-in-industry (no stubs) → cross-link to related modules → info icons (smart, not everywhere) → breadcrumb guide for the area → unit tests → tsc/eslint/build green → slice report. No git ops (owner commits). Logical/schema changes are documented here as they land.
