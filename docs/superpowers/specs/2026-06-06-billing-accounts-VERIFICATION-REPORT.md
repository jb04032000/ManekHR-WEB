# Billing & Accounts - Independent Verification Report

Date: 2026-06-06
Reviewer: second-opinion pass (independent of the implementing session)
Scope: the uncommitted finance work on `crewroster-web` `main` (2 bug fixes, the
invoice-creator redesign, the menu/i18n change) + the roadmap and program plan.
Method: full read of the 4 spec docs and all 7 changed code files + the shared tax
engine and the canonical pages they claim to match; ESLint on the changed files;
competitive fact-check via web. Honest limitation noted in section F.
Guardrails honored: zero git, zero money movement, no code changed.

Verdict in one line: the two bug fixes and the redesign are correct, consistent, and
honest (no faked data). One real data-contract bug found (payment terms), plus a few
low-severity UX/consistency items. The plan is sound and refreshingly non-rebuild; its
main weakness is that execution led with cosmetics while its own "correctness first"
Phase 0 has not started.

---

## A. Verified correct

1. **Sidebar active-highlight fix is correct and non-regressing.**
   `salesItemKeys` (Sidebar.tsx:372-382) holds all 7 Sales child keys and is spread into
   `allItemKeys` (449). The matcher was changed from first-match to longest-match
   (471-473): it filters keys that the pathname equals or starts with, then sorts by
   length descending and takes the first. For `/sales/invoices/new` the specific
   `.../sales/invoices` key (long) beats the generic `/dashboard/finance` (short), so the
   right child highlights. The same longest-match restores inventory / manufacturing /
   job-work / GST, whose keys are all registered (384-424) and are deeper than the
   catch-all. `selectedKeys={[activeKey]}` drives the Menu (2552); AntD adds
   `.ant-menu-submenu-selected` to ancestors, which the new CSS (globals.css:617-627)
   styles, so the parent sections (Billing & Accounts, Sales) also read active. Deep-link
   open-state is seeded once at mount (533-542) via `activeFinanceSectionKey`, which maps
   `/sales/` and `/returns/credit-notes` to `fin-sec-sales` (499-504). Solid.

2. **"Saved locally" fix is correct.**
   The hook only arms the 30s server timer when `canServerSave` is true
   (useDraftAutosave.ts:110-114) and the on-blur save bails when `!canServerSave` (133).
   The editor computes `hasContent = !!partyId || lines>0` (VoucherEditor.tsx:1219-1220)
   and passes `canServerSave={!!ws._id && hasContent}` (1231). The IndexedDB local save
   still runs (harmless). The pill shows "Draft" for a pristine/new invoice and only ever
   shows "Saved locally" when `status==='offline' && !isNewDraft` (Header:90-95). Net on a
   fresh `/new` page: no server POST fires and the header reads "Draft," exactly as
   intended.

3. **Tax computation is wired correctly and reconciles end-to-end.**
   `computeTaxClient` (taxComputeClient.ts) is the single engine. It feeds the rail's
   result (VoucherEditor.tsx:1192) and, via `useLineItems`, the table's per-line result
   (useLineItems.ts:34) - both from the same `taxContext`, so they cannot diverge.
   `isIntraState = firmStateCode === placeOfSupplyStateCode` is computed identically in the
   engine (taxComputeClient.ts:65), the rail (VoucherEditor.tsx:1564), the table
   (LineItemsTable.tsx:213), and the "why this tax" callout (VoucherEditor.tsx:285). The
   rail's rate-wise breakdown (`buildRateWise`, InvoiceSummaryRail.tsx:31-62) reuses the
   exact precision helpers (`gstHalves`, `igstPaise`) and per-charge logic of the engine,
   so the breakdown total reconciles to `cgst+sgst+igst`. **No hardcoded `'24'` (Gujarat)
   in the front-end preview**: seller state derives from `sellerGstin -> firm.gstin ->
firm.address.stateCode` (1172-1176); POS derives from chosen POS -> party GSTIN state ->
   seller state. Intra/inter therefore flips CGST+SGST <-> IGST consistently across line
   labels, the callout, and the rail.

4. **No redesign regressions in the editor plumbing.**
   Post (1287-1330), 30s undo toast + cancel (1304-1351), preview (1355-1363), crash
   recovery (1235-1242), concurrent-edit BroadcastChannel (1245-1256), and keyboard
   shortcuts Alt+N / Ctrl+S / Ctrl+Enter / Esc (1259-1285, LineItemsTable.tsx:141-150) are
   all preserved. Idempotency key is still passed to `.post` (1300). Per-type conditionals
   for the 5 voucher types are intact (`isSaleInvoice` gates reverse-charge, bill-of-supply,
   multi-GSTIN, and the e-Invoice/e-Way tabs).

5. **RBAC gating on Post preserved.** For `sale_invoice` the primary button is wrapped in
   `<Can path="finance.invoice.post" scope="all">` (Header:176-182); the four
   non-ledger sibling types render it ungated, which is appropriate.

6. **Deletion is clean.** `VoucherEditorTabs.tsx` is gone with **zero dangling references**
   to it or to `TaxSummaryTab` / `ShippingTab` / `NotesTab` anywhere in app/components/
   hooks/lib. All four sibling new/edit pages mount `VoucherEditor` and inherit the redesign
   (`inventory/samples/new` is a false match - it uses `SampleVoucherEditor`).

7. **Design tokens, components, i18n, AntD v6.**
   The editor header `<h1>` (Header:161) is **byte-identical** to the Team page title
   (team/page.tsx:1455): `m-0 font-display text-[20px] leading-[1.25] font-semibold
text-heading`. `EDITOR_CARD_STYLE` (1032-1038) matches DsCard's tokens exactly
   (`--cr-radius-xl`, `1px solid --cr-border`, `--cr-shadow-card`, `--cr-surface`). DsButton
   is used in the header. `navigation.salesItems.*` and `billingGroups.sales` exist in all
   four locales with the requested renames (Sales Orders, Proforma Invoices, Recurring
   Invoices). AntD v6 API used (`destroyOnHidden`, not the deprecated `destroyOnClose`;
   vertical `Form` with `component={false}`).

8. **Honesty check: PASS.** No stub data presented as real.
   - Credit limit reads `selectedParty.creditLimit` and renders **"Not set"** when absent
     (VoucherEditor.tsx:419-427) - not fabricated.
   - Balance due reads `selectedParty.currentBalance` and renders **"-"** when absent (416).
   - Invoice number shows the real `voucherNumber` or the honest placeholder **"Auto on
     posting"** (553).
   - Shipping/transport: genuinely removed (the unwired stub), not faked.
   - Additional Charges and Internal notes are actually wired (field array -> tax engine;
     `internalNotes` -> form state).
   - e-Invoice / e-Way / Activity moved to an edit-mode-only "Document & history" section
     reading real fields (`eInvoice.status/irn`, `ewayBill.ewbNo`, `auditLog`) with honest
     empty states.

9. **Lint: 0 errors** on all six changed code files (11 pre-existing warnings: `any`
   casts and `<img>`/unused-var warnings, all in Sidebar/VoucherEditor and none in the
   three new files or the autosave hook). Matches the handoff's "0 errors" claim.

---

## B. Bugs / regressions / risks

**B1 - Payment Terms is written under the wrong key; it will not persist. Sev: MEDIUM.**
`VoucherEditor.tsx:610-611` writes `paymentTerms = { termsDays: v }` and reads
`paymentTermsVal?.termsDays` (272, 296). But the type contract is `dueDays`
(types/index.ts:5239 and :5341: `paymentTerms?: { dueDays?: number; label?: string }`),
the form default seeds `{ dueDays: 0 }` (VoucherEditor.tsx:1158), and a repo-wide search
shows **`termsDays` exists only in VoucherEditor.tsx** (4 sites) with no mapper converting
it. Effect: the in-form Due-date preview is self-consistent (it reads back its own
`termsDays`), but on save/post the backend reads `dueDays`, which stays 0/undefined, so the
chosen term (Net 15/30/45/60) is silently dropped. This is the one substantive correctness
bug in the change. Fix: standardize the Select value/onChange and the due-date read on
`dueDays` (or map `termsDays -> dueDays` in `onServerSave`). I could not confirm from here
whether it predates the redesign, but it is live in the reviewed file.

**B2 - "Save & Post" on a brand-new invoice does not post. Sev: LOW (UX).**
`handlePost` on a draft with no `_id` only calls `autosave.saveNow()` then returns
(VoucherEditor.tsx:1287-1292): it creates the draft and `router.replace`s to the edit page.
The primary button still reads "Save & Post" (Header:127). So the first click saves +
navigates; the user must click "Post Invoice" again on the edit page. Defensible (no id
exists to post against yet) but the label over-promises. Consider relabeling the new-draft
primary to "Save & continue" or auto-invoking post after the create resolves.

**B3 - Explicit "Save Draft" on a pristine empty invoice still fires a failing POST. Sev:
LOW.** `saveNow()` (useDraftAutosave.ts:92-97) does not consult `canServerSave`, so clicking
Save Draft (or Ctrl+S) on an untouched new invoice POSTs an empty body the server rejects.
No false "Saved locally" results (the pill guards on `isNewDraft`), but it is a wasted
failing request. Gate `saveNow`/the Save-Draft button on `hasContent`.

**B4 - `?partyId=` deep link is not applied to the editor. Sev: LOW.**
`sales/invoices/new/page.tsx:19` reads `partyId` from the query but only passes it to
`BlacklistedPartyWarning` (24); `VoucherEditor` is mounted without it (25) and exposes no
`partyId`/`initialPartyId` prop. So "create invoice for this party" deep links do not
preselect the party even though the page clearly anticipates that param. Wire an initial
party prop through to the form. (May predate the redesign.)

**B5 - En-dashes used as minus signs. Sev: VERY LOW (nit).**
`InvoiceSummaryRail.tsx:149` (discount) and `:224` (round-off) use U+2013 "-" as a minus.
There are **zero em-dashes** anywhere in the changed files (the house rule is honored), but
if the style also disfavors en-dashes, switch these to a hyphen-minus or U+2212.

**Pre-existing items observed (not caused by this work, flagged for awareness):**

- Contras never self-highlights: `allItemKeys` has `/dashboard/finance/contras`
  (Sidebar.tsx:441) but the menu item key is `/dashboard/finance/contras/new` (1185), so
  the resolved `activeKey` is not a menu key. The longest-match change neither fixes nor
  worsens this. Sev: low.
- `regularizationEnabled` / `downtimeEnabled` / `maintenanceEnabled` assigned-but-unused
  (Sidebar.tsx:269-271) - lint warnings, pre-existing.
- Static `notification.*` / `Modal.confirm` in VoucherEditor (e.g., 1271, 1304, 1323) will
  not consume the `App`/ConfigProvider context (AntD v6 prefers `App.useApp()`). Functional
  but unthemed; `InfoTab` already uses `App.useApp()` for `message`, so the pattern is mixed.

---

## C. Design / consistency

**C1 - The editor now matches the Team page, but the Tax Invoices LIST page it was also
asked to match still uses the old AntD `<Title>`.**
Editor + Team use the canonical `<h1 class="font-display ... font-semibold text-heading">`.
The list page (sales/invoices/page.tsx:212) still renders `<Title level={1}
style={{fontSize:20}}>` - a different font family, weight, and color. So the editor matches
the **correct** canonical (Team); the two finance pages are not pixel-identical, and the
**list page is now the laggard**. Vertical spacing is effectively matched (~16px gap each).
Recommend migrating the list-page h1 to the canonical pattern (a small follow-up; the
handoff already scopes "list pages not yet polished").

**C2 - Hand-rolled card/header instead of the Ds components.** The editor uses a raw
`<section style={EDITOR_CARD_STYLE}>` rather than `<DsCard>`, and a hand-rolled `<header>`.
Tokens are identical to DsCard so it is visually consistent, and `DsPageHeader` does not
exist in the repo (so matching Team's hand-rolled h1 is the right call). Low priority, but
swapping the section for `<DsCard>` would reduce drift if DsCard's tokens ever change.

**C3 - Good consistency wins worth recording:** reverse-charge and bill-of-supply enforce
the server's mutual-exclusivity client-side (654, 699); place-of-supply is an override with
a tooltip, not an always-open dropdown; the "why this tax" callout makes the CGST/SGST-vs-
IGST derivation explicit; empty/loading states exist for the line grid and item search.

---

## D. Plan critique (roadmap + program plan)

**Competitive analysis - mostly accurate, two caveats.**

- Verified: Zoho Books does have GSTR-2B reconciliation (auto-bucketing matched/partial/
  missing), automated bank feeds, OCR autoscan + email-in, rule-based categorization, and
  AI-powered reconciliation. The roadmap's Zoho claims hold up.
- Caveat 1: **QuickBooks exited the India market on 30 Apr 2023.** Treating "ahead of
  QuickBooks on GST" as an India advantage slightly overstates relevance - QB is a global
  reference, not an India rival. The real India set (Zoho, Tally, Vyapar, Refrens,
  myBillBook) is correctly identified, so this is a framing nit.
- Caveat 2: the **"Zoho Expense OCR does not support Devanagari/Hindi"** claim underpins the
  "India-script-aware" wedge but is unverified and likely stale - Zoho advertises OCR in 15
  languages. Re-verify before making script coverage a load-bearing differentiator; if Zoho
  already covers Hindi, that wedge weakens.

**Structure - the reframe and the foundations decomposition are strong.**
The "mature suite, fix correctness not rebuild" thesis is the right read and avoids a
needless rewrite. F1-F5 (correctness, comms, learning store, matching engine, provider
slots) is a sound "build once, reuse" cut; generalizing the existing bank-reco into one F4
matching engine that later powers GSTR-2B recon + payment auto-reconcile + bank-feed
categorization is a genuinely good insight. Owner-gated provider/credential decisions are
correctly fenced off from the assistant.

**Holes to poke:**

1. **Execution inverted the plan's own first principle.** The plan says correctness is the
   foundation that "underwrites everything," yet this session shipped the UI redesign
   (Wave-1D cosmetics) first and Phase 0 "has not started" (handoff S5). Defensible - the UI
   was the owner's explicit first ask and is low-risk - but the plan should name the
   deviation rather than imply correctness went first.
2. **The Phase-0 bug list is stale.** Bucket A enumerates fixes "several of which were
   already done on 2026-06-04" but does not mark which. As written it would re-litigate
   closed bugs. The dedupe is deferred to a later "itemised fix-list" (program-plan S6.1);
   pull that dedupe forward so Phase 0 starts from a clean, current list.
3. **No regression/parity safety net for the number-changing fixes - the riskiest work.**
   These fixes alter figures on posted financial documents. The lifecycle has a generic
   Verify stage, but there is no mention of golden/regression tests on historical invoices,
   a recompute/backfill plan for already-posted docs, or - critically - a
   **"preview == posted" parity test** locking `computeTaxClient` to the backend snapshot.
   The entire "preview equals the server" promise rests on that byte-for-byte claim and is
   currently untested. Add it to Phase 0.
4. **The marquee "wedge" is on the blocked path.** Roadmap S5 names OCR Capture the first
   deep-design target, then immediately offers the keyboard/smart-defaults layer as the
   "lower-risk, no external dependency" alternative. Since Capture is blocked on an unmade
   OCR-vendor decision with no drop-dead date, just commit to keyboard-first as the Wave-2
   lead and design Capture in parallel. Leading with a provider-blocked item invites stall.
5. **F3 Learning store is a likely schema/permission change that is not flagged for the
   Stage-2 gate.** Per-party/per-vendor "Field Prediction" memory raises multi-tenant
   scoping and data-segregation questions - exactly the RBAC/scope surface the project
   CLAUDE.md is strict about. It should be surfaced as a logical change, not slipped in as
   foundation plumbing.
6. **GSTR-2B recon may be mis-sequenced vs the stated positioning.** The roadmap itself
   rates 2B recon "MEDIUM-HIGH, big accountant value" and notes Zoho and Refrens both do it,
   yet the program plan puts it in Wave 4 (last), behind payments and the portal. For a
   "GST powerhouse" position it is arguably the highest-leverage GST gap; consider pulling
   F4 (its only hard dependency) earlier to unlock it in Wave 3.
7. **WhatsApp send has an under-acknowledged external dependency.** It is bucketed under
   F2 comms, but the WhatsApp Business API needs provider onboarding + Meta template
   approval lead time - a real gate like the OCR/payment providers, not just an adapter.

**Phase-0 list completeness:** the enumerated bugs (tax-state hardcodes, P&L closing stock,
TB Dr=Cr gate, GSTR-3B RCM filter, payment-allocation race, TDS snapshot/double-deduction,
BS double-count, cash-flow inversion, JV negatives) are a strong set. The one missing item
is the preview/posted parity test in hole #3 above.

---

## E. Prioritized next steps

1. **Fix B1 (payment terms `termsDays` vs `dueDays`).** Real data-loss bug, isolated to
   VoucherEditor.tsx, ~4 lines. Do first.
2. **Start Phase 0 correctness**, beginning with a deduped fix-list cross-checked against the
   2026-06-04 session, and add the **`computeTaxClient` <-> backend parity golden test** plus
   a recompute/backfill note for posted documents.
3. **Tidy the editor UX nits:** gate Save Draft / `saveNow` on `hasContent` (B3); relabel or
   auto-post the new-draft primary (B2); wire `?partyId=` through to the form (B4); swap the
   two en-dashes for minus/hyphen (B5).
4. **Migrate the Tax Invoices LIST page title to the canonical `<h1>`** so the two finance
   surfaces finally match (C1) - small, closes the owner's original "match the list page"
   ask from the other direction.
5. **Re-verify the Devanagari/Zoho-OCR claim** before it anchors the India-script wedge; and
   in the roadmap, footnote that QuickBooks left India in 2023.
6. **Commit the verified work** (owner stages + commits; assistant ran zero git).
7. **For Wave 2, lead with keyboard-first + smart-defaults** (no external dependency) and
   design OCR Capture in parallel pending the owner's OCR-provider choice; flag the F3
   learning store as a Stage-2 logical/schema change before building it.

---

## F. Honest limitation - live browser verification was not possible

Step 4 asked for an in-browser click-through at
`localhost:3001/.../sales/invoices/new`. I could not perform it: no Chrome instance is
connected to the browser tools (`list_connected_browsers` returned empty), and the isolated
Linux sandbox cannot reach the user's machine - ports 3001/3000 are unreachable, and the
page requires the NestJS backend + auth + a seeded firm to render. This is the same access
limitation the implementing session hit; the assumption that this reviewer could reach the
authenticated app did not hold in practice. Everything in sections A-C was therefore verified
by static + dataflow analysis of the actual source (matcher logic, the autosave gate state
machine, the shared tax engine and its three consumers, the deletion graph, the token/i18n
checks) plus ESLint, not by pixels. The behavioral claims (menu highlights; fresh invoice
shows "Draft" with no POST; party+line updates totals and the rate-wise GST; intra/inter
flips CGST+SGST <-> IGST; Save Draft/Post) are supported by that code path analysis, but a
human still owns the final on-screen confirmation, especially for B1 (does a saved Net-30
term survive a round-trip?) and the visual title-spacing comparison in C1.

Sources (competitive fact-check):

- [Intuit: Discontinuation of QuickBooks in India](https://blogs.intuit.com/2023/03/22/discontinuation-of-quickbooks-in-india/)
- [Zoho Books - GSTR-2B Reconciliation (India)](https://www.zoho.com/in/books/help/gst/gstr2b-reconcile.html)
- [Zoho Blog - AI-powered reconciliation, flexible bank feeds](https://www.zoho.com/blog/books/banking-enhancements.html)
