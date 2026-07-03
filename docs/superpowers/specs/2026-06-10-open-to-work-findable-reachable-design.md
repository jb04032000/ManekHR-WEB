# Open to Work - Findable + Reachable (slice A) - Design

- Date: 2026-06-10
- Scope: web-only, Connect. ZERO backend change.
- Status: APPROVED (owner said go)

## 1. Context

LinkedIn's "open to work" makes a candidate findable (recruiter search) and reachable (direct message). In our trade: "open to work" = a karigar wanting a job; an employer wants to find available karigars and message them.

What ALREADY exists (verified):

- Findable: people search has a working "Open to work" toggle (`FacetPanel`, `?openToWork=true`) backed by the BE Meili + Mongo filter (`people-search.helpers`). No work needed.
- Reachable primitive: `StartConversationButton` (`features/connect/inbox/StartConversationButton.tsx`) calls `startInboxDm(recipientUserId)`, opens the resolved thread, and self-hides when the inbox module is off. No BE change needed.

The gap: the profile "work" intent card and the people-search result rows do not use that button, so "Message" does not actually start a chat. And there is no quick entry to "find available karigars".

## 2. Goal

Wire the existing pieces so an employer can (a) jump to available karigars in one tap, and (b) message any available karigar in one tap, opening a real chat. No new messaging or search code.

## 3. Deliverables

1. **Profile "work" intent card -> real Message.** In `IntentCards.tsx`, the `work` CTA currently links to `/connect/inbox?to=<subject>` (a dead link - the inbox ignores `?to=`). Replace it, for a signed-in non-owner viewer with a `subjectUserId`, with `<StartConversationButton recipientUserId={subjectUserId} label={t('work.cta')} partyName=... dsVariant="primary" dsSize="sm" />`. Logged-out viewers keep the existing join-gate link to `/connect`. Owners keep the Manage affordance. (The other intents' CTAs are unchanged.)
2. **People-search result -> Message available karigars.** In the people result card (`PersonCard.tsx`), when the person's `openStatus === 'work'`, render a compact `StartConversationButton` (`iconOnly` or small `label`) next to the existing actions, using the person's canonical user id. This lets an employer message straight from the filtered "open to work" list.
3. **"Find available karigars" shortcut.** Add one obvious entry that opens people search pre-filtered: a link/button to `/connect/search?type=people&openToWork=true`. Placement: the owner view of the profile Hiring intent card (the owner is hiring -> "Find karigars" makes sense there) AND/OR the people search screen header. Pick the profile Hiring owner card as the primary home; keep it a plain `Link`.

## 4. Non-goals / guardrails

- No backend change. No new endpoints. No schema change.
- No payments.
- Respect the inbox phase gate: `StartConversationButton` already self-hides when the inbox module is off, so dropping it in is safe.
- Reuse existing i18n where possible (`connect.inbox.start.message`, `connect.profile.intents.work.cta`). Any new label (e.g. "Find karigars") gets a key in all 4 locales.
- `work`/`hiring` mutually exclusive + `deals`/`customOrders` paused already - unaffected.

## 5. Modules touched

- Inbox: reused as-is (StartConversationButton + startInboxDm). No change.
- Profile (`IntentCards.tsx`): swap the work CTA; add owner "Find karigars" link.
- Search people (`PersonCard.tsx`): add the Message button for open-to-work people.
- i18n: a couple of keys if new copy is introduced.

## 6. Testing

- `IntentCards.test.tsx`: signed-in non-owner + `work` active + `subjectUserId` renders a Message control (StartConversationButton, mock the inbox flag on / mock the action); logged-out keeps the `/connect` link; owner keeps Manage. (Mock `isConnectModuleEnabled('inbox')` true in the test, or assert the button renders when enabled.)
- `PersonCard` test: `openStatus==='work'` shows the Message button; null/`hiring` does not.
- tsc + eslint clean; no banned AntD v6 forms; 4-locale parity for any new key.

## 7. Rollout / risk

Low. Pure web wiring over shipped primitives. If the inbox module is gated off in an environment, the Message buttons self-hide (graceful). The "Find karigars" link just deep-links the existing search.
