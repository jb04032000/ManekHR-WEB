# Consent-first ERP-linked Verification — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.
> **Standing rule:** the assistant runs NO git commands. "Commit" points are owner actions. Tests: `vitest`; gates: `tsc`, `eslint`, `npm run check:i18n`. Mobile app: out of scope.

**Goal:** Make the Connect "ERP-linked" badge consent-gated, ownership-verified, transparent, and self-cleaning across every deletion path.

**Architecture:** Backend is the source of truth — `ErpLinkService` returns `linked:false` unless the subject has explicitly consented; entity links require workspace ownership; a new `workspace.deleted` event + the existing `ACCOUNT_ERASED` event drive Connect-side cascade cleanup. Web adds owner-only consent UI (suggestion banner, transparency modal, settings toggle, link/unlink action); badge rendering is unchanged because it already follows the backend boolean.

**Tech Stack:** NestJS + Mongoose (backend), Next.js + React + Ant Design + next-intl (web), vitest.

**Spec:** `crewroster-web/docs/superpowers/specs/2026-06-18-erp-linked-verification-consent-design.md`
**ADR:** `crewroster-backend/docs/architecture/adr/0004-erp-linked-badge-gate-and-verification.md`
**Decision:** public badge = "ERP-linked" + "active since {year}" (no public headcount).

---

## File Structure

**Backend (`crewroster-backend`):**

- Modify `src/modules/connect/profile/schemas/connect-profile.schema.ts` — consent sub-doc + dismissal stamp.
- Modify `src/modules/connect/entities/schemas/company-page.schema.ts` + `storefront.schema.ts` — `erpLink` sub-doc.
- Modify `src/modules/connect/profile/erp-link.service.ts` — consent gate.
- Create `src/modules/connect/profile/erp-verification.service.ts` — person consent grant/revoke/dismiss/eligibility.
- Modify `src/modules/connect/profile/*controller*.ts` — consent endpoints.
- Modify `src/modules/connect/entities/services/company-page.service.ts` + `storefront.service.ts` — `linkErpWorkspace` / `unlinkErpWorkspace` (ownership-checked); strip raw `erpWorkspaceId` from create/update.
- Modify `src/modules/connect/entities/dto/company-page.dto.ts` + `storefront.dto.ts` — remove `erpWorkspaceId`; add link DTO.
- Create `src/modules/workspaces/events/workspace.events.ts` — `WORKSPACE_DELETED` constant + payload.
- Modify `src/modules/workspaces/workspaces.service.ts` — emit on `remove()` + `softDeleteAllOwnedForErasure()`.
- Modify `src/modules/connect/entities/services/*` (or a new `connect-erp-lifecycle.service.ts`) — `@OnEvent(WORKSPACE_DELETED)` cascade.
- Modify `src/modules/connect/profile/connect-profile.service.ts` — extend `handleAccountErased`.
- Modify the Connect demo seeder — set consent/link on demo entities.
- Tests under `src/**/__tests__/*.vitest.ts`.

**Web (`crewroster-web`):**

- Modify the profile/me API client + `features/connect/profile.types.ts` — consent fields.
- Create `components/connect/ERPConsentModal.tsx` — transparency modal.
- Create `components/connect/ERPConsentBanner.tsx` — one-time suggestion.
- Modify `features/connect/profile/ProfileView.tsx` + `EditSectionModal.tsx` — banner + settings toggle.
- Modify `features/connect/entities/CompanyPageForm.tsx` (+ storefront editor) — link/unlink action.
- Modify `app/messages/{en,gu,gu-en,hi-en}.json` — `connect.erpConsent.*`.
- Tests under `**/__tests__/*.vitest.ts`.

---

## Phase A — Backend (engine, consent, lifecycle)

### Task A1: Consent + link schema fields

**Files:**

- Modify `src/modules/connect/profile/schemas/connect-profile.schema.ts`
- Modify `src/modules/connect/entities/schemas/company-page.schema.ts`
- Modify `src/modules/connect/entities/schemas/storefront.schema.ts`

- [ ] **Step 1:** Add to `ConnectProfile`:

```ts
@Prop({
  type: { status: String, grantedAt: Date, revokedAt: Date, consentVersion: String },
  default: null, _id: false,
})
erpVerificationConsent?: {
  status: 'granted' | 'revoked';
  grantedAt: Date | null;
  revokedAt: Date | null;
  consentVersion: string;
} | null;

@Prop({ type: Date, default: null })
erpSuggestionDismissedAt?: Date | null;
```

- [ ] **Step 2:** Add to `CompanyPage` and `Storefront` (identical shape):

```ts
@Prop({
  type: { status: String, linkedByUserId: Types.ObjectId, linkedAt: Date, consentVersion: String },
  default: null, _id: false,
})
erpLink?: {
  status: 'verified' | 'revoked';
  linkedByUserId: Types.ObjectId;
  linkedAt: Date | null;
  consentVersion: string;
} | null;
```

Keep existing `erpWorkspaceId`.

- [ ] **Step 3:** `npx tsc --noEmit` on touched files compiles (or repo's `build`). Expected: clean.

### Task A2: Consent gate in `ErpLinkService`

**Files:** Modify `src/modules/connect/profile/erp-link.service.ts`; Test `src/modules/connect/profile/__tests__/erp-link.service.consent.vitest.ts`

- [ ] **Step 1 (test first):** Write a vitest asserting: profile with no consent → `getUserStatus` returns `{linked:false}`; with `erpVerificationConsent.status==='granted'` and active workspace activity → `linked:true`; with `status==='revoked'` → `linked:false`.
- [ ] **Step 2:** Run it → FAIL.
- [ ] **Step 3:** In `getUserStatus(userId)`, load the user's `ConnectProfile.erpVerificationConsent`; if status !== 'granted', return the empty `{linked:false, since:null, signals:{…0}}` before any ERP query. Add a `getConsentedWorkspaceStatus(entity)` helper (or apply the check in entity callers) that returns empty unless `entity.erpLink?.status==='verified'`.
- [ ] **Step 4:** Run tests → PASS. Existing erp-link tests still green.

### Task A3: Person consent service + endpoints

**Files:** Create `src/modules/connect/profile/erp-verification.service.ts`; Modify the profile controller; Test `__tests__/erp-verification.service.vitest.ts`

- [ ] **Step 1 (test first):** assert `grant` writes `{status:'granted', grantedAt, consentVersion:'erp-verify-v1'}` + audits; `revoke` writes `{status:'revoked', revokedAt}`; `dismiss` sets `erpSuggestionDismissedAt`; `getState(userId)` returns `{eligible, consentStatus, suggestionDismissed}` where `eligible` = has ≥1 active `WorkspaceMember`.
- [ ] **Step 2:** Run → FAIL.
- [ ] **Step 3:** Implement the service (inject `ConnectProfile` model, `WorkspaceMember` model, `AuditService`, `PostHogService`). Add controller routes: `POST /connect/profile/erp-verification/consent`, `DELETE …/consent`, `POST …/dismiss`; expose `getState` fields in the existing profile "me" payload. All guarded by `JwtAuthGuard` + throttler + class-validator (no body needed beyond auth). Audit + PostHog on grant/revoke.
- [ ] **Step 4:** Run → PASS.

### Task A4: Ownership-checked entity link/unlink

**Files:** Modify `company-page.service.ts`, `storefront.service.ts`, their DTOs, controllers; Test `__tests__/company-page.erp-link.vitest.ts`

- [ ] **Step 1 (test first):** assert `linkErpWorkspace(owner, entityId, wsId)` sets `erpWorkspaceId` + `erpLink:{status:'verified', linkedByUserId, linkedAt, consentVersion}` when `isWorkspaceOwner(ws, owner)` is true; throws `ForbiddenException` when the caller is NOT the workspace owner; `unlinkErpWorkspace` clears both. Assert create/update no longer accept `erpWorkspaceId`.
- [ ] **Step 2:** Run → FAIL.
- [ ] **Step 3:** Remove `erpWorkspaceId` from `CreateCompanyPageDto`/`UpdateCompanyPageDto` + storefront equivalents. Add `linkErpWorkspace`/`unlinkErpWorkspace` to both services using `isWorkspaceOwner` (`common/utils/workspace-ownership.util.ts`) + `loadOwned` for entity ownership. Add controller routes `POST /connect/(pages|stores)/:id/erp-link` + `DELETE …/erp-link`. Audit each.
- [ ] **Step 4:** Run → PASS.

### Task A5: `workspace.deleted` event

**Files:** Create `src/modules/workspaces/events/workspace.events.ts`; Modify `src/modules/workspaces/workspaces.service.ts`

- [ ] **Step 1:** Define `export const WORKSPACE_DELETED = 'workspace.deleted';` + `export interface WorkspaceDeletedEvent { workspaceId: string; ownerId: string; }` (mirror `account-erasure.events.ts`).
- [ ] **Step 2:** Inject `EventEmitter2` if not present; emit `WORKSPACE_DELETED` after the soft-delete write in `remove()` AND inside `softDeleteAllOwnedForErasure()` (one per workspace). Verify `EventEmitterModule` is imported app-wide (it is — `ACCOUNT_ERASED` uses it).
- [ ] **Step 3:** Unit test asserts the emit fires with the right payload on `remove()`.

### Task A6: Connect cascade listener

**Files:** Create `src/modules/connect/entities/connect-erp-lifecycle.service.ts` (registered in the entities module); Test `__tests__/connect-erp-lifecycle.service.vitest.ts`

- [ ] **Step 1 (test first):** assert that on `WORKSPACE_DELETED`, every `CompanyPage`/`Storefront` with `erpWorkspaceId === deletedId` gets `erpWorkspaceId:null` + `erpLink.status:'revoked'`, an audit row (actor=system), and one `NotificationsService.dispatch` to the entity owner.
- [ ] **Step 2:** Run → FAIL.
- [ ] **Step 3:** Implement `@OnEvent(WORKSPACE_DELETED, { async:true })`: bulk-find affected entities, update them, audit, and `dispatch` ("ERP-linked badge removed — the linked workspace was deleted"). Wrap in try/catch + `Sentry.captureException` (badge cleanup must not throw into the workspace flow).
- [ ] **Step 4:** Run → PASS.

### Task A7: Extend `ACCOUNT_ERASED` cleanup

**Files:** Modify `src/modules/connect/profile/connect-profile.service.ts` `handleAccountErased`; Test the existing erasure vitest.

- [ ] **Step 1 (test first):** assert that after `handleAccountErased(userId)`, the user's `erpVerificationConsent` is cleared/revoked and any `CompanyPage`/`Storefront` they own has `erpWorkspaceId:null` + `erpLink.status:'revoked'` (in addition to the existing hide/de-index).
- [ ] **Step 2:** Run → FAIL.
- [ ] **Step 3:** Extend the handler to clear consent + unlink owned entities (audit as system). Their owned workspaces are soft-deleted by `softDeleteAllOwnedForErasure()` (Task A5) which now emits `WORKSPACE_DELETED`, cascading to OTHER users' linked entities — no extra work here.
- [ ] **Step 4:** Run → PASS.

### Task A8: Demo seeder keeps badges

**Files:** Modify the Connect demo seeder (`src/modules/admin/admin-connect-demo.service.ts` / `scripts/connect-demo`).

- [ ] **Step 1:** Where demo entities/personas set `erpWorkspaceId`, also set `erpLink:{status:'verified',…}`; for demo profiles set `erpVerificationConsent:{status:'granted', consentVersion:'erp-verify-v1'}`. So demo badges still render under the new gate.
- [ ] **Step 2:** Run the demo seeder locally (or its unit test) → demo entities show `linked:true`.

### Task A9: Backend gate run

- [ ] Run the full connect/workspaces vitest suites → green.
- [ ] `eslint` on touched files → 0 errors.
- [ ] **Owner commit point (backend).**

---

## Phase B — Web (owner-side consent UI)

### Task B1: API client + types

**Files:** Modify the connect profile API client + `features/connect/profile.types.ts`; add page/store link client calls.

- [ ] **Step 1:** Add types: `erpVerification?: { eligible:boolean; consentStatus:'granted'|'revoked'|null; suggestionDismissed:boolean }` on the profile "me" type. Add client fns: `grantErpConsent()`, `revokeErpConsent()`, `dismissErpSuggestion()`, `linkPageErp(id)`, `unlinkPageErp(id)` (+ store equivalents) hitting the Task A3/A4 routes.
- [ ] **Step 2:** `tsc --noEmit` clean.

### Task B2: Consent transparency modal + i18n

**Files:** Create `components/connect/ERPConsentModal.tsx`; Modify `app/messages/{en,gu,gu-en,hi-en}.json`.

- [ ] **Step 1:** Add `connect.erpConsent` keys (banner*, modal*, settingToggle*, unlinkConfirm*) to **all four** locales with the spec copy (en source, translate gu/gu-en/hi-en — match existing translation style in those files).
- [ ] **Step 2:** Build `ERPConsentModal` on the existing `Modal`/`DsModal` pattern (see `DeletePageConfirmModal.tsx`): title, "we look at (counts only)" list, "we never read/show" list, "what's public", "your control" line, Verify / Not now actions. Props: `open, mode:'profile'|'entity', onConfirm, onCancel, loading`.
- [ ] **Step 3:** `npm run check:i18n` → parity passes (all 4 locales, no missing keys).

### Task B3: Profile suggestion banner + settings toggle

**Files:** Create `components/connect/ERPConsentBanner.tsx`; Modify `features/connect/profile/ProfileView.tsx` (rail, after `ERPLinkedPanel`) + `EditSectionModal.tsx` (visibility tab); Test `__tests__/ERPConsentBanner.vitest.tsx`.

- [ ] **Step 1 (test first):** banner renders only when `isOwner && erpVerification.eligible && consentStatus!=='granted' && !suggestionDismissed`; hidden otherwise; "Verify" opens modal, "Not now" calls dismiss.
- [ ] **Step 2:** Run → FAIL.
- [ ] **Step 3:** Implement banner + mount in `ProfileView` rail; add a revoke/grant toggle in the owner-only privacy section (`visibilitySection` / `EditSectionModal` 'visibility' tab) wired to grant/revoke client fns; refetch profile on success.
- [ ] **Step 4:** Run → PASS.

### Task B4: Company page / storefront link & unlink

**Files:** Modify `features/connect/entities/CompanyPageForm.tsx` + storefront editor; Test `__tests__/CompanyPageErpLink.vitest.tsx`.

- [ ] **Step 1 (test first):** owner sees "Link this page to my ERP workspace" when unlinked → opens `ERPConsentModal` (entity mode) → calls `linkPageErp`; when linked, shows linked state + "Unlink" → calls `unlinkPageErp`. A `Forbidden` response surfaces a friendly "you must own that workspace" message.
- [ ] **Step 2:** Run → FAIL.
- [ ] **Step 3:** Replace the passive note (lines ~605–652) with the action + consent modal + unlink control + linked status; map the backend `Forbidden` to a friendly toast/inline error.
- [ ] **Step 4:** Run → PASS.

### Task B5: Web gate run

- [ ] `tsc --noEmit` → clean. `eslint` → 0. `npm run check:i18n` → parity. Connect vitest → green.
- [ ] **Owner commit point (web).**

---

## Self-Review (against spec)

- **Consent gate** → A2. **Person consent + eligibility** → A3, B3. **Ownership-checked link** → A4, B4. **Transparency copy** → B2. **workspace.deleted cascade + notify** → A5, A6. **account-erased cleanup** → A7. **Demo badges** → A8. **Badge reveal = Option B** → public payload exposes only `linked` + `since` (year); headcount stays in owner-only panel (no change needed; confirm the public mapper does not emit headcount). **Deletion matrix** → A2 (revoke), entity delete (existing cascade), A6 (workspace delete), A7 (account erase), decay (unchanged). **i18n 4 locales** → B2. **No git by assistant / owner commit points** → Phase A9, B5. **Non-goals** (verify hub, public headcount, decay-notify, mobile) → not in any task. ✅ No gaps.
- **Type consistency:** `erpVerificationConsent.status` ∈ {granted,revoked}; `erpLink.status` ∈ {verified,revoked}; `consentVersion='erp-verify-v1'`; client field `erpVerification.consentStatus`. Consistent across tasks. ✅
