<!-- generated-by: gsd-doc-writer -->

# zari360-web

Web dashboard for **Zari360** (formerly Zari360) - a multi-tenant workforce
management SaaS for small businesses. This Next.js app pairs with the
[`zari360-backend`](../zari360-backend/) NestJS API to deliver team
management, attendance, shift scheduling, payroll, billing, machines, and
RBAC features scoped to per-workspace tenants.

Part of the Zari360 monorepo. See the [root README](../README.md) for the
full project overview.

## Tech stack

| Layer     | Library / version                             |
| --------- | --------------------------------------------- |
| Framework | Next.js 16.1.6 (App Router) + React 19.2.3    |
| Language  | TypeScript 5                                  |
| Styling   | Tailwind CSS 4 + Ant Design 6                 |
| State     | Zustand 5 (persisted to localStorage)         |
| HTTP      | Axios 1.13 with refresh-token interceptor     |
| Forms     | react-hook-form 7                             |
| i18n      | next-intl 4                                   |
| Charts    | Recharts 3 + ApexCharts 5                     |
| Export    | jsPDF + jspdf-autotable, xlsx (lazy-imported) |
| Auth      | JWT (access + refresh) + Google OAuth         |
| Linting   | ESLint 9 (`eslint-config-next`)               |

Verified from [`package.json`](./package.json).

## Quick start

```bash
cd zari360-web
npm install
npm run dev
```

Dev server runs on **http://localhost:3001**. The backend must be running on
`http://localhost:3000` (see [`zari360-backend/`](../zari360-backend/)).

### Available scripts

| Command              | Purpose                                       |
| -------------------- | --------------------------------------------- |
| `npm run dev`        | Start Next.js dev server on port 3001         |
| `npm run build`      | Production build (runs `check:i18n` first)    |
| `npm run start`      | Run production server on port 3001            |
| `npm run lint`       | Run ESLint                                    |
| `npm run check:i18n` | Validate translation message coverage         |
| `npm run test:lib`   | Run isolated lib unit tests (finance helpers) |

## Environment variables

Required to boot the web app:

| Variable                      | Scope       | Purpose                                 |
| ----------------------------- | ----------- | --------------------------------------- |
| `BACKEND_API_URL`             | Server-only | Used by Server Actions / middleware     |
| `NEXT_PUBLIC_BACKEND_API_URL` | Client-side | Used by the Axios client in the browser |

Both typically point to the backend (e.g. `http://localhost:3000`). For the
full list of env vars across the monorepo (Mongo URI, JWT secrets, R2 keys,
SMTP, Firebase, etc.), see [`../docs/CONFIGURATION.md`](../docs/CONFIGURATION.md).

## Folder structure

```
zari360-web/
├── app/              Next.js App Router pages
│   ├── auth/         Login, register, verify, reset, invite
│   ├── dashboard/    Team, attendance, salary, shifts, holidays, bills, machines
│   ├── admin/        Platform admin: users, plans, subscriptions
│   ├── api/          Route handlers (server endpoints)
│   ├── kiosk/        Kiosk-mode attendance terminal
│   ├── portal/       Customer / party portal
│   ├── setup-admin/  First-run platform admin setup
│   ├── i18n.ts       next-intl request config
│   └── messages/     Translation JSON catalogs
├── components/       Feature + design-system React components
│   ├── ui/           Design system (DsButton, DsTable, DsModal, …)
│   ├── layout/       Sidebar, TopHeader, DashboardLayout
│   ├── dashboard/    Feature components (drawers, bulk action bars)
│   ├── export/       ExportButton, ExportModal, FieldSelector
│   ├── team/ salary/ machines/ parties/ reports/ utilisation/ …
├── lib/              Non-UI logic
│   ├── actions/      Server Actions (`*.actions.ts`, `'use server'`)
│   ├── api/          Axios client, endpoints, client-side API wrappers
│   ├── constants/    Feature-access registry, enums
│   ├── exportFields/ Per-module field definitions for PDF/Excel export
│   ├── finance/      Money, tax, amount-in-words helpers (unit tested)
│   ├── rbac/         Permission helpers
│   ├── services/     Cross-cutting services
│   ├── store.ts      Zustand stores (auth, workspace, subscription)
│   ├── utils.ts      Formatting + error parsing
│   └── theme.ts      AntD theme tokens
├── hooks/            React hooks (useWorkspace, useExport, useDebounce, …)
├── types/            Shared TypeScript interfaces
├── features/         Feature-scoped composition (cross-cuts app/ + components/)
├── public/           Static assets
├── scripts/          Build-time scripts (check-i18n.js)
├── docs/             Web-specific docs
├── middleware.ts     JWT validation, refresh, platform-access guard
├── next.config.ts    Next.js + next-intl + Turbopack config
└── tailwind.config.js / postcss.config.mjs / tsconfig.json
```

## Key patterns

- **Server Actions vs client API.** Mutations and SSR data live in
  `lib/actions/*.actions.ts` (marked `'use server'`, use `serverHttp()` +
  `unwrapServer<T>()`). Browser-side calls go through the Axios instance in
  `lib/api/client.ts` and are unwrapped with `unwrap<T>(response)`. The
  backend response envelope `{ success, data }` is auto-unwrapped on both
  paths.
- **Endpoints registry.** All backend URLs are defined as functions in
  `lib/api/endpoints.ts` (e.g. `team.list(wsId)`). Never hand-build URLs
  in components.
- **Workspace scoping.** All data routes are workspace-scoped under
  `/workspaces/{wsId}/...`. The current workspace ID comes from
  `useWorkspaceStore`.
- **Zustand stores.** `useAuthStore`, `useWorkspaceStore`, and
  `useSubscriptionStore` persist to localStorage with an `isHydrated` flag.
  `onRehydrateStorage` syncs tokens to the Axios interceptor; cookie sync is
  deferred via `requestIdleCallback`.
- **Dual token storage.** localStorage (Axios) + httpOnly cookies
  (Server Actions). `middleware.ts` validates the access token with a 30s
  buffer and refreshes when needed.
- **Design system.** Components prefixed `Ds*` in `components/ui/` (e.g.
  `DsButton`, `DsTable`, `DsModal`) are the canonical primitives - prefer
  them over raw AntD imports.
- **Feature gating.** Subscription entitlements drive UI visibility via
  the registry in `lib/constants/`.

## Build & deploy

```bash
npm run build    # Validates i18n, then runs `next build`
npm run start    # Serves the production build on port 3001
```

The production server respects the same `BACKEND_API_URL` /
`NEXT_PUBLIC_BACKEND_API_URL` env vars as dev.

<!-- VERIFY: production hosting target / CI pipeline for zari360-web -->

## Further reading

- [Root README](../README.md) - monorepo overview
- [Architecture](../docs/ARCHITECTURE.md) - system architecture across web, mobile, backend
- [Development](../docs/DEVELOPMENT.md) - local dev workflow and conventions
- [Configuration](../docs/CONFIGURATION.md) - full env var reference
- [Feature docs](../docs/features/) - per-feature deep dives
- [`CLAUDE.md`](./CLAUDE.md) - codebase guidance for AI assistants (graph tooling)
