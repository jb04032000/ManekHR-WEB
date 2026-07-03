# Slice 1 design - Business Identity reconciliation + Security workstream

Date: 2026-06-02
Owner mode: assistant decides + builds best-in-industry; owner tests at the end.
Companion docs: `2026-06-02-billing-accounts-module-audit.md` (full findings register).

---

## A. What the investigation found (ground truth)

Verified across web + backend (4 parallel audits):

1. **Identity is ONE data store (Firm), TWO editors.** The Firm is the source of truth
   for all tax/legal identity (firmName, gstin, additionalGstins, pan, fyStartMonth,
   accountsBooksBeginDate, aato, brandProfile, invoiceLayout). It is edited from BOTH:
   - `/dashboard/workspace` -> "Business profile" section (the richer editor:
     firmName, businessType, gstin, pan, fyStartMonth, booksBeginDate, aato, rounding,
     inventoryValuationMethod, lateFeePct, qtyDecimalPlaces, allowNegativeStock,
     qrmpScheme, defaultPrintLocale).
   - `/dashboard/finance/firms/new` -> the "Complete Business Setup" wizard (a subset).
     => Not data duplication, but a confusing two-editor UX. **Consolidate.**

2. **Address does not exist as structured data.** Workspace has only a `location`
   string; Firm has no address. BUT the invoice print themes already read
   `firm.addressLine / city / state / pincode` (e.g. `a4-theme1.ts:70`) -> invoices
   currently render a BLANK seller address. The wizard collects address/phone/email
   then drops them (off-schema + Mongoose strict). **Add structured address to Firm.**

3. **Workspace ↔ Firm = 1:1**, Firm auto-created on workspace creation (cascade seeds
   accounts, cash register, voucher series, godown, fiscal year; sets step1Done=true).
   Recovery via `POST /firms/ensure`.

4. **Multi-state GST** lives on `Firm.additionalGstins[{gstin, stateCode, label}]`,
   edited at `/dashboard/finance/firms/[firmId]/settings/gstins` (NOT in workspace
   settings). Print/e-invoice/e-way already resolve seller GSTIN from
   firm.gstin/additionalGstins. Missing: a per-registration ADDRESS (each GST
   registration is a distinct place of business with its own address).

5. **Bank is triplicated** (three distinct layers, no linkage, drift risk):
   - `workspace.bankAccounts: [{id,label}]` - labels only (payment-mode dropdowns).
   - finance `BankAccount` - real GL account (name/bankName/accountNumber/ifsc/
     opening+current balance/CoA link/reconciliation). THE accounting truth.
   - `firm.brandProfile.{bankName,bankAccountNumber,bankIfsc,upiId}` - invoice-footer
     display only.
6. **Logo is duplicated:** `workspace.branding.logo` (payslip headers, salary module)
   vs `firm.brandProfile.logoUrl` (invoice print). One company, two logo stores.

7. **Wizard save is unsafe:** `updateWizardStep` does `$set: { ...rawBody }` - drops
   off-schema fields AND is a mass-assignment hole (unlike `update()` which strips
   credential fields). Whitelist per step.

8. **Setup checklist lies:** 2/4 links are dead (`settings?tab=brand|general` don't
   exist); "address" can never go green (checks `brandProfile.address`, never written);
   "voucher series" goes green from `step3Done` (role+rounding) though series are
   auto-seeded at firm creation.

---

## B. Decisions (design-of-record)

- **D1. Firm = single source of truth for business legal/tax identity.** Workspace =
  org / people / policy container (name, members, roles, app-lock, designations,
  notifications, subscription).

- **D2. Add structured `address` + contact to Firm.** New typed fields:
  `address: { line1, line2, city, stateCode, state, pincode, country }`,
  `contactPhone`, `contactEmail`, `website`. Align print themes to read these
  (fixes blank-address invoices). Additive + optional -> no migration.

- **D3. Multi-state GST done right.** Extend each `additionalGstins` entry with
  optional `tradeName` + `address` (place of business per registration). Invoice /
  e-invoice / e-way / print resolve the SELLER address from the seller GSTIN used
  (primary -> firm.address; branch -> that registration's address). Enhance the
  `settings/gstins` editor accordingly; primary GSTIN's place of business = firm.address.

- **D4. ONE business-profile editor.** Create a canonical finance-settings
  **"Business Profile"** page (identity + address + contact + primary GSTIN + PAN +
  FY + books-begin + accounting prefs). The onboarding **wizard reuses the same form
  components** as a guided first-run, then routes to the dashboard. **Remove the
  "Business profile" section from `/dashboard/workspace`**, replaced by a short card
  that deep-links to the finance Business Profile (non-silent; preserves muscle memory).
  Keep the genuinely document-formatting finance pages separate (branding, numbering,
  invoice-layout, gstins).

- **D5. Bank: one source of truth = finance `BankAccount`.** The invoice-footer bank
  (`firm.brandProfile`) derives from a chosen BankAccount via a new
  `brandProfile.linkedBankAccountId`; `workspace.bankAccounts` labels reconcile to /
  derive from BankAccounts. (Implemented in the Bank slice; decision recorded now so
  onboarding doesn't add a 4th bank entry point.)

- **D6. Logo: `firm.brandProfile.logoUrl` is the company brand source of truth.**
  Payslips should read it; `workspace.branding.logo` deprecates. (Implemented when the
  salary/payslip surface is touched; recorded now.)

- **D7. Harden the wizard save** with a strict per-step field whitelist (security +
  persistence). No raw `$set` of the request body.

- **D8. Rewrite the setup checklist:** real done-checks (gstin, address, logo/sig,
  bank details), real leaf routes, drop the bogus voucher-series + byok-only items.

---

## C. Slice-1 execution order

1. **Firm schema**: address + contact (D2); additionalGstins tradeName+address (D3).
2. **Wizard service**: per-step whitelist (D7) so address/contact persist + no mass-assignment.
3. **Setup checklist** rewrite (D8).
4. **Print themes**: read seller address/contact from firm; branch address by seller GSTIN (D2/D3). Verify invoices render the address.
5. **Web**: shared `BusinessProfileForm` component; wizard rebuild (skeleton, validation, GSTIN-autofetch fills address, smart info icons); finance-settings Business Profile page (D4); remove workspace-settings business section -> redirect card (D4).
6. **Breadcrumb guide** for Billing & Accounts (section purpose + cross-module links).
7. **Tests** (BE): whitelist persists address/contact + ignores unknown/credential keys; checklist done-logic + routes; multi-GSTIN address resolution for print.
8. Update audit register statuses.

Defer (recorded, not in slice 1): D5 bank unification (Bank slice), D6 logo unification (Salary touch).

---

## D. Security workstream (from competitor + standards research)

Industry bar (Zoho Books / Xero / ClearTax / Razorpay): AES-256 at rest + TLS 1.2/1.3 +
**field-level encryption for the crown jewels** + ISO 27001 + SOC 2 Type II. India:
DPDP Act 2023 + Rules 2025 (we are a Data Fiduciary).

**P0 (before sensitive data scales):**

- [SEC-P0-1] Public portal tokens: opaque + store only a HASH; hard one-resource scope
  claim; expiry + revocation; rate-limit; resolve tenant/resource ONLY from the token
  record (never request input); `noindex` + `Referrer-Policy: no-referrer`. (= audit
  SEC-1; **next slice**.)
- [SEC-P0-2] Mandatory tenant filter at the data-access layer (Mongo has no RLS):
  every find/update/delete auto-scoped to `{workspaceId}`; object-level 404-on-mismatch.
- [SEC-P0-3] Field-level (envelope) encryption for stored 3rd-party credentials
  (GST portal / IRP-GSP / bank) + bank account numbers + PAN. (irp/ewb/gst already use
  `encryptSmtpPassword`; razorpay/cashfree are DEAD -> remove, not encrypt.)
- [SEC-P0-4] MFA available for all; mandatory for Owner/HR/admin roles.
- [SEC-P0-5] Immutable, append-only audit trail for every financial mutation
  (who/what/when/before->after/IP/UA).
- [SEC-P0-6] DPDP: consent/notice at collection; data-principal rights (access/
  correct/erase/grievance); 72-hour breach report to Board (+ 6-hour CERT-In);
  purpose limitation + erasure, reconciled with GST 6-year retention (anonymize PII,
  retain statutory record).

**P1:** step-up re-auth for high-risk actions (change bank/credentials, void posted
invoice, bulk export); session hardening (short access TTL + rotating refresh +
reuse-detection; you already ship `X-Permission-Version`); per-tenant rate limits;
tenant-scoped file storage w/ pre-signed URLs; cross-tenant access alerting; KMS key
rotation; **data residency in India** (Atlas Mumbai / ap-south-1); 1-year log retention;
**adopt ISO 27001 controls** (SPDI-Rules safe-harbor).

**P2:** SOC 2 Type II; quarterly VAPT + annual pen-test of the tenant boundary + portal;
PCI scope minimization (tokenize, never store card data); defense-in-depth on share
links (optional OTP/password gate, per-link access log); full helmet headers + WAF.

**P3:** ISO 27701; BYOK per enterprise tenant; hash-chained/ledger audit log.

Sources: Zoho Security FAQ, Xero Security, ClearTax Trust, Razorpay Security, OWASP
Multi-Tenant Cheat Sheet, Auth0/Curity token best-practices, AWS KMS envelope
encryption, DPDP Act 2023 + Rules 2025 (EY/KPMG/CY5), SPDI Rules 2011.
