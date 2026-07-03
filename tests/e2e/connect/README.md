# Connect E2E (Playwright)

Smoke + flow tests for the Connect feature, signed in as the seeded demo personas.

## Prerequisites

1. **Backend** running on :3000 with `AUTH_OTP_MOCK=true` (enables OTP `123456`).
2. **Demo data seeded:** in `crewroster-backend`, run `npm run seed:connect`
   (creates the 18 demo accounts; each gets App-Lock PIN `000000`).
3. **Web** running on :3001 with `NEXT_PUBLIC_AUTH_OTP_MOCK=true`
   (or set `PLAYWRIGHT_BASE_URL`).
4. First time only: `npm run test:e2e:install` (downloads Chromium).

## Run

```bash
# from crewroster-web
npm run test:e2e -- --project=connect          # all Connect specs
npm run test:e2e:ui -- --project=connect       # interactive runner
```

Admin demo-manager spec is skipped unless you provide a platform-admin account:

```bash
E2E_ADMIN_MOBILE=99XXXXXXXX E2E_ADMIN_PIN=000000 npm run test:e2e -- --project=connect
```

## What it covers

- **connect-browse.spec.ts** — feed, jobs, marketplace, network, profile all load
  with seeded content (no empty/error screens).
- **connect-post.spec.ts** — create a text post and see it in the feed.
- **admin-demo.spec.ts** — the admin demo manager lists accounts + shows controls.

## Notes

The app has no `data-testid`s yet, so selectors use roles/text/placeholder
(see `connect-auth.ts` for the login flow). If a selector misses on first run,
it's almost always the composer trigger or the login step — fix it in
`connect-auth.ts` / the spec and re-run. Adding `data-testid`s to the composer,
post card, and key buttons would make these rock-solid.
