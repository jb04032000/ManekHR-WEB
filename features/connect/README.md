# features/connect/

Connect feature logic - server actions, data mappers, query hooks.

Server actions (`'use server'`) for each Connect surface live here, one file per
domain (`profile.actions.ts`, `network.actions.ts`, `feed.actions.ts`, …). They call
the backend through the `serverHttp` server client and return typed results
(`{ ok: true; data } | { ok: false; error }`). TanStack Query hooks that wrap them for
interactive surfaces live alongside (`*.queries.ts`).

Built just-in-time per phase. See `docs/connect/ENGINEERING-STANDARDS.md` (#7 - Next.js
data patterns) and `docs/connect/WORKFLOW.md`.
