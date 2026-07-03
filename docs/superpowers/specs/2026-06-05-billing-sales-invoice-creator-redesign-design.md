# Billing & Accounts -> Sales: invoice-creator redesign + nav fixes

Date: 2026-06-05
Owner-approved scope: "Invoice creator first" + "build all of it" (full scope, owner tests at end).
Surface: zari360 ERP web (crewroster-web), branch `main`. UI-only. No schema / permission / post-behaviour change.

## Goal

Make the Billing & Accounts -> Sales area, starting with the Tax Invoice creator,
the simplest, fastest, best-in-industry billing surface. Fix two confirmed bugs that
make the area feel broken, clean up the Sales menu naming, and replace the 9-tab
invoice editor with a single-screen document layout.

## Research synthesis (what best-in-class billing tools do)

Sources: Zoho Books/Invoice, Vyapar, Refrens, myBillBook, Tally Prime, Razorpay,
Stripe Invoicing, QuickBooks. (Automated verification in the research run failed at the
voting step; the underlying claims are from official docs and match the codebase.)

- One screen, not tabs. The invoice IS its line items. Vyapar pitches it as 3 steps:
  pick party, add items, done (<20s). Stripe/QuickBooks use a single document page.
- Never ask the user to choose the tax type. CGST/SGST vs IGST is auto-derived from
  place-of-supply (party state vs seller state). zari360 already does this correctly.
- HSN / rate / GST auto-fill from the item master. zari360 already does this.
- Minimal line grid (Refrens: Item, Qty, Rate, Amount primary; rest optional/inline).
- Inline lookup-or-create for the customer (Stripe, Razorpay). zari360 already does this.
- Draft-then-finalise lifecycle; editable while draft, locked on post. zari360 mirrors this.
- Live totals always visible.

Conclusion: the engine is already strong. The 9-tab shell is the problem. This is a
re-layout, not a rebuild -> low risk.

## Bug 1 - Sales/finance menu items never highlight (active state)

Root cause (verified in `components/layout/Sidebar.tsx`):

- `allItemKeys` contains a broad `'/dashboard/finance'` entry (line ~429) but does NOT
  contain the firm-scoped Sales child keys (`.../sales/invoices`, `/quotations`,
  `/orders`, `/proforma`, `/delivery-challans`, `/recurring`, `/returns/credit-notes`).
- `activeKey` uses FIRST `startsWith` match. On `/sales/invoices/new` the broad
  `'/dashboard/finance'` matches first -> `activeKey = '/dashboard/finance'`, which is
  NOT a menu item key -> nothing highlights. The same catch-all shadows inventory /
  manufacturing / job-work / GST (their keys sit after it and are never reached).
- The CSS (`globals.css` :590-596, tokens `--cr-sidebar-active-bg/-fg` defined at
  :219-220) is correct and not the cause.

Fix:

1. Add a `salesItemKeys` array (all 7 Sales child keys) and spread it into `allItemKeys`.
2. Change the matcher from first-match to LONGEST (most specific) match, so a specific
   `.../sales/invoices` key beats the generic `/dashboard/finance`. This also restores
   highlighting for inventory/manufacturing/job-work/GST.
3. Enhancement (wayfinding): give the active parent submenu titles (Billing & Accounts,
   Sales) a visible active treatment, and add a left accent bar to the selected child.

Success: navigating to any `/sales/*` route highlights the correct child AND marks the
Sales + Billing & Accounts sections as active. Same for the other finance sections.

## Bug 2 - "Saved locally" appears with zero edits

Root cause (verified in `hooks/useDraftAutosave.ts`):

- The effect (lines 91-105) arms a 30s server-save timer on mount with no dirty check.
- On a pristine new invoice the timer POSTs an empty draft; the server rejects it;
  `performServerSave` catch sets `status='offline'` -> header shows "Saved locally".

Fix:

1. Add a dirty/min-content gate: the server-save timer only arms once the form is
   genuinely dirty (party chosen OR at least one line item). IndexedDB local save may
   still run (harmless), but no empty server POST fires.
2. Status semantics for a new, untouched invoice: show a neutral "Draft" label, never
   "Saved locally". Reserve "Saved locally" for a real offline/unreachable case AFTER a
   genuine edit.

Success: opening a new invoice and touching nothing shows "Draft" and fires no server
POST. After a real edit, normal Saving/Saved/offline semantics apply.

## Menu naming (Sales submenu) + i18n

Move the 7 hardcoded English child labels to i18n keys under
`navigation.billing.sales.*` in all four locales (en, gu, gu-en, hi-en). Renames:

| Current                                                   | New                |
| --------------------------------------------------------- | ------------------ |
| Sale Orders                                               | Sales Orders       |
| Proforma Invoice                                          | Proforma Invoices  |
| Recurring                                                 | Recurring Invoices |
| Tax Invoices, Quotations, Delivery Challans, Credit Notes | unchanged          |

## Invoice creator redesign (single screen)

Replace the 9-tab `VoucherEditorTabs` shell with a single scrolling, document-style
page (centered, max ~1100px). The shared `VoucherEditor` still serves all 5 voucher
types and both new/edit modes; per-type conditionals are preserved.

Zones (top to bottom):

1. Bill-to + meta card: Party picker (primary, inline add) that collapses to a compact
   party chip once chosen (name, GSTIN, state, change). Right: Voucher Date, Payment
   Terms, number shown as "Auto until posted". Place of Supply auto-derived from the
   party, shown as a small derived chip with an "edit to override" affordance (no big
   always-open dropdown).
2. Items (hero): the existing `LineItemsTable`, full width, lands focused on an empty
   row. "Add charge / discount" wired inline -> removes the stub Additional Charges tab.
3. Summary + options: sticky totals card on the right (replaces BOTH the Tax Summary tab
   AND the standalone footer). On the left, a collapsed "More options" holding the rare
   fields: Reverse charge (RCM), Bill of Supply, Issued-under-GSTIN, document Notes,
   Shipping.

Removed from the create form: e-Invoice / e-Way Bill / Activity (post-invoice concerns,
empty while drafting). They re-appear as a compact secondary strip only in edit mode on
a posted invoice (no feature loss). Notes de-duplicated (was in Info AND a Notes tab).

Visual quality: apply frontend-design / open-design motivation, cr- design tokens,
WCAG AA, keyboard nav (existing Alt+N add row, Ctrl+S save, Ctrl+Enter post preserved),
empty/loading/error states, four-locale i18n.

## Non-goals (this pass)

- The other 6 sales list pages and their own polish (follow-up pass; they inherit the
  shared editor automatically).
- Any change to tax computation, posting, RBAC, or schema.

## Verification

- Web: `npm run lint` on changed files + `next build`/tsc clean (no whole-project tsc per
  resource memory).
- Manual in-browser at the owner's localhost:3001: active highlight on /sales/\* routes;
  new invoice shows "Draft" and fires no server POST until edited; single-screen editor
  creates + posts an invoice end-to-end.
