# Billing & Accounts session - handoff / verification record

Date: 2026-06-06
Purpose: a single place to verify what was asked, what was done, where it lives, and
what is still open. All code changes are UNCOMMITTED on `crewroster-web` `main`
(owner stages + commits; assistant ran zero git). Lint: 0 errors on all changed files.
NOT browser-verified by the assistant (could not reach the authenticated app).

---

## 1. What the owner asked (in order)

1. Improve Billing & Accounts UI/UX starting with the Sales menu; use proper/familiar
   menu names; fix the active menu not highlighting; fix the invoice "New" page UX
   (too cluttered, make it simplest); fix the false "Saved locally".
2. Match a provided reference mockup for the invoice creator ("far better than yours").
3. Make it look genuinely modern, not flat/default.
4. Align the page with the app's canonical patterns (title, form fields, cards); remove
   the unnecessary icon; no shortcuts, do it properly.
   5/6. Match the title to the Team page exactly; fix the title spacing.
5. Match the Tax Invoices LIST page title spacing; move Draft/Save/Preview into a proper
   header action bar like the reference.
6. Restructure the "Bill to & invoice details" section to the reference (left/right split).
7. Fix the remaining title-spacing mismatch vs the list page.
8. STRATEGY: research Zoho Books + competitors, find our gaps, write a detailed report,
   plan module/sub-module designs, act as PM, build best-in-industry with super-easy
   autofill UX; deep-research.
9. Positioning = "all three" (easiest+automated AND full breadth AND GST powerhouse).
10. Do all of it; map dependencies; prepare a proper plan; set up an agent workflow per a
    real software/product development lifecycle.

---

## 2. What was done

### A. Bug fixes (shipped, uncommitted)

- **Active sidebar highlight**: root cause was the active-key matcher taking the FIRST
  `startsWith` match, where a broad `/dashboard/finance` shadowed the firm-scoped Sales
  keys (which were absent). Fix: added `salesItemKeys` + switched to LONGEST-match; plus
  CSS wayfinding (selected accent bar, active parent-section, selected-link colour).
- **False "Saved locally"**: autosave armed a 30s server POST on mount with no dirty
  check. Fix: a `canServerSave` gate (party set OR >=1 line); header shows a neutral
  "Draft" until there's real content.

### B. Sales menu naming + i18n

- New `navigation.salesItems.*` keys in all 4 locales (en/gu/gu-en/hi-en). Renames:
  Sale Orders -> Sales Orders, Proforma Invoice -> Proforma Invoices, Recurring ->
  Recurring Invoices. Sidebar children use `t()` not hardcoded strings.

### C. Tax Invoice creator redesign (the bulk of the session)

- 9-tab editor -> single document layout -> then a **two-column layout** (main + sticky
  Invoice Summary rail) matching the owner's reference.
- New **InvoiceSummaryRail** (subtotal/discount/taxable + **rate-wise GST breakdown** +
  round-off toggle + grand total band).
- **Header**: matched the Tax Invoices LIST page (title at left edge, no back-button
  indent, no custom cream wrapper) + a right action bar (Draft pill + Preview + Save
  Draft Ctrl+S + Save & Post Ctrl+Enter).
- **Bill-to section**: left/right split with divider; rich party card (gradient avatar,
  verified badge, GSTIN chip, dashed divider, Balance due / Credit limit); intra/inter
  "why this tax" callout; right-side 2-up meta grid; header subtitle.
- **Vertical form labels** (no colons) per the Team/Salary convention; **DsCard** tokens.
- Removed stubs (TaxSummaryTab/ShippingTab/NotesTab, the dead VoucherEditorTabs.tsx);
  **wired** Additional Charges + Internal notes; moved e-Invoice/e-Way/Activity to an
  edit-mode-only "Document & history" section.
- The 4 sibling voucher types (quotation/order/proforma/delivery-challan) share this
  editor, so they inherited the new UI automatically.

### D. Strategy (PM deliverables)

- Ran a competitive deep-research (Zoho/QuickBooks/Xero/Vyapar/Tally/Refrens/ClearOne...)
  and a code-audit of our finance module (~179 pages, 14 sub-modules).
- Wrote the roadmap + the program plan (dependencies, waves, per-module lifecycle, agent
  orchestration). Headline: we are a MATURE suite already ahead of QB/Xero on GST; the
  work is correctness + closing real gaps + the automation/UX layer, not a rebuild.

---

## 3. Where everything is stored

### Code changed (crewroster-web, uncommitted on main)

- `components/layout/Sidebar.tsx` - salesItemKeys + longest-match + i18n menu labels
- `app/globals.css` - sidebar active-state CSS (accent bar, parent section, link colour)
- `hooks/useDraftAutosave.ts` - `canServerSave` dirty gate
- `components/finance/sales/VoucherEditor.tsx` - the redesign (heavy)
- `components/finance/sales/VoucherEditorHeader.tsx` - title + status pill + action bar
- `components/finance/sales/LineItemsTable.tsx` - Taxable col, combined GST col, footer
- `components/finance/sales/InvoiceSummaryRail.tsx` - NEW (summary rail + GST breakdown)
- `app/messages/en.json`, `gu.json`, `gu-en.json`, `hi-en.json` - salesItems keys
- DELETED: `components/finance/sales/VoucherEditorTabs.tsx` (dead after redesign)

### Docs (crewroster-web/docs/superpowers/specs/)

- `2026-06-05-billing-sales-invoice-creator-redesign-design.md` - the invoice redesign spec
- `2026-06-06-billing-accounts-competitive-roadmap.md` - competitive analysis + phases
- `2026-06-06-billing-accounts-program-plan.md` - dependencies + waves + SDLC + orchestration
- `2026-06-06-billing-accounts-SESSION-HANDOFF.md` - THIS file

### Memory (cross-session)

- `~/.claude/projects/D--Work-Projects-Personal-zari360/memory/project_finance_billing_initiative.md`
  - updated with the 2026-06-06 session entry (bug fixes, menu, invoice redesign, reference
    match, and the roadmap/program-plan).

---

## 4. Status / verification checklist (owner to do)

- [ ] Browser-test `/sales/invoices/new`: active menu highlights; new invoice shows
      "Draft" (no false "Saved locally", no empty POST); add party + line -> totals +
      rate-wise GST update; Save & Post works end to end.
- [ ] Glance at the 4 sibling docs (quotation/order/proforma/challan) - they changed too.
- [ ] Native review of gu / gu-en / hi-en menu labels.
- [ ] Stage + commit (assistant ran no git).

---

## 5. Still open / missing / not done

- **Phase 0 correctness fixes NOT started** (backend wrong-number bugs: hardcoded Gujarat
  state in tax preview + expense form, P&L closing-stock = 0, payment-allocation race,
  Trial-Balance Dr=Cr gate, GSTR-3B RCM filter, etc.). This is the recommended next code.
- **Shipping/transport form**: intentionally dropped (was an unwired stub); needs the
  backend shipping/transport contract = a separate slice.
- **Recurring + Credit Notes** editors use different components - not yet aligned.
- **Owner decisions still open**: OCR provider; payment gateway + who provisions
  credentials; primary buyer (owner vs CA).
- **Not browser-verified by assistant** (no access to the authenticated app).
- Sales LIST pages and the other Billing & Accounts areas not yet polished.

## 6. Guardrails honored

- Zero git by the assistant (owner stages + commits).
- No live money movement.
- Logical/schema/permission changes surfaced for approval.
- No em-dashes; 4-locale i18n; cr- design tokens; AntD v6 conventions.
