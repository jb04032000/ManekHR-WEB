# Phase 1 module: Keyboard-first entry + Smart Defaults

Date: 2026-06-06
Lifecycle stage: Spec + Design (awaiting Stage-2 approval before build).
Why first: pure-frontend wedge (no vendor dependency), continues the invoice-creator work,
directly delivers the "super easy, least-typing" promise. Synthesizes TallyPrime's
keyboard-first voucher model + Zoho's "Field Prediction" learning defaults.

## Goal

Let a power user create and post a voucher with the keyboard alone, and make every new
voucher pre-filled with the smartest safe defaults so there is minimal typing.

## Acceptance criteria

1. A new Tax Invoice can be created and posted end-to-end **without the mouse**.
2. Opening a new invoice **pre-fills Payment terms + Place of supply** from the last one
   (per firm) and lands focus on an empty, ready-to-type line.
3. Selecting a known item auto-fills HSN / rate / GST (already true - keep).
4. Adding the same item twice surfaces a **duplicate-line hint**.
5. A discoverable **shortcuts cheat-sheet** (the header "Keyboard shortcuts" button) lists
   every shortcut.
6. (1b, gated) Re-billing a party pre-fills **that party's** last terms / POS, and a repeat
   item pre-fills the **last rate charged to that party**.

## Design

### Part 1a - Keyboard-first + in-form smart defaults (FRONTEND ONLY, no schema)

Build immediately after design approval; lives in the polish lane (no schema/behavioral-
data change).

**Keyboard model (web-adapted Tally; avoids browser/AntD conflicts):**

- Global (already present): `Alt+N` add line, `Ctrl+S` save draft, `Ctrl+Enter` post,
  `Esc` back.
- New global: `Alt+P` focus Party, `Alt+I` focus first item cell, `Alt+M` toggle More
  options, `?` (Shift+/) opens the shortcuts cheat-sheet.
- In the line grid: `Enter` commits the cell and advances; on the last cell of a row,
  `Enter` commits the line and **auto-adds the next** (Tally-style rapid entry); arrow
  `Up/Down` move between rows; native `Tab`/`Shift+Tab` between cells; in the GST cell,
  number keys jump to the matching slab.
- All shortcuts are listed in the cheat-sheet modal (wire the existing header button).

**In-form smart defaults (frontend, localStorage per firm):**

- Sticky last-used **Payment terms** + **Place of supply**: persisted to localStorage keyed
  by firm, pre-filled on the next new invoice (user can override).
- New invoice **auto-adds one focused empty line** so typing can start immediately.
- **Duplicate-item hint**: adding an item already on the invoice shows a non-blocking
  "Item already added on line N" note with a "merge?" affordance.
- Item select auto-fill of HSN/rate/GST and place-of-supply derivation (existing - keep).

### Part 1b - Persisted learning store ("Field Prediction") - LOGICAL/SCHEMA CHANGE (GATED)

Needs explicit Stage-2 approval before build (multi-tenant scoping + new collection).

**What it remembers (updated on post):**

- Per **party**: last Payment terms, last Place of supply, default document notes.
- Per **(party, item)**: last rate charged (so re-billing a customer pre-fills their price).
- Per **vendor**: default expense category (feeds the future OCR Capture module too).

**Proposed data contract (for approval):**

- New collection `FieldPredictionMemory` (or extend an existing prefs store), tenant-scoped:
  `{ workspaceId, firmId, scope: 'party'|'party_item'|'vendor', key, field, value, updatedAt }`.
- Written best-effort on successful post (never blocks posting); read on form init to
  pre-fill. RBAC: same scope as the voucher; no cross-firm/cross-workspace reads.
- FE reads via a small `useSmartDefaults(partyId, firmId)` hook; BE exposes a scoped
  read + an internal write hook on post.

**Why gated:** new schema + a multi-tenant data-segregation surface (the project is strict
on scope/RBAC). This is exactly the Stage-2 logical change the program plan calls out.

## Build plan

- **1a (frontend, build on approval):** keyboard model + cheat-sheet + sticky last-used +
  auto-first-line + duplicate hint. Touches `VoucherEditor.tsx`, `LineItemsTable.tsx`,
  `VoucherEditorHeader.tsx` (cheat-sheet), a tiny `lib/finance/voucherPrefs.ts`
  (localStorage). Tests: node:test for the prefs + duplicate-detect helpers; live keyboard
  walkthrough in the browser.
- **1b (backend + frontend, after schema approval):** `FieldPredictionMemory` model +
  scoped read endpoint + on-post write + `useSmartDefaults` hook wiring.

## Non-goals / guardrails

- No mouse-removal of any existing capability; keyboard is additive.
- 1a introduces no schema/behavioral-data change (polish lane). 1b is the only schema change
  and is gated.
- Accessibility: shortcuts must not trap focus or break screen-reader nav; cheat-sheet is
  reachable + dismissible by keyboard.

## Decision needed from owner (Stage-2 gate)

1. Approve **1a** (frontend keyboard + in-form defaults) to build now.
2. Approve the **1b learning-store schema** (`FieldPredictionMemory`, tenant-scoped) - or
   defer 1b and ship 1a alone first.
