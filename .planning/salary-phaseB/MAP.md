# Salary Module Phase B Polish - Wave 0 MAP

Generated: 2026-05-30. Read-only analysis. No code changed.

---

## 1. Web Surface Inventory

### Routes under `app/dashboard/salary/`

| Route                           | File                   | LOC  | Notes                                            |
| ------------------------------- | ---------------------- | ---- | ------------------------------------------------ |
| `/dashboard/salary` (overview)  | `page.tsx`             | 1027 | Large orchestrator; MySalary + manager dashboard |
| `/dashboard/salary/run-payroll` | `run-payroll/page.tsx` | 1    | Re-export shim -> `RunPayrollPage.tsx`           |
| `/dashboard/salary/payments`    | `payments/page.tsx`    | 622  | Payment register                                 |
| `/dashboard/salary/tds`         | `tds/page.tsx`         | 1245 | TDS challans, Form 16, declarations              |
| `/dashboard/salary/settings`    | `settings/page.tsx`    | 1597 | Payroll config, component templates              |
| Layout wrapper                  | `layout.tsx`           | 10   | Renders `SalaryWorkspaceNav` + children          |

**Flag - RunPayrollPage.tsx is 3049 LOC**, lives at `app/dashboard/salary/RunPayrollPage.tsx` (not under a sub-route folder), exported via the run-payroll page shim.

### Components under `app/dashboard/salary/components/salary/`

| Component                    | LOC  | Purpose                                                                                   |
| ---------------------------- | ---- | ----------------------------------------------------------------------------------------- |
| `SalaryPageHeader.tsx`       | 1234 | Master payroll run header: month nav, status badges, bulk actions, export, email dispatch |
| `SetSalaryModal.tsx`         | 1208 | Set/edit base salary modal (monthly/hourly/piece-rate)                                    |
| `MonthTransactionsModal.tsx` | 807  | All transactions for a month per member                                                   |
| `AdjustmentDrawer.tsx`       | 714  | Create/view salary adjustments drawer                                                     |
| `ComplianceExportModal.tsx`  | 630  | PF/ESI/PT export modal                                                                    |
| `FullHistoryDrawer.tsx`      | 608  | Full payment + adjustment ledger drawer                                                   |
| `FnfSettlementModal.tsx`     | 612  | Full & Final settlement modal                                                             |
| `MonthDetailDrawer.tsx`      | 500  | Month detail breakdown drawer                                                             |
| `BulkPaymentModal.tsx`       | 499  | Bulk payment recording modal                                                              |
| `TransactionDetailModal.tsx` | 366  | Single transaction detail modal                                                           |
| `TaxDeclarationModal.tsx`    | 326  | Tax declaration form modal                                                                |
| `BulkEmailProgressModal.tsx` | 260  | Async bulk payslip email progress                                                         |
| `SalaryWorkspaceNav.tsx`     | 136  | Tab nav bar (Overview/Run Payroll/Payments/TDS/Settings)                                  |
| `SalarySummaryCards.tsx`     | 103  | Summary stat tiles for payroll overview                                                   |
| `ReversePaymentModal.tsx`    | 87   | Reverse a payment modal                                                                   |
| `AdvanceTargetSelector.tsx`  | 71   | Advance deduction target picker                                                           |
| `CreateBankAccountModal.tsx` | 67   | Create bank account modal                                                                 |
| `ReverseAdjustmentModal.tsx` | 67   | Reverse an adjustment modal                                                               |
| `PayDrawer.tsx`              | 901  | Record payment drawer (UPI/cash/bank)                                                     |

### Shared components

| Path                                                   | LOC | Purpose                               |
| ------------------------------------------------------ | --- | ------------------------------------- |
| `components/dashboard/salary/MySalary.tsx`             | 243 | Self-scoped worker salary view        |
| `components/dashboard/salary/BankFilePreviewModal.tsx` | 320 | Bank file preview before download     |
| `components/dashboard/salary/BankFileModal.tsx`        | 115 | Bank file format picker modal         |
| `components/dashboard/salary/BankFileButton.tsx`       | 34  | Trigger button for bank file download |
| `components/salary/PieceRatePreviewDrawer.tsx`         | 197 | Piece-rate calculation preview drawer |

Also affected (found by hardcoded string scan):

- `components/dashboard/SalaryIncrementDrawer.tsx` (11 findings)
- `components/dashboard/SalaryIncrementModal.tsx` (11 findings)

### Non-TSX files in salary route

- `hooks/`: `useAdjustmentActions.ts`, `useLedgerData.ts`, `usePaymentActions.ts`, `usePayslipActions.ts`, `useSetSalaryActions.ts`, `useSalaryData.ts`
- `store/useSalaryPageStore.ts`
- `types/salary-page.types.ts`
- `constants/salary-page.constants.ts`
- `utils/payroll-route.utils.ts`, `utils/salary-page.utils.ts`

---

## 2. Page-Header Coverage + loading.tsx

### DsPageHeader usage

| Surface                                                  | DsPageHeader? | Header pattern used                                                 |
| -------------------------------------------------------- | ------------- | ------------------------------------------------------------------- |
| `app/dashboard/salary/page.tsx`                          | NO            | Raw `<div>` / recharts card layout; no canonical page header        |
| `app/dashboard/salary/run-payroll/` (RunPayrollPage.tsx) | NO            | Has `<h1 className="sr-only">Run Payroll</h1>` only                 |
| `app/dashboard/salary/payments/page.tsx`                 | NO            | Raw heading inside table card                                       |
| `app/dashboard/salary/tds/page.tsx`                      | NO            | Raw heading in card                                                 |
| `app/dashboard/salary/settings/page.tsx`                 | NO            | Raw heading in card                                                 |
| `SalaryWorkspaceNav.tsx`                                 | NO            | Custom nav bar with raw `<p>` heading                               |
| `components/dashboard/salary/MySalary.tsx`               | YES           | Line 159: `<DsPageHeader title={t('title')} sub={t('subtitle')} />` |

**Finding:** MySalary.tsx is the only salary surface using `DsPageHeader`. All manager-facing salary pages use custom raw headers. The nav bar itself renders a title block inline. The `SalaryPageHeader.tsx` component (1234 LOC) is a bespoke orchestrator, not a DsPageHeader wrapper.

### loading.tsx presence

Checked all routes under `app/dashboard/salary/`:

| Route folder                        | loading.tsx |
| ----------------------------------- | ----------- |
| `app/dashboard/salary/`             | MISSING     |
| `app/dashboard/salary/run-payroll/` | MISSING     |
| `app/dashboard/salary/payments/`    | MISSING     |
| `app/dashboard/salary/tds/`         | MISSING     |
| `app/dashboard/salary/settings/`    | MISSING     |

**All 5 salary routes lack loading.tsx.** The layout uses 'use client' components so Next.js suspense boundaries are not auto-generated.

---

## 3. i18n Debt (Hardcoded String Counts + Examples)

Script: `pnpm detect:hardcoded-i18n -- --json` (exits 0, informational mode).

**Total salary-scope findings: 409 across 30 files.**

### Per-file counts (top 15)

| File                                                               | Findings |
| ------------------------------------------------------------------ | -------- |
| `app/dashboard/salary/tds/page.tsx`                                | 48       |
| `app/dashboard/salary/settings/page.tsx`                           | 47       |
| `app/dashboard/salary/components/salary/PayDrawer.tsx`             | 44       |
| `app/dashboard/salary/components/salary/SalaryPageHeader.tsx`      | 34       |
| `app/dashboard/salary/components/salary/SetSalaryModal.tsx`        | 34       |
| `app/dashboard/salary/components/salary/AdjustmentDrawer.tsx`      | 23       |
| `app/dashboard/salary/components/salary/BulkPaymentModal.tsx`      | 22       |
| `app/dashboard/salary/components/salary/ComplianceExportModal.tsx` | 22       |
| `app/dashboard/salary/components/salary/FnfSettlementModal.tsx`    | 21       |
| `app/dashboard/salary/components/salary/TaxDeclarationModal.tsx`   | 18       |
| `app/dashboard/salary/page.tsx`                                    | 15       |
| `components/dashboard/SalaryIncrementDrawer.tsx`                   | 11       |
| `components/dashboard/SalaryIncrementModal.tsx`                    | 11       |
| `app/dashboard/salary/payments/page.tsx`                           | 11       |
| `app/dashboard/salary/components/salary/FullHistoryDrawer.tsx`     | 7        |

### Representative examples (file:line kind "string")

```
app/dashboard/salary/components/salary/AdjustmentDrawer.tsx:144 [jsx-text] "Not Generated Yet"
app/dashboard/salary/components/salary/AdjustmentDrawer.tsx:157 [jsx-text] "Monthly base salary"
app/dashboard/salary/components/salary/AdjustmentDrawer.tsx:163 [jsx-text] "Earned from attendance"
app/dashboard/salary/components/salary/AdjustmentDrawer.tsx:289 [jsx-text] "Add Adjustment"
app/dashboard/salary/components/salary/AdjustmentDrawer.tsx:296 [jsx-text] "Locked"
app/dashboard/salary/components/salary/PayDrawer.tsx:419 [jsx-text] "Not generated yet"
app/dashboard/salary/components/salary/PayDrawer.tsx:462 [jsx-text] "UPI Payment Available"
app/dashboard/salary/components/salary/PayDrawer.tsx:917 [jsx-text] "Attach Proof"
app/dashboard/salary/components/salary/PayDrawer.tsx:324 [title] "Record Payment"
app/dashboard/salary/components/salary/PayDrawer.tsx:458 [alt] "UPI QR"
```

**All 409 findings require `t()` wrapping. Gujarati (`gu`/`gu-en`) and Hindi (`hi-en`) message keys needed for every unique string.**

Note: `SalaryWorkspaceNav.tsx:98/105` renders hardcoded `"Salary & Payroll"` heading and subtitle as raw `<p>` text - those are in the nav, not caught by the per-component counts above (they appeared in the 2-finding count for that file).

---

## 4. Raw Design Token Hotspots

`grep var(--cr-` counts across all salary files. **Total: 430 occurrences across 22 files.**

### Per-file counts (all files with hits)

| File                                                                | Count |
| ------------------------------------------------------------------- | ----- |
| `app/dashboard/salary/RunPayrollPage.tsx`                           | 35    |
| `app/dashboard/salary/tds/page.tsx`                                 | 17    |
| `app/dashboard/salary/components/salary/PayDrawer.tsx`              | 30    |
| `app/dashboard/salary/components/salary/MonthDetailDrawer.tsx`      | 33    |
| `app/dashboard/salary/components/salary/SalaryPageHeader.tsx`       | 24    |
| `app/dashboard/salary/components/salary/BulkEmailProgressModal.tsx` | 10    |
| `app/dashboard/salary/settings/page.tsx`                            | 2     |
| `app/dashboard/salary/components/salary/FullHistoryDrawer.tsx`      | 33    |
| `app/dashboard/salary/components/salary/MonthTransactionsModal.tsx` | 50    |
| `app/dashboard/salary/components/salary/ReverseAdjustmentModal.tsx` | 1     |
| `app/dashboard/salary/components/salary/FnfSettlementModal.tsx`     | 6     |
| `app/dashboard/salary/components/salary/AdvanceTargetSelector.tsx`  | 6     |
| `app/dashboard/salary/components/salary/AdjustmentDrawer.tsx`       | 43    |
| `app/dashboard/salary/components/salary/TransactionDetailModal.tsx` | 24    |
| `app/dashboard/salary/components/salary/SetSalaryModal.tsx`         | 15    |
| `app/dashboard/salary/components/salary/SalaryWorkspaceNav.tsx`     | 7     |
| `app/dashboard/salary/payments/page.tsx`                            | 32    |
| `app/dashboard/salary/components/salary/ReversePaymentModal.tsx`    | 3     |
| `app/dashboard/salary/page.tsx`                                     | 46    |
| `app/dashboard/salary/components/salary/SalarySummaryCards.tsx`     | 4     |
| `components/dashboard/salary/MySalary.tsx`                          | 5     |
| `components/dashboard/salary/BankFilePreviewModal.tsx`              | 4     |

### Top 5 files by count

1. `MonthTransactionsModal.tsx` - 50
2. `page.tsx` (overview) - 46
3. `AdjustmentDrawer.tsx` - 43
4. `RunPayrollPage.tsx` - 35
5. `FullHistoryDrawer.tsx` - 33

These are the primary tokenization candidates for Wave 2. The token usages are inline `style={}` blocks; candidates for migration to Tailwind utility classes or semantic token aliases where a design system class already exists.

---

## 5. AntD v5 Deprecation Pre-flight

Pattern checked: `<Alert[^>]*message=`, `<TabPane`, `Tabs.TabPane`, `Collapse.Panel`, `<Panel\b`, `overlay={`, `<Modal[^>]*visible=`, `<Drawer[^>]*visible=`

**Result: ZERO hits in all salary files** (`app/dashboard/salary/**` and `components/dashboard/salary/**`).

The salary module is clean of known AntD v4 deprecated forms. No deprecation fixes required in this polish pass.

---

## 6. Accessibility Flags

### Icon-only buttons without aria-label

`<Button icon=` occurrences: **10 across 6 files**.

Reviewed each:

| File:line                        | Button content                                    | aria-label?                        |
| -------------------------------- | ------------------------------------------------- | ---------------------------------- |
| `tds/page.tsx:686`               | `icon={<EditOutlined />}` + "Edit" text child     | Text present - OK                  |
| `tds/page.tsx:693`               | `icon={<DeleteOutlined />}` + "Delete" text child | Text present - OK                  |
| `tds/page.tsx:1022`              | `icon={<PlusOutlined />}` + text child            | Text present - OK                  |
| `settings/page.tsx:1540`         | `icon={<PlusOutlined />}` + text child            | Text present - OK                  |
| `payments/page.tsx:451`          | `icon={<ReloadOutlined />}` + text child          | Text present - OK                  |
| `SalaryPageHeader.tsx:840`       | `icon={<RightOutlined />}` - icon only            | **aria-label="Next month" - OK**   |
| `SalaryPageHeader.tsx:965`       | `icon={<MoreOutlined />}` - icon only             | **aria-label="More actions" - OK** |
| `SalaryPageHeader.tsx:970`       | `icon={<ReloadOutlined />}` - icon only           | **aria-label="Refresh" - OK**      |
| `PayDrawer.tsx:896`              | `icon={<PlusOutlined />}` + "mb-4" text sibling   | Text child present - OK            |
| `BulkEmailProgressModal.tsx:155` | `icon={<StopOutlined />}` + text child            | Text present - OK                  |

**Finding: All icon buttons are accessible.** The 3 icon-only buttons in `SalaryPageHeader.tsx` all have `aria-label`. No violations found.

Note: `RunPayrollPage.tsx:2760` has `<h1 className="sr-only">Run Payroll</h1>` - visually hidden heading present. Good pattern.

### `<img>` usage (should be `next/image`)

3 `<img>` elements found:

| File:line                        | Purpose                                                            |
| -------------------------------- | ------------------------------------------------------------------ |
| `PayDrawer.tsx:453`              | UPI QR code display (`src={upiDetails.qrCodeUrl}`, `alt="UPI QR"`) |
| `MonthTransactionsModal.tsx:617` | Payment proof image thumbnail (`alt="Proof N"`)                    |
| `MonthTransactionsModal.tsx:703` | Payment proof image thumbnail (same pattern)                       |

**All 3 should be migrated to `next/image` with appropriate `width`/`height` or `fill` props.**

### Additional a11y notes

- `aria-label` count across salary files: 26 occurrences across 7 files - coverage is reasonable.
- `SalaryWorkspaceNav.tsx` nav links render with `Link` (no `aria-current` for active state).
- The nav bar container has no `<nav role="navigation">` landmark.

---

## 7. BE Observability Baseline

Files checked: `salary.service.ts` (7472 LOC), `salary.controller.ts` (981 LOC).

| Signal                            | Present?          | Evidence                                                                                     |
| --------------------------------- | ----------------- | -------------------------------------------------------------------------------------------- |
| OTel `tracer` / `startActiveSpan` | **NO**            | Zero matches in both files                                                                   |
| `withSalarySpan` helper           | **NO**            | Not defined anywhere in salary module                                                        |
| PostHog `PostHogService` / events | **NO**            | Zero matches in both files                                                                   |
| Sentry `captureException`         | **NO**            | Zero matches in both files                                                                   |
| `AuditService.logEvent`           | **YES (partial)** | 9 call-sites in service (lines ~1640, 1699, 4006, 4414, 4535, 4767, 4933, 4970, 5013)        |
| `Logger` (NestJS structured)      | **YES**           | `private readonly logger = new Logger(SalaryController.name)` + several `logger.log()` calls |

**Gap summary:** Salary is one of the most write-heavy modules (62 endpoints, payroll generates, locks, payments, adjustments, FnF, TDS) but has zero OTel spans, zero PostHog events, and zero Sentry error captures. Audit logging exists but covers only ~9 of the ~30+ mutating operations. Pilot pattern: `auth.service.ts` (`withAuthSpan` helper + 10 events), `team.service.ts` (`withTeamSpan` + 11 events), `workspaces.service.ts` (`withWorkspaceSpan` + 12 events).

Recommended additions per CLAUDE.md conventions:

- `withSalarySpan(name, fn)` helper (mirrors `withTeamSpan` pattern)
- OTel spans on: `generatePayroll`, `setBasePay`, `recordPayment`, `recordBulkPayment`, `createAdjustment`, `reverseAdjustment`, `reversePayment`, `initiateFnf`, `finaliseFnf`, `lockSalaryRecord`, `unlockSalaryRecord`, `sendPayslipEmail`
- PostHog events (writes only): `salary.payroll_generated`, `salary.payslip_emailed_bulk`, `salary.payment_recorded`, `salary.base_pay_set`, `salary.adjustment_created`, `salary.fnf_initiated`, `salary.fnf_finalised`
- Sentry `captureException` on critical catches (payroll generation, email dispatch, FnF)
- Audit log gaps: `setBasePay`, `recordBulkPayment`, `generatePayroll`, `lockSalaryRecord`, `unlockSalaryRecord`, `sendPayslipEmail` (each currently uninstrumented)

---

## 8. BE Endpoint Hygiene Baseline

Controller: `salary.controller.ts`. Total routes: **62 endpoints**.

Class-level guards: `@UseGuards(JwtAuthGuard, RolesGuard, SubscriptionGuard)` - applied to all routes.

### Spot-check findings (6 routes)

| Route                            | RequireSubscription      | Throttler | DTO validation                            | Swagger |
| -------------------------------- | ------------------------ | --------- | ----------------------------------------- | ------- |
| `POST generate` (L210)           | YES - `generate_payroll` | NO        | Query params only, no DTO                 | NO      |
| `PATCH set-base-pay` (L485)      | YES - `edit_salary`      | NO        | `SetBasePayBodyDto` (class-validator)     | NO      |
| `POST payments` (L590)           | YES - `record_payment`   | NO        | `RecordPaymentDto` (class-validator)      | NO      |
| `POST payments/bulk` (L604)      | YES - `bulk_payments`    | NO        | `BulkRecordPaymentDto` (class-validator)  | NO      |
| `GET payments/register` (L624)   | NO                       | NO        | `GetPaymentRegisterDto` (class-validator) | NO      |
| `GET monthly-task-status` (L711) | NO                       | NO        | Query params inline (no DTO)              | NO      |

### General state

- **RequireSubscription**: Present on most write endpoints and compliance/sensitive reads. Absent on some GET-only reads (`payments/register`, `monthly-task-status`, `by-shift-summary`, `advances/:teamMemberId`, `history/*`).
- **Throttler**: **Zero `@Throttle` decorators across all 62 routes.** Write endpoints (recordPayment, generatePayroll, bulk operations) are unthrottled. Per CLAUDE.md, write endpoints require a throttler tier.
- **DTO validation**: Mixed. Most writes use class-validator DTOs (good). Several bodies use plain inline type aliases (`EnsureSalaryRecordBody`, `SendPayslipEmailBody`, `TriggerBulkEmailBody`, `InitiateFnfBody`) with manual `BadRequestException` guards instead of proper class-validator DTOs.
- **Swagger**: **Zero `@ApiTags` / `@ApiOperation` / `@ApiBearerAuth` decorators** anywhere in the salary controller. Swagger docs are entirely absent for this module.

---

## WAVE INPUTS

### Wave 1 - i18n sweep (409 findings)

- Wrap all 409 hardcoded strings in `t()` calls across 30 files.
- Priority order: `tds/page.tsx` (48), `settings/page.tsx` (47), `PayDrawer.tsx` (44), `SalaryPageHeader.tsx` (34), `SetSalaryModal.tsx` (34), `AdjustmentDrawer.tsx` (23).
- Add message keys to `messages/en.json` (and stubs in `gu.json`, `gu-en.json`, `hi-en.json`).
- Include `SalaryWorkspaceNav.tsx` hardcoded nav labels (`"Overview"`, `"Run Payroll"`, `"Payments"`, `"TDS"`, `"Settings"`, `"Salary & Payroll"` heading + subtitle).
- Include `SalaryIncrementDrawer.tsx` and `SalaryIncrementModal.tsx` (11 each).
- Replace `alt="UPI QR"` and `alt="Proof N"` (img tags) with translated strings while fixing to `next/image`.

### Wave 2 - Visual / token polish

- Migrate 430 `var(--cr-*)` inline `style={}` usages to Tailwind utility classes or semantic design-system tokens.
- Top 5 targets: `MonthTransactionsModal.tsx` (50), overview `page.tsx` (46), `AdjustmentDrawer.tsx` (43), `RunPayrollPage.tsx` (35), `FullHistoryDrawer.tsx` (33).
- Add `DsPageHeader` to all 5 manager-facing salary route pages (currently none use it).
- Add `loading.tsx` to all 5 route folders (`/salary/`, `/run-payroll/`, `/payments/`, `/tds/`, `/settings/`).
- Replace the 3 raw `<img>` elements with `next/image` (`PayDrawer.tsx:453`, `MonthTransactionsModal.tsx:617/703`).
- Add `<nav>` landmark + `aria-current="page"` to `SalaryWorkspaceNav.tsx`.

### Wave 3 - a11y sweep

- Add `<nav role="navigation" aria-label="Salary sections">` wrapper to `SalaryWorkspaceNav.tsx`.
- Add `aria-current="page"` to active nav link in `SalaryWorkspaceNav.tsx`.
- Audit all modal `<Dialog>`/AntD Modal `title` props for screen-reader correctness (spot-check `MonthDetailDrawer`, `FullHistoryDrawer`, `FnfSettlementModal`).
- Keyboard-navigation audit for the `RunPayrollPage.tsx` table action column and bulk-select flow.
- Verify `SalarySummaryCards.tsx` stat tiles use semantic headings or `role="figure"`.

### Wave 4 - Subscription gates

- Audit all 5 route pages for `useSalaryFeatures()` / `<Can>` gating: confirm each premium action (compliance exports, FnF, TDS, piece-rate, payslip email) is hidden/disabled when entitlement is absent.
- Spot-check `tds/page.tsx` and `settings/page.tsx` for any UI that renders without a feature gate.
- Verify `SalaryWorkspaceNav.tsx` TDS tab correctly hides when `tdsManagement.enabled` is false (existing `featureKey` filter - verify it works for all subscription tiers).

### Wave 5 - BE observability

- Add `withSalarySpan` helper to `salary.service.ts` (copy `withTeamSpan` pattern from `team.service.ts`).
- Wrap 12 key service methods with OTel spans: `generatePayroll`, `setBasePay`, `recordPayment`, `recordBulkPayment`, `createAdjustment`, `reverseAdjustment`, `reversePayment`, `initiateFnf`, `finaliseFnf`, `lockSalaryRecord`, `unlockSalaryRecord`, `sendPayslipEmail`.
- Add PostHog events for 7 write flows: `salary.payroll_generated`, `salary.payment_recorded`, `salary.base_pay_set`, `salary.adjustment_created`, `salary.fnf_initiated`, `salary.fnf_finalised`, `salary.payslip_emailed_bulk`.
- Add `Sentry.captureException` in catch blocks for `generatePayroll`, `triggerBulkPayslipEmails`, `initiateFnf`.
- Fill 6 audit log gaps: `setBasePay`, `recordBulkPayment`, `generatePayroll`, `lockSalaryRecord`, `unlockSalaryRecord`, `sendPayslipEmail`.

### Wave 6 - BE endpoint hygiene + Swagger

- Add `@Throttle` decorators to all write endpoints (mutating routes need a rate-limit tier; `recordPayment`, `recordBulkPayment`, `generatePayroll`, `sendPayslipEmail`, `triggerBulkPayslipEmails` are highest priority).
- Convert 5 plain-type inline bodies to proper class-validator DTOs: `EnsureSalaryRecordBody`, `SendPayslipEmailBody`, `SendBulkPayslipEmailsBody`, `TriggerBulkEmailBody`, `InitiateFnfBody`.
- Add `@ApiTags('salary')`, `@ApiBearerAuth()` at controller level.
- Add `@ApiOperation({ summary: '...' })` to all 62 endpoints (can be done file-scan batch).
