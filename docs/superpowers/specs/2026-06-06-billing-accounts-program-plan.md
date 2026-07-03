# Billing & Accounts: Program Plan, Dependencies & Delivery Lifecycle

Date: 2026-06-06
Companion to: `2026-06-06-billing-accounts-competitive-roadmap.md` (the why/what).
This doc = the how: dependency map, dependency-ordered waves, the per-module software/
product development lifecycle, and the agent-workflow orchestration + approval gates.

Owner direction: do all of it; find dependencies; prepare a proper plan; set up a proper
agent workflow per a real SDLC.

---

## 1. The hidden foundations (build once, reused by many)

Most features secretly depend on a few shared layers. Building these first makes every
downstream module cheaper and consistent.

| Foundation             | What it is                                                                                                                                                                | Features that depend on it                                                                |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| **F1 Correctness**     | Fix the wrong-number bugs (tax-state hardcode, P&L closing stock, payment-allocation race, TB Dr=Cr gate, GSTR-3B RCM filter, etc.)                                       | Everything (trust). Reports, GST, payments.                                               |
| **F2 Comms/Dispatch**  | Real email + WhatsApp + SMS adapters + a template engine (the reminder framework exists but adapters/templates are stubbed/locked)                                        | Invoice send, customer portal notifications, payment-link delivery, reminders, statements |
| **F3 Learning store**  | Per-party / per-item / per-vendor memory ("Field Prediction": remember last terms, rate, expense category)                                                                | Keyboard smart-defaults, OCR auto-categorization, AI categorization                       |
| **F4 Matching engine** | Generalize the existing bank-reco match (suggest + accept + buckets)                                                                                                      | GSTR-2B reconciliation, payment auto-reconcile, bank-feed categorization                  |
| **F5 Provider slots**  | Pluggable adapters for OCR + bank-feed (external, owner-gated: vendor choice + credentials). NO payment gateway - payment collection is out of scope (owner, 2026-06-06). | OCR Capture, live bank feeds (statement import for bookkeeping)                           |

---

## 2. Dependency map (what blocks what)

```
F1 Correctness ---------------------------(independent; land early, parallel)
F2 Comms/Dispatch --> Invoice send
                  --> Customer portal (notifications)
                  --> Payment links (delivery)
                  --> Reminders/statements
F3 Learning store --> Keyboard smart-defaults
                  --> OCR auto-categorization
                  --> AI categorization
F4 Matching engine --> GSTR-2B reconciliation
                   --> Payment auto-reconcile
                   --> Bank-feed categorization
F5 OCR provider    --> OCR/AI Capture
F5 Payment gateway --> Payment collection --> (auto-reconcile needs F4)
F5 Bank-feed provider --> Live bank feeds --> (categorization needs F4)
Customer portal --> (needs F2) ; payment links in portal --> (needs F5 gateway)
Multi-currency --> schema-deep, touches all money fields (do LAST)
Approval workflows --> voucher state-machine + RBAC (exists) (cross-cutting, mid)
```

---

## 3. Dependency-ordered waves (the sequence)

**Wave 1 - Foundations (parallelizable, no external deps except provider picks):**

- 1A. **F1 Correctness** sweep (backend; TDD; independent).
- 1B. **F2 Comms/Dispatch** layer (email + WhatsApp/SMS adapters + templates).
- 1C. **F3 Learning store** (smart-defaults memory service + API).
- 1D. **UX pattern bar** continue-rollout (the invoice-creator bar to siblings; frontend).
- (Owner in parallel: pick **F5** providers - OCR, payment gateway, bank-feed.)

**Wave 2 - Quick wins + the wedge (needs Wave 1):**

- 2A. **Keyboard-first + smart-defaults entry** (needs 1C, 1D) - frontend-first, ships fast.
- 2B. **Email/WhatsApp invoice send** (needs 1B) - quick perceived win, clears Wave-8 TODOs.
- 2C. **OCR/AI Capture** (needs F5 OCR + 1C) - biggest "wow"; starts once provider chosen.

**Wave 3 - Share + connected (needs Wave 1-2 + providers):**
SCOPE: NO payment collection/gateway/links (owner, 2026-06-06). Payment receipts stay
recording-only (bookkeeping). Also clean the dead Razorpay/Cashfree gateway fields.

- 3A. **Customer portal - VIEW-ONLY** (needs 1B; invoice render exists). No payment links.
- 3B. **Live bank feeds** (F5 bank provider) + rule auto-categorization (needs F4) - for
  reconciliation/bookkeeping only, not payments.

**Wave 4 - Moat + AI + breadth (needs F4 + data):**

- 4A. **GSTR-2B reconciliation** (needs F4) - high accountant value.
- 4B. **AI layer**: auto-categorization, anomaly detection, NL reports (needs 1C + LLM).
- 4C. **One-click e-documents** from an invoice (builds on existing GST).
- 4D. **Approval workflows**, **budgets/forecasting**, **multi-currency** (schema-deep; last).

Rationale: F4-matching is the gate for the highest accountant-value items (2B recon,
auto-reconcile), so it is built as soon as Wave 3 needs it. Multi-currency is last because
it mutates every money field. Correctness is first because trust underwrites everything.

---

## 4. Per-module development lifecycle (run for EVERY module)

Each module/wave-item passes through these stages. The agent/skill at each stage:

| Stage                     | Output                                                             | Agent / skill                                                                 |
| ------------------------- | ------------------------------------------------------------------ | ----------------------------------------------------------------------------- |
| 1. **Discover / Spec**    | Requirements + acceptance criteria + research recap                | brainstorming / gsd-spec-phase + the deep-research findings                   |
| 2. **Design (UI + data)** | UI-SPEC + mockups + API/data contract; flag logical/schema changes | gsd-ui-phase / frontend-design / open-design; Backend Architect for contracts |
| 3. **Plan**               | Task breakdown with dependencies + verification per task           | writing-plans / gsd-plan-phase                                                |
| 4. **Build**              | Implementation (TDD on backend; FE mirrors BE)                     | gsd-execute-phase / subagent-driven-development / test-driven-development     |
| 5. **Review**             | Code review + security + UI review                                 | requesting-code-review / gsd-code-review / Security Engineer / gsd-ui-review  |
| 6. **Verify**             | UAT vs acceptance criteria; evidence before "done"                 | gsd-verify-work / verification-before-completion                              |
| 7. **Ship**               | Owner stages + commits (we run zero git); live smoke               | owner (per feedback_no_git_ops)                                               |

Gates (owner approval required between):

- After Stage 2 (Design): owner approves the design + any logical/schema change.
- After Stage 6 (Verify): owner confirms before it counts as shipped.
  Everything inside a stage runs autonomously (per implement-full-scope-no-per-slice).

---

## 5. Agent-workflow orchestration (how we actually run it)

Two layers:

**Program layer (this plan):** the wave/dependency order above. We do NOT spawn a giant
build at once; we run one wave-item module at a time through the lifecycle, with the two
owner gates. This keeps cost controlled and the owner in the loop.

**Module layer (per item):** for each module, a Workflow can fan out the parallelizable
stages where it helps:

- Design: parallel "competitor-pattern" + "data-contract" + "edge-case" agents -> synthesize one design.
- Build: pipeline over independent sub-tasks (e.g., per-screen) with worktree isolation if they mutate shared files.
- Review: parallel dimensions (correctness / security / a11y / UI) -> adversarial verify -> only real findings.

We only launch a multi-agent Workflow when the owner has opted in for that module (cost-
aware). Default: I drive with targeted subagents + the lifecycle skills.

---

## 6. Immediate next step (proposed)

Start **Wave 1** now, because it unblocks everything and has the least external dependency:

1. **F1 Correctness**: I produce a verified, itemised fix-list (cross-checked against the
   2026-06-02 backend audit so we do not redo already-fixed items), then fix + test.
2. **Design the first Wave-2 module in parallel**: recommend **OCR/AI Capture** (owner picks
   the OCR provider) OR **Keyboard-first smart-defaults** (no external dep, fastest) - run
   it through Stage 1-2 (Spec + Design) so it is ready to build when F1 lands.

Owner decisions still open (from the roadmap doc): OCR provider, payment gateway + who
provisions credentials, primary buyer (owner vs CA). None block starting F1 Correctness.

## 7. Guardrails (unchanged)

- Assistant runs zero git; owner stages + commits.
- No live money movement by the assistant; we build flows, owner executes.
- Logical/schema/permission changes surfaced for approval (Stage-2 gate).
- Backend verify = scoped vitest + nest build (whole-project tsc/eslint OOMs).

---

## 8. Verification feedback incorporated (2026-06-06 independent audit)

An independent review (`2026-06-06-billing-accounts-VERIFICATION-REPORT.md`) validated the
shipped work and sharpened the plan. Changes adopted:

1. **Phase 0 MUST add a `computeTaxClient` <-> backend "preview == posted" parity golden
   test.** The whole "what you preview is what posts" promise rests on a byte-for-byte
   claim that is currently untested. This is now a required Phase-0 deliverable, not just
   the generic Verify stage.
2. **Phase 0 starts with a DEDUPED fix-list.** Bucket A enumerates bugs "several already
   fixed on 2026-06-04" without marking which. First Phase-0 action = cross-check against
   the 2026-06-04 session + the backend audit and produce a clean, current list before
   touching code (so we do not re-litigate closed bugs).
3. **Number-changing fixes need a recompute/backfill note for already-posted documents.**
   Any fix that alters figures on posted financial docs must state whether historical docs
   are recomputed/backfilled or left as-was-posted. Added to the Phase-0 checklist.
4. **Wave 2 leads with keyboard-first + smart-defaults** (no external dependency). OCR
   Capture is designed in parallel but does NOT lead, because it is blocked on an unmade
   OCR-vendor decision with no drop-dead date - leading with a provider-blocked item
   invites stall.
5. **F3 Learning store is flagged as a Stage-2 logical/schema change**, not foundation
   plumbing. Per-party/per-vendor "Field Prediction" memory raises multi-tenant scoping +
   data-segregation questions (the RBAC/scope surface CLAUDE.md is strict about); it goes
   through the design-approval gate.
6. **GSTR-2B reconciliation pulled earlier.** The roadmap rates it MEDIUM-HIGH ("big
   accountant value", core to the GST-powerhouse position) yet it sat in Wave 4. Its only
   hard dependency is F4 (matching engine), so F4 + GSTR-2B recon move to Wave 3.
7. **WhatsApp send is a provider-gated dependency, not just an adapter.** WhatsApp Business
   API needs provider onboarding + Meta template approval lead time - treat like the
   OCR/payment-gateway provider gates (owner-gated, lead-time risk), not a quick F2 task.
8. **Execution-vs-plan deviation acknowledged honestly:** this session shipped the UI
   redesign (cosmetics) before Phase-0 correctness, even though the plan calls correctness
   the foundation. Defensible (UI was the owner's explicit first ask and is low-risk), but
   named here so the record is accurate. Correctness is the next code task.

## 9. Audit code-fixes already applied (2026-06-06)

- **B1 (MEDIUM, real bug) FIXED:** Payment Terms wrote/read `termsDays` but the contract is
  `dueDays` -> the chosen Net-N term silently never persisted. Standardized all 4 sites in
  `VoucherEditor.tsx` to `dueDays`. Owner: smoke-test that a saved Net-30 survives a round-trip.
- **B3 (LOW) FIXED:** explicit Save Draft / Ctrl+S on a pristine empty invoice no longer fires
  a failing empty POST (new `handleSaveDraft` gate on `hasContent`).
- **B5 (nit) FIXED:** two U+2013 en-dashes in `InvoiceSummaryRail.tsx` swapped for hyphen-minus.
- **B2 (LOW UX) DEFERRED:** "Save & Post" on a brand-new invoice saves + navigates to the
  editable doc rather than posting in one click (no id to post against yet). Owner decision:
  relabel the new-draft primary, or auto-invoke post after the create resolves.
- **B4 (LOW) DEFERRED:** `?partyId=` deep link is not preselected in the editor (needs an
  initial-party prop threaded into the form; may predate the redesign).
- Pre-existing, not caused by this work (flagged for awareness): Contras menu item never
  self-highlights (key is `/contras/new`, registered key is `/contras`); static
  `notification.*`/`Modal.confirm` do not consume App/ConfigProvider theme context.

## 10. Phase 0 progress (2026-06-06)

A deduped audit of the Bucket-A correctness list against the CURRENT code found the
2026-06-04 session already fixed nearly all of it. Verified ALREADY-FIXED in code:
hardcoded firm state (tax engine takes firmStateCode as input), expense/debit-note
intra-state derivation, P&L opening/closing stock, Trial-Balance Dr=Cr hard gate at FY
close, GSTR-3B 3.1(d) RCM reverseCharge filter, payment-allocation re-validation inside
the post transaction (both receipt + payment-out), balance-sheet signed contributions,
cash-flow multi-account + non-inverted opening/closing.

DONE this session:

- **Preview == posted PARITY CONTRACT (the one genuinely-missing safety net).** Added a
  shared 7-vector canonical set asserting identical output from the web engine
  (`computeTaxClient`, lib/finance/taxComputeClient.spec.ts) and the backend engine
  (`TaxComputationService.compute`, .../tax-computation/**tests**/tax-computation.vitest.ts),
  with reciprocal "keep in sync" headers. Covers intra/inter split, 5% half-rate, cess,
  taxable freight inter-state, round-off, tax-inclusive. **Web 18/18 + backend 13/13 green.**
  Any future drift between preview and posting fails one side.
- **JV negative amounts:** the API path was ALREADY guarded (DTO `@Min(0)` on debit/credit).
  Added a defense-in-depth guard in `validateBalanced` for internal (non-DTO) callers. This
  is a behavioral validation add (rejects only already-invalid input) - flag for commit review.

RESOLVED:

- **194Q + 194C/H/J TDS deconfliction = NOT A BUG (by-design-OK, verified 2026-06-06).**
  194Q (goods, at bill-post) and 194C/H/J (services, at payment-out) are separated by
  `Party.supplierType` + distinct `TdsTracker` section keys; a vendor-line is goods XOR
  service, satisfying IT-Act 194Q(5) mutual exclusivity. Bill balance is already net of
  194Q before payment allocation (no double-count). Optional observability log suggested
  but skipped (not a fix). **=> Phase 0 is CLOSED.**

STILL-OPEN (minor, deferred):

- **GSTR-3B 3.1(a) credit-note netting:** appears fixed in code (2026-06-04); add a
  confirming golden test when next in the GST module.
- Optional JV schema `min:0` (belt over the DTO + service guards) - low value, skipped.
