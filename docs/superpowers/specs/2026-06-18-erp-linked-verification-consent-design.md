# Consent-first ERP-linked verification — design spec

**Date:** 2026-06-18
**Status:** Approved (owner approved design in session; badge reveal = Option B)
**Decision record:** `crewroster-backend/docs/architecture/adr/0004-erp-linked-badge-gate-and-verification.md`
**Supersedes the "gate off" path of ADR-0004** — owner chose to build the proper consent-based verification now.

## Problem

The Connect "ERP-linked" trust badge is shown with no consent step and no
ownership proof, and the link can go stale silently. We are pre-launch, so we
fix it properly now: a badge that is **earned by explicit consent**, **owned by
the right person**, **transparent about what we read/show**, and **cleaned up on
every deletion path**.

Today (from investigation):

- The badge is derived live by `ErpLinkService` (≥5 attendance OR ≥1 payroll run
  OR ≥3 invoices in last 30 days; 60-day decay), never stored.
- `CompanyPage`/`Storefront` link via `erpWorkspaceId` with **no workspace-ownership
  check** (`company-page.service.ts`, `storefront.service.ts`, DTOs accept it raw).
- Profile badge derives from the user's active `WorkspaceMember` rows — no consent.
- Workspace delete (`workspaces.service.ts`) emits **no event**; Connect never
  cascades, so `erpWorkspaceId` dangles. Account erasure DOES emit `ACCOUNT_ERASED`
  (`account-erasure.events.ts`) and `ConnectProfileService.handleAccountErased`
  already hides/de-indexes the profile.

## Core principle

**No ERP data is read, and no badge is shown, until the subject explicitly opts
in.** Consent is the gate — there is no separate feature flag.

## Decision: what the public badge reveals (Option B)

Public surfaces show: **"ERP-linked"** + **"active since {year}"**. The worker
headcount ("N workers on roll") is **not** shown publicly (privacy). The headcount
may still appear in the owner's _own_ private ERP-linked panel only.

## Data model

### Person consent — `ConnectProfile.erpVerificationConsent`

Add a sub-document (mirrors the `connectPolicyAcceptedAt` timestamp pattern on `User`):

```
erpVerificationConsent?: {
  status: 'granted' | 'revoked';   // absent = never asked / no consent
  grantedAt: Date | null;
  revokedAt: Date | null;
  consentVersion: string;          // e.g. 'erp-verify-v1' — re-prompt on bump
} | null;
```

- A separate `erpSuggestionDismissedAt?: Date | null` records "Not now" so the
  one-time banner does not nag (re-eligible after a long interval / version bump).

### Entity link consent — `CompanyPage` / `Storefront`

Already carry `erpWorkspaceId`. Add:

```
erpLink?: {
  workspaceId: ObjectId | null;    // the linked workspace (replaces raw erpWorkspaceId writes)
  status: 'verified' | 'revoked';
  linkedByUserId: ObjectId;        // must be the workspace owner at link time
  linkedAt: Date | null;
  consentVersion: string;
} | null;
```

Keep `erpWorkspaceId` as the read field (back-compat for the derivation + filters);
it is set ONLY through the consented, ownership-checked link path. On unlink/revoke
it is set back to `null`.

## Backend behaviour

### Consent gate in `ErpLinkService`

- `getUserStatus(userId)` returns `{ linked:false }` unless the user's
  `ConnectProfile.erpVerificationConsent.status === 'granted'`.
- `getWorkspaceStatus(workspaceId)` is called by entity reads only when the entity's
  `erpLink.status === 'verified'` and `erpWorkspaceId` is set. (Service signature
  unchanged; the gate is applied by callers / a thin consented wrapper.)
- Derivation rule + 60-day decay unchanged.

### Ownership-checked linking

- New/changed service methods on `CompanyPageService` + `StorefrontService`:
  `linkErpWorkspace(ownerUserId, entityId, workspaceId)` and
  `unlinkErpWorkspace(ownerUserId, entityId)`.
- `linkErpWorkspace` MUST verify the caller owns the workspace via the existing
  `isWorkspaceOwner(workspace, userId)` (`common/utils/workspace-ownership.util.ts`)
  → else `ForbiddenException`. Records `erpLink` + sets `erpWorkspaceId`. Audited.
- Remove raw `erpWorkspaceId` acceptance from create/update DTOs (no silent linking).

### Person consent endpoints

- `POST /connect/profile/erp-verification/consent` → grant (records version, audits).
- `DELETE /connect/profile/erp-verification/consent` → revoke (badge off immediately).
- `POST /connect/profile/erp-verification/dismiss` → record "Not now".
- Read: profile "me" payload exposes `{ eligible, consentStatus, suggestionDismissed }`
  so the web can render the suggestion banner + settings toggle.
  `eligible` = user has ≥1 active workspace membership (read-only check, no consent
  needed to compute eligibility).

### Deletion / lifecycle matrix (binding)

| Event                                   | Handling                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| --------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Person revokes consent**              | `status:'revoked'`, `revokedAt`; `getUserStatus`→false; stop reading. Audit.                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| **Entity unlinked / revoked by owner**  | `erpLink.status:'revoked'`, `erpWorkspaceId:null`; badge off. Audit.                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| **Connect entity deleted**              | `erpLink` + `erpWorkspaceId` removed with the entity (already cascades on delete).                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| **Workspace deleted**                   | NEW `workspace.deleted` event (emit in `workspaces.service.ts` `remove()` **and** `softDeleteAllOwnedForErasure()`). Connect listener: for every `CompanyPage`/`Storefront` with `erpWorkspaceId == deletedId` → clear link (`erpWorkspaceId:null`, `erpLink.status:'revoked'`), audit, **notify the entity owner** ("ERP-linked badge removed — linked workspace deleted"). Profile badges self-correct (derivation finds no activity); membership deactivation by the existing workspace-delete path is the backstop. |
| **Account erased**                      | Extend `ConnectProfileService.handleAccountErased` (`ACCOUNT_ERASED`): also clear the erased user's `erpVerificationConsent` and `erpLink`/`erpWorkspaceId` on every entity they own. Profile is already hidden+de-indexed. The erased user's owned workspaces are soft-deleted via `softDeleteAllOwnedForErasure()`, which now emits `workspace.deleted`, cascading to any _other_ users' linked entities.                                                                                                             |
| **Workspace goes quiet (no delete)**    | Existing 60-day silent decay. (No notification in v1.)                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| **Member offboarded (workspace lives)** | Derivation reads active members only → that workspace stops contributing; badge recomputes on next read.                                                                                                                                                                                                                                                                                                                                                                                                                |

### Observability

- Audit (`AuditService.logEvent`) every: consent grant/revoke, link/unlink, and each
  cascade clear (actor = system for cascades).
- Notify (`NotificationsService.dispatch`) only on **involuntary** badge loss
  (workspace-delete cascade). Voluntary actions are silent.
- PostHog events on consent grant/revoke + link/unlink (writes only), per repo convention.

## Web behaviour

- **Profile (owner only):** one-time suggestion card (after `ERPLinkedPanel` in the
  rail) when `eligible && consentStatus !== 'granted' && !suggestionDismissed`:
  _"You look like an ERP user — verify to earn the ERP-linked badge."_ → opens the
  **consent transparency modal** (exact copy below) → grant. "Not now" → dismiss.
- **Profile settings:** a persistent toggle in the existing owner-only privacy
  section (`visibilitySection` / `EditSectionModal` 'visibility' tab) to revoke/grant.
- **Company page / storefront editor:** replace the passive "earn the badge" note
  with an explicit **"Link this page to my ERP workspace"** action (only shown to the
  owner). Opens the consent + ownership modal; the backend rejects if the caller does
  not own the workspace. Show linked status + an **Unlink** control when linked.
- **Badge rendering unchanged:** all surfaces already render from the backend
  `erpLinked` boolean — which is now consent-gated server-side, so no per-surface
  changes are needed beyond the new owner-side controls.
- Optionally render the existing `connect.badge.erpTooltip` on the pill so the badge
  is self-explaining everywhere.

### Consent modal copy (transparency — en; translate to gu / gu-en / hi-en)

- **Title:** "Verify with your ERP"
- **Body:** "We'll confirm this is backed by real work — using only activity counts."
- **We look at (counts only):** attendance entries, pay runs, and bills logged in the
  last 30 days, and the date your workshop went live.
- **We never read or show:** individual salaries, individual attendance, worker names,
  or customer details.
- **What appears publicly:** the "ERP-linked" badge and "active since {year}".
- **Your control:** "Turn this off anytime in settings — the badge is removed
  immediately and we stop checking."
- **Actions:** "Verify" / "Not now".

New i18n namespace: `connect.erpConsent.*` (banner, modal, settings toggle, unlink
confirm) across all four locales.

## Migrations / data

- No destructive migration. New fields default to absent (no consent → no badge),
  so existing demo/seed entities lose the badge until consented — **intended**.
- Update the Connect demo seeder to set `erpVerificationConsent: granted` +
  `erpLink: verified` on demo personas/entities so demos keep showing the badge.

## Non-goals (deferred)

- The multi-tier `/connect/verify` hub (GST / Udyam / contact OTP) from the
  2026-06-02 spec — separate, later.
- Public worker-headcount display (Option C) — not now.
- Notifying on natural 60-day decay — not now.
- Mobile app — out of scope (standing rule).

## Testing

- **Backend (vitest):** consent gate (granted/revoked/absent → badge on/off);
  ownership check rejects non-owner link; `workspace.deleted` cascade clears links +
  notifies + audits; `ACCOUNT_ERASED` extension clears consent + entity links;
  derivation/decay unchanged.
- **Web (vitest):** banner visibility logic (eligible/consent/dismiss states);
  consent modal grant/revoke calls; link/unlink action; tsc + eslint + `check:i18n`
  parity across 4 locales.

## Out-of-scope guardrails

- No git operations by the assistant (owner stages/commits).
- No schema/permission change beyond those listed above (all owner-approved logical
  changes).
