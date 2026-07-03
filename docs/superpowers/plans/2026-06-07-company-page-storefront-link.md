# Company Page <-> Storefront Link Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a company page owner attach exactly one storefront to the page (manage products only in the storefront), show a store card on the public page, and send buyers to the store.

**Architecture:** Reuse the existing `Storefront.companyPageId` link as the single source of truth (no new CompanyPage field). Enforce one store per page in the service + a partial unique index. Add attach/unlink/get endpoints, a "Store" tab in the company-page manage console (attach-existing-or-create), and a redirect-first Store section on the public company page.

**Tech Stack:** NestJS + Mongoose (backend), Next.js App Router + AntD v6 + cr- tokens + next-intl (web).

**Spec:** `docs/superpowers/specs/2026-06-07-company-page-storefront-link-design.md`

**Resource note (binding):** Per repo memory, full BE vitest/tsc OOMs. Run only the touched module's tests with `--no-file-parallelism`; typecheck via `npx nest build` (SWC), not whole-project tsc. Web: lint per changed file; avoid whole-project `tsc`.

**Commits:** All on `main` in each repo (owner workflow). End commit bodies with the Co-Authored-By trailer.

---

## File Structure

**crewroster-backend**

- Modify `src/modules/connect/entities/schemas/storefront.schema.ts` - partial unique index on `companyPageId`.
- Modify `src/modules/connect/entities/services/storefront.service.ts` - `getAttachedStorefront`, `attachStorefrontToPage`, `unlinkStorefrontFromPage`.
- Modify `src/modules/connect/entities/controllers/company-page.controller.ts` - GET/PUT/DELETE `:pageId/store`.
- Modify `src/modules/connect/entities/dto/*` - `AttachStoreDto { storefrontId }`.
- Create `src/modules/connect/entities/__tests__/storefront-link.vitest.ts` - service unit tests.
- (Migration) Create `src/scripts/migrations/2026-06-07-dedupe-page-storefronts.ts` - one-time de-dup.

**crewroster-web**

- Modify `features/connect/entities/company-page.actions.ts` - `getCompanyPageStore`, `attachStoreToPage`, `unlinkStoreFromPage`.
- Modify `features/connect/entities/ManageCompanyPageScreen.tsx` - new "Store" tab.
- Create `features/connect/entities/CompanyPageStoreTab.tsx` - the manage Store tab UI (attached + empty states).
- Create `features/connect/entities/AttachStorePicker.tsx` - modal picker of the owner's unlinked storefronts.
- Create `features/connect/entities/CompanyStoreCard.tsx` - shared public store card (logo, name, product count, featured preview, Visit store).
- Modify `features/connect/entities/CompanyPageView.tsx` - replace inline products tab with the Store section + Overview card.
- Modify `app/messages/{en,gu,gu-en,hi-en}.json` - new keys under `connect.companyPage` / `connect.storefront`.

---

## Task 1: Storefront partial unique index (one store per page)

**Files:**

- Modify: `crewroster-backend/src/modules/connect/entities/schemas/storefront.schema.ts`

- [ ] **Step 1: Add the partial unique index**

After the existing `StorefrontSchema.index({ companyPageId: 1 })`, replace that
non-unique index with a partial unique one so a page can have at most one store:

```ts
// One storefront per company page (the attached store). Partial so the many
// unlinked storefronts (companyPageId null) are not forced unique. Integrity
// backstop; the service also enforces this on attach. Keep in sync with
// company-page <-> storefront link (entities module).
StorefrontSchema.index(
  { companyPageId: 1 },
  { unique: true, partialFilterExpression: { companyPageId: { $type: 'objectId' } } },
);
```

- [ ] **Step 2: Typecheck**

Run: `cd crewroster-backend && npx nest build`
Expected: `Successfully compiled`.

- [ ] **Step 3: Commit**

```bash
git add src/modules/connect/entities/schemas/storefront.schema.ts
git commit -m "feat(connect/entities): one-store-per-page partial unique index"
```

---

## Task 2: De-dup migration (run before the unique index goes live)

**Files:**

- Create: `crewroster-backend/src/scripts/migrations/2026-06-07-dedupe-page-storefronts.ts`

> The unique index build fails if any page already has >1 linked storefront.
> This script keeps the most-recently-updated and unlinks the rest. Idempotent.

- [ ] **Step 1: Write the migration script**

```ts
/* One-time: enforce one storefront per company page before the partial unique
   index. For any companyPageId with >1 linked storefront, keep the
   most-recently-updated, set the others' companyPageId to null. Idempotent. */
import { connect, connection, Types } from 'mongoose';

async function run() {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGODB_URI not set');
  await connect(uri);
  const col = connection.collection('connectstorefronts');
  const dupes = await col
    .aggregate<{
      _id: Types.ObjectId;
      ids: Types.ObjectId[];
    }>([{ $match: { companyPageId: { $ne: null } } }, { $sort: { updatedAt: -1 } }, { $group: { _id: '$companyPageId', ids: { $push: '$_id' } } }, { $match: { 'ids.1': { $exists: true } } }])
    .toArray();
  let unlinked = 0;
  for (const d of dupes) {
    const [, ...rest] = d.ids; // keep first (newest), unlink the rest
    if (rest.length) {
      await col.updateMany({ _id: { $in: rest } }, { $set: { companyPageId: null } });
      unlinked += rest.length;
    }
  }
  console.log(`de-dup complete: ${dupes.length} pages, ${unlinked} storefronts unlinked`);
  await connection.close();
}
run().catch((e) => {
  console.error(e);
  process.exit(1);
});
```

- [ ] **Step 2: Commit (run is an owner-run ops step, not CI)**

```bash
git add src/scripts/migrations/2026-06-07-dedupe-page-storefronts.ts
git commit -m "chore(connect/entities): de-dup page->storefront before unique index"
```

> Owner runs `npx ts-node -r tsconfig-paths/register src/scripts/migrations/2026-06-07-dedupe-page-storefronts.ts` once, before deploying Task 1's index, against each environment.

---

## Task 3: Storefront link service methods

**Files:**

- Modify: `crewroster-backend/src/modules/connect/entities/services/storefront.service.ts`
- Test: `crewroster-backend/src/modules/connect/entities/__tests__/storefront-link.vitest.ts`

- [ ] **Step 1: Write failing service tests**

Mirror the existing `@nestjs/mongoose` decorator-mock test pattern (see
`auth.service.audit.vitest.ts`). Mock `storefrontModel` + `companyPageModel`.

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Types } from 'mongoose';
import { NotFoundException, BadRequestException } from '@nestjs/common';

// Minimal hand-built service double exercising the link logic. Import the real
// class with mocked models in the actual file; shown here as the behaviour spec.

describe('StorefrontService link', () => {
  const userId = new Types.ObjectId().toHexString();
  const pageId = new Types.ObjectId().toHexString();
  const storeId = new Types.ObjectId().toHexString();
  let svc: any;
  let storefrontModel: any;
  let companyPageModel: any;

  beforeEach(() => {
    companyPageModel = { findOne: vi.fn() };
    storefrontModel = { findOne: vi.fn(), updateMany: vi.fn(), updateOne: vi.fn() };
    svc = makeService({ storefrontModel, companyPageModel }); // helper builds the real service with mocks
  });

  it('attach rejects when caller does not own the page', async () => {
    companyPageModel.findOne.mockResolvedValue(null); // not owned
    await expect(svc.attachStorefrontToPage(userId, pageId, storeId)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('attach rejects a store already linked to a different page', async () => {
    companyPageModel.findOne.mockResolvedValue({ _id: pageId, ownerUserId: userId });
    storefrontModel.findOne.mockResolvedValue({
      _id: storeId,
      ownerUserId: userId,
      companyPageId: new Types.ObjectId(), // already linked elsewhere
    });
    await expect(svc.attachStorefrontToPage(userId, pageId, storeId)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('attach clears any prior store on the page then links the new one', async () => {
    companyPageModel.findOne.mockResolvedValue({ _id: pageId, ownerUserId: userId });
    storefrontModel.findOne.mockResolvedValue({
      _id: storeId,
      ownerUserId: userId,
      companyPageId: null,
    });
    await svc.attachStorefrontToPage(userId, pageId, storeId);
    expect(storefrontModel.updateMany).toHaveBeenCalledWith(
      { companyPageId: expect.anything(), _id: { $ne: expect.anything() } },
      { $set: { companyPageId: null } },
    );
    expect(storefrontModel.updateOne).toHaveBeenCalled();
  });

  it('unlink tolerates a page with no attached store', async () => {
    companyPageModel.findOne.mockResolvedValue({ _id: pageId, ownerUserId: userId });
    storefrontModel.updateOne.mockResolvedValue({ matchedCount: 0 });
    await expect(svc.unlinkStorefrontFromPage(userId, pageId)).resolves.toEqual({ linked: false });
  });
});
```

> The `makeService` helper instantiates the real `StorefrontService` with the
> mocked models (follow the decorator-mock pattern in the auth audit spec).

- [ ] **Step 2: Run tests, verify they fail**

Run: `cd crewroster-backend && npx vitest run src/modules/connect/entities/__tests__/storefront-link.vitest.ts --no-file-parallelism`
Expected: FAIL (methods not defined).

- [ ] **Step 3: Implement the service methods**

Add to `StorefrontService` (inject `companyPageModel` if not already; `AuditService` is already available in the entities module - confirm and reuse):

```ts
/** Verify the caller owns the page; 404 otherwise. Returns the page doc. */
private async assertOwnedPage(userId: string, pageId: string) {
  const page = Types.ObjectId.isValid(pageId)
    ? await this.companyPageModel.findOne({
        _id: new Types.ObjectId(pageId),
        ownerUserId: new Types.ObjectId(userId),
      })
    : null;
  if (!page) throw new NotFoundException('Company page not found');
  return page;
}

/** The single storefront attached to a page (0 or 1). ownerView ignores
 *  visibility; public callers pass ownerView=false to hide non-public stores. */
async getAttachedStorefront(pageId: string, ownerView = false): Promise<Storefront | null> {
  if (!Types.ObjectId.isValid(pageId)) return null;
  const filter: FilterQuery<Storefront> = { companyPageId: new Types.ObjectId(pageId) };
  if (!ownerView) filter.visibility = 'public';
  return this.storefrontModel.findOne(filter).lean<Storefront>().exec();
}

/** Attach (or swap) a storefront to a page. Owner of BOTH required. Clears any
 *  other store linked to the page first (one-store-per-page). Rejects a store
 *  already linked to a DIFFERENT page (no silent move). Idempotent. */
async attachStorefrontToPage(userId: string, pageId: string, storefrontId: string) {
  await this.assertOwnedPage(userId, pageId);
  const store = Types.ObjectId.isValid(storefrontId)
    ? await this.storefrontModel.findOne({
        _id: new Types.ObjectId(storefrontId),
        ownerUserId: new Types.ObjectId(userId),
      })
    : null;
  if (!store) throw new NotFoundException('Storefront not found');
  const pageObjId = new Types.ObjectId(pageId);
  if (store.companyPageId && String(store.companyPageId) !== String(pageObjId)) {
    throw new BadRequestException('This store is attached to another page');
  }
  // Clear any other store currently on this page (swap).
  await this.storefrontModel.updateMany(
    { companyPageId: pageObjId, _id: { $ne: store._id } },
    { $set: { companyPageId: null } },
  );
  await this.storefrontModel.updateOne({ _id: store._id }, { $set: { companyPageId: pageObjId } });
  await this.audit.logEvent({
    module: AppModule.CONNECT,
    entityType: 'Storefront',
    entityId: String(store._id),
    action: 'storefront_linked_page',
    actorId: userId,
    meta: { pageId },
  });
  return { linked: true };
}

/** Unlink the page's attached store. Tolerates none. */
async unlinkStorefrontFromPage(userId: string, pageId: string) {
  await this.assertOwnedPage(userId, pageId);
  const res = await this.storefrontModel.updateOne(
    { companyPageId: new Types.ObjectId(pageId), ownerUserId: new Types.ObjectId(userId) },
    { $set: { companyPageId: null } },
  );
  if (res.matchedCount > 0) {
    await this.audit.logEvent({
      module: AppModule.CONNECT,
      entityType: 'CompanyPage',
      entityId: pageId,
      action: 'storefront_unlinked_page',
      actorId: userId,
    });
  }
  return { linked: false };
}
```

> Add `storefront_linked_page` / `storefront_unlinked_page` to the Connect audit
> action union if the audit type enumerates actions; otherwise they are free strings.

- [ ] **Step 4: Run tests, verify pass**

Run: `cd crewroster-backend && npx vitest run src/modules/connect/entities/__tests__/storefront-link.vitest.ts --no-file-parallelism`
Expected: PASS (4 tests).

- [ ] **Step 5: Build + commit**

```bash
npx nest build
git add src/modules/connect/entities/services/storefront.service.ts src/modules/connect/entities/__tests__/storefront-link.vitest.ts
git commit -m "feat(connect/entities): attach/unlink/get storefront-page link service"
```

---

## Task 4: Link endpoints + DTO

**Files:**

- Modify: `crewroster-backend/src/modules/connect/entities/controllers/company-page.controller.ts`
- Modify: `crewroster-backend/src/modules/connect/entities/dto/` (add `AttachStoreDto`)

- [ ] **Step 1: Add the DTO**

In the entities DTO file (next to the company-page DTOs):

```ts
export class AttachStoreDto {
  @IsMongoId()
  storefrontId!: string;
}
```

- [ ] **Step 2: Add the endpoints**

```ts
/** The store attached to a page the caller owns (owner view: any visibility). */
@Get(':pageId/store')
getAttachedStore(@Req() req: AuthedRequest, @Param('pageId') pageId: string) {
  return this.storefronts.getAttachedStorefront(pageId, true);
}

/** Attach (or swap) a storefront the caller owns to a page they own. */
@Put(':pageId/store')
@Throttle({ default: { limit: 30, ttl: 60_000 } })
attachStore(
  @Req() req: AuthedRequest,
  @Param('pageId') pageId: string,
  @Body() dto: AttachStoreDto,
) {
  return this.storefronts.attachStorefrontToPage(req.user.sub, pageId, dto.storefrontId);
}

/** Unlink the page's attached store. */
@Delete(':pageId/store')
@Throttle({ default: { limit: 30, ttl: 60_000 } })
unlinkStore(@Req() req: AuthedRequest, @Param('pageId') pageId: string) {
  return this.storefronts.unlinkStorefrontFromPage(req.user.sub, pageId);
}
```

> Inject `StorefrontService` into the company-page controller (or place these on
> the storefront controller if that avoids a cross-service import - both modules
> are in the entities module, so injection is available). Ensure `Delete`/`Put`
> are imported from `@nestjs/common`. The `getAttachedStore` ownership is implied
> by the manage console only calling it for owned pages; for hard safety the
> service should also verify ownership in `getAttachedStorefront` owner path - if
> not, gate via `assertOwnedPage` first.

- [ ] **Step 3: Harden GET ownership**

Update `getAttachedStorefront(pageId, ownerView)` call site so the owner GET path
verifies ownership. Simplest: add `:pageId/store` owner check by calling a tiny
wrapper in the service:

```ts
async getAttachedStoreForOwner(userId: string, pageId: string) {
  await this.assertOwnedPage(userId, pageId);
  return this.getAttachedStorefront(pageId, true);
}
```

And the controller GET calls `this.storefronts.getAttachedStoreForOwner(req.user.sub, pageId)`.

- [ ] **Step 4: Build + commit**

```bash
npx nest build
git add src/modules/connect/entities/controllers/company-page.controller.ts src/modules/connect/entities/dto
git commit -m "feat(connect/entities): company-page store link endpoints"
```

---

## Task 5: Web server actions

**Files:**

- Modify: `crewroster-web/features/connect/entities/company-page.actions.ts`

- [ ] **Step 1: Add the actions**

```ts
import type { PublicStorefront, Storefront } from './entities.types';

/** The storefront attached to a page the caller owns (owner view). */
export async function getCompanyPageStore(
  pageId: string,
): Promise<ActionResult<Storefront | null>> {
  try {
    const http = await serverHttp();
    const res = await http.get(`${BASE}/${pageId}/store`);
    return { ok: true, data: unwrapServer<Storefront | null>(res) };
  } catch (e) {
    return { ok: false, error: toError(e) };
  }
}

/** Attach (or swap) an existing storefront to the page. */
export async function attachStoreToPage(
  pageId: string,
  storefrontId: string,
): Promise<ActionResult<{ linked: boolean }>> {
  try {
    const http = await serverHttp();
    const res = await http.put(`${BASE}/${pageId}/store`, { storefrontId });
    return { ok: true, data: unwrapServer<{ linked: boolean }>(res) };
  } catch (e) {
    return { ok: false, error: toError(e) };
  }
}

/** Unlink the page's attached store. */
export async function unlinkStoreFromPage(
  pageId: string,
): Promise<ActionResult<{ linked: boolean }>> {
  try {
    const http = await serverHttp();
    const res = await http.delete(`${BASE}/${pageId}/store`);
    return { ok: true, data: unwrapServer<{ linked: boolean }>(res) };
  } catch (e) {
    return { ok: false, error: toError(e) };
  }
}
```

> `BASE` is `/connect/company-pages` in this file. `listMyStorefronts()` already
> exists in `storefront.actions.ts` for the picker.

- [ ] **Step 2: Lint + commit**

```bash
cd crewroster-web && npx eslint features/connect/entities/company-page.actions.ts
git add features/connect/entities/company-page.actions.ts
git commit -m "feat(connect/web): company-page store link actions"
```

---

## Task 6: Shared store card (public + manage reuse)

**Files:**

- Create: `crewroster-web/features/connect/entities/CompanyStoreCard.tsx`

- [ ] **Step 1: Write the component**

A presentational card: logo, name, product count, up to 6 featured product
thumbnails, and a **Visit store** link to `/store/[slug]`. Uses cr- tokens.

```tsx
'use client';
/**
 * CompanyStoreCard - the attached storefront shown on a company page (public
 * Store section + Overview). Redirect-first: previews identity + a few products,
 * then sends buyers to the full storefront at /store/[slug]. Products are NEVER
 * managed here (storefront owns them). Links to: storefront public page.
 */
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { Store, ArrowRight } from 'lucide-react';
import type { Storefront } from './entities.types';
import type { Listing } from '../marketplace/marketplace.types';

export default function CompanyStoreCard({
  store,
  productCount,
  featured = [],
}: {
  store: Pick<Storefront, 'slug' | 'name' | 'logo'>;
  productCount: number;
  featured?: Listing[];
}) {
  const t = useTranslations('connect.companyPage');
  return (
    <section
      style={{
        background: 'var(--cr-surface)',
        border: '1px solid var(--cr-border)',
        borderRadius: 'var(--cr-radius-lg)',
        padding: 16,
      }}
    >
      <div className="flex items-center gap-3">
        <span
          aria-hidden
          className="grid h-11 w-11 shrink-0 place-items-center overflow-hidden"
          style={{ borderRadius: 'var(--cr-radius-md)', background: 'var(--cr-surface-3)' }}
        >
          {store.logo ? (
            // eslint-disable-next-line @next/next/no-img-element -- small store logo
            <img src={store.logo} alt="" aria-hidden className="h-full w-full object-cover" />
          ) : (
            <Store size={18} aria-hidden style={{ color: 'var(--cr-text-4)' }} />
          )}
        </span>
        <div className="min-w-0 flex-1">
          <div className="truncate text-[14px] font-bold" style={{ color: 'var(--cr-text)' }}>
            {store.name}
          </div>
          <div className="text-[12px]" style={{ color: 'var(--cr-text-4)' }}>
            {t('storeProductCount', { count: productCount })}
          </div>
        </div>
        <Link
          href={`/store/${store.slug}`}
          className="inline-flex items-center gap-1 text-[12.5px] font-semibold no-underline"
          style={{ color: 'var(--cr-primary)' }}
        >
          {t('visitStore')} <ArrowRight size={14} aria-hidden />
        </Link>
      </div>
      {featured.length > 0 && (
        <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-6">
          {featured.slice(0, 6).map((p) => (
            <Link
              key={p._id}
              href={`/store/${store.slug}`}
              className="block aspect-square overflow-hidden no-underline"
              style={{ borderRadius: 'var(--cr-radius-md)', background: 'var(--cr-surface-3)' }}
            >
              {p.images?.[0] ? (
                // eslint-disable-next-line @next/next/no-img-element -- product thumb
                <img src={p.images[0]} alt={p.title} className="h-full w-full object-cover" />
              ) : null}
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}
```

> Confirm `Listing` field names (`images`, `title`, `_id`) against
> `marketplace.types.ts` and adjust if different. If a featured-products fetch is
> not readily available, render the card without `featured` (count + Visit store
> only) and add featured in a follow-up - but prefer wiring it from the existing
> `getCompanyPageListings(pageId)` action (slice 6).

- [ ] **Step 2: Lint + commit**

```bash
npx eslint features/connect/entities/CompanyStoreCard.tsx
git add features/connect/entities/CompanyStoreCard.tsx
git commit -m "feat(connect/web): shared CompanyStoreCard (redirect-first)"
```

---

## Task 7: Attach-store picker (manage)

**Files:**

- Create: `crewroster-web/features/connect/entities/AttachStorePicker.tsx`

- [ ] **Step 1: Write the picker modal**

Lists the owner's storefronts. Selectable only when `companyPageId == null`;
already-linked stores render disabled with "Linked". Confirm -> `attachStoreToPage`.

```tsx
'use client';
/**
 * AttachStorePicker - modal to attach an EXISTING storefront to a company page.
 * Only unlinked stores (companyPageId null) are selectable; linked ones show
 * disabled. Confirm calls attachStoreToPage. Links to: storefront link endpoints.
 */
import { useEffect, useState } from 'react';
import { Modal, message } from 'antd';
import { useTranslations } from 'next-intl';
import DsButton from '@/components/ui/DsButton';
import { listMyStorefronts } from './storefront.actions';
import { attachStoreToPage } from './company-page.actions';
import type { Storefront } from './entities.types';

export default function AttachStorePicker({
  open,
  pageId,
  onClose,
  onAttached,
}: {
  open: boolean;
  pageId: string;
  onClose: () => void;
  onAttached: () => void;
}) {
  const t = useTranslations('connect.companyPage');
  const [stores, setStores] = useState<Storefront[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, ctx] = message.useMessage();

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    void listMyStorefronts().then((res) => {
      if (res.ok) setStores(res.data);
      setLoading(false);
    });
  }, [open]);

  const confirm = async () => {
    if (!selected) return;
    setSaving(true);
    const res = await attachStoreToPage(pageId, selected);
    setSaving(false);
    if (!res.ok) {
      msg.error(res.error);
      return;
    }
    onAttached();
    onClose();
  };

  return (
    <Modal
      open={open}
      onCancel={onClose}
      title={t('attachStoreTitle')}
      footer={null}
      destroyOnHidden
    >
      {ctx}
      {loading ? (
        <p className="m-0 text-[13px]" style={{ color: 'var(--cr-text-4)' }}>
          {t('loading')}
        </p>
      ) : stores.length === 0 ? (
        <p className="m-0 text-[13px]" style={{ color: 'var(--cr-text-4)' }}>
          {t('noStoresToAttach')}
        </p>
      ) : (
        <ul className="m-0 grid list-none gap-2 p-0">
          {stores.map((s) => {
            const linkedElsewhere = !!s.companyPageId;
            const active = selected === s._id;
            return (
              <li key={s._id}>
                <button
                  type="button"
                  disabled={linkedElsewhere}
                  onClick={() => setSelected(s._id)}
                  className="flex w-full items-center justify-between gap-2 rounded-[var(--cr-radius-md)] px-3 py-2 text-left"
                  style={{
                    border: `1px solid ${active ? 'var(--cr-primary)' : 'var(--cr-border)'}`,
                    background: active ? 'var(--cr-primary-light)' : 'var(--cr-surface)',
                    opacity: linkedElsewhere ? 0.5 : 1,
                    cursor: linkedElsewhere ? 'not-allowed' : 'pointer',
                  }}
                >
                  <span className="text-[13px] font-semibold" style={{ color: 'var(--cr-text)' }}>
                    {s.name}
                  </span>
                  {linkedElsewhere && (
                    <span className="text-[11.5px]" style={{ color: 'var(--cr-text-4)' }}>
                      {t('storeLinkedElsewhere')}
                    </span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      )}
      <div className="mt-4 flex justify-end gap-2">
        <DsButton dsVariant="ghost" onClick={onClose} disabled={saving}>
          {t('cancel')}
        </DsButton>
        <DsButton dsVariant="primary" onClick={confirm} loading={saving} disabled={!selected}>
          {t('attachStoreConfirm')}
        </DsButton>
      </div>
    </Modal>
  );
}
```

> Confirm `Storefront` has `companyPageId` in `entities.types.ts`; add it there if
> the web type omits it (BE has it). `cancel`/`loading` keys may already exist in
> the namespace - reuse.

- [ ] **Step 2: Lint + commit**

```bash
npx eslint features/connect/entities/AttachStorePicker.tsx
git add features/connect/entities/AttachStorePicker.tsx features/connect/entities/entities.types.ts
git commit -m "feat(connect/web): attach-store picker modal"
```

---

## Task 8: Manage console "Store" tab

**Files:**

- Create: `crewroster-web/features/connect/entities/CompanyPageStoreTab.tsx`
- Modify: `crewroster-web/features/connect/entities/ManageCompanyPageScreen.tsx`

- [ ] **Step 1: Write the Store tab component**

```tsx
'use client';
/**
 * CompanyPageStoreTab - the manage console "Store" tab. Shows the attached store
 * (Manage store -> /connect/stores/[id], Switch, Unlink) or, when none, Attach
 * existing (picker) + Create new (Start selling). Products are managed in the
 * storefront, never here. Links to: storefront link actions + /connect/stores.
 */
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { message } from 'antd';
import { Store } from 'lucide-react';
import DsButton from '@/components/ui/DsButton';
import ConnectEmptyState from '@/components/connect/ConnectEmptyState';
import AttachStorePicker from './AttachStorePicker';
import StartSellingButton from './StartSellingButton';
import { unlinkStoreFromPage } from './company-page.actions';
import type { Storefront, CompanyPage } from './entities.types';

export default function CompanyPageStoreTab({
  page,
  store,
}: {
  page: CompanyPage;
  store: Storefront | null;
}) {
  const t = useTranslations('connect.companyPage');
  const router = useRouter();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, ctx] = message.useMessage();

  const unlink = async () => {
    setBusy(true);
    const res = await unlinkStoreFromPage(page._id);
    setBusy(false);
    if (!res.ok) return msg.error(res.error);
    router.refresh();
  };

  if (!store) {
    return (
      <section>
        {ctx}
        <ConnectEmptyState
          variant="inline"
          icon={<Store size={24} aria-hidden />}
          title={t('storeEmptyTitle')}
          description={t('storeEmptyBody')}
          primaryAction={{ label: t('attachStoreCta'), onClick: () => setPickerOpen(true) }}
        />
        <div className="mt-3">
          <StartSellingButton page={page} />
        </div>
        <AttachStorePicker
          open={pickerOpen}
          pageId={page._id}
          onClose={() => setPickerOpen(false)}
          onAttached={() => router.refresh()}
        />
      </section>
    );
  }

  return (
    <section>
      {ctx}
      <div
        className="flex flex-wrap items-center justify-between gap-3 rounded-[var(--cr-radius-lg)] p-4"
        style={{ background: 'var(--cr-surface)', border: '1px solid var(--cr-border)' }}
      >
        <div className="min-w-0">
          <div className="text-[15px] font-bold" style={{ color: 'var(--cr-text)' }}>
            {store.name}
          </div>
          <div className="text-[12.5px]" style={{ color: 'var(--cr-text-4)' }}>
            {t(`storeVisibility.${store.visibility}`)}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <DsButton dsVariant="primary" href={`/connect/stores/${store._id}`}>
            {t('manageStore')}
          </DsButton>
          <DsButton dsVariant="ghost" onClick={() => setPickerOpen(true)} disabled={busy}>
            {t('switchStore')}
          </DsButton>
          <DsButton dsVariant="ghost" onClick={unlink} loading={busy}>
            {t('unlinkStore')}
          </DsButton>
        </div>
      </div>
      <p className="mt-3 text-[12.5px]" style={{ color: 'var(--cr-text-4)' }}>
        {t('storeManagedHint')}
      </p>
      <AttachStorePicker
        open={pickerOpen}
        pageId={page._id}
        onClose={() => setPickerOpen(false)}
        onAttached={() => router.refresh()}
      />
    </section>
  );
}
```

> Confirm `StartSellingButton`'s prop name (`page`); adjust if it differs.
> `Storefront.visibility` exists on the BE; ensure the web type includes it.

- [ ] **Step 2: Wire the tab into `ManageCompanyPageScreen`**

- Add `'store'` to the `ManageTab` union.
- Add a tab entry to `tabOptions` (import `Store` from lucide):
  `{ label: tabLabel(<Store size={15} />, t('tabs.store')), value: 'store' }` placed after `about`.
- Fetch the attached store. The screen is a client component fed by the page
  loader; thread `store` from the route (`app/connect/pages/[id]/page.tsx`) by
  calling `getCompanyPageStore(id)` there and passing it as a prop, OR fetch
  inside the screen with `useEffect`. Prefer the route loader (SSR, no flash):
  add `store={storeRes.ok ? storeRes.data : null}` to the screen props.
- Render `{tab === 'store' && <CompanyPageStoreTab page={page} store={store} />}`.
- Repoint the Overview "Products -> /connect/stores" hint (lines ~371-404) to set
  the active tab to `'store'` instead of linking out.

- [ ] **Step 3: Update the route loader**

In `app/connect/pages/[id]/page.tsx`, add `getCompanyPageStore(id)` to the
parallel fetch and pass `store` to `ManageCompanyPageScreen`.

- [ ] **Step 4: Lint + commit**

```bash
npx eslint features/connect/entities/CompanyPageStoreTab.tsx features/connect/entities/ManageCompanyPageScreen.tsx "app/connect/pages/[id]/page.tsx"
git add features/connect/entities/CompanyPageStoreTab.tsx features/connect/entities/ManageCompanyPageScreen.tsx "app/connect/pages/[id]/page.tsx"
git commit -m "feat(connect/web): company-page manage Store tab"
```

---

## Task 9: Public company page Store section (redirect model)

**Files:**

- Modify: `crewroster-web/features/connect/entities/CompanyPageView.tsx`
- Modify: the public company route loader (`app/connect/company/[slug]/page.tsx`)

- [ ] **Step 1: Loader - resolve the attached store + featured products**

The public view already loads `products` via `getCompanyPageListings(pageId)`.
Resolve the attached store's identity for the card. Reuse the public storefront
read: the products already carry `storefrontId`; fetch the store by the page link
through a public variant, OR derive store slug/name/logo from the first product's
storefront. Cleanest: add a public `GET /connect/company-pages/:pageId/store`
(public, returns only a `public` store's `{slug,name,logo}`) and call it.

> Add a `@Public()` sibling endpoint `GET /connect/company-pages/public/:pageId/store`
> returning the public attached store (or null), backed by
> `getAttachedStorefront(pageId, false)`. Add a web action `getPublicCompanyPageStore(pageId)`.

- [ ] **Step 2: Replace the inline products tab with the Store section**

- Drop `'products'` from `TabKey` and the tab list.
- When a public store exists, render `<CompanyStoreCard store={store} productCount={products.length} featured={products.slice(0,6)} />` as a **Store** section on Overview.
- Remove the full inline product grid (catalogue now lives on `/store/[slug]`).
- No store -> no Store section.

- [ ] **Step 3: Lint + commit**

```bash
npx eslint features/connect/entities/CompanyPageView.tsx "app/connect/company/[slug]/page.tsx"
git add features/connect/entities/CompanyPageView.tsx "app/connect/company/[slug]/page.tsx" src/... # BE public endpoint if added
git commit -m "feat(connect/web): public company page Store section + visit-store redirect"
```

> If the BE public endpoint was added, commit it in the backend repo separately
> with `git add` of the controller + a one-line action note.

---

## Task 10: i18n (4 locales)

**Files:**

- Modify: `crewroster-web/app/messages/{en,gu,gu-en,hi-en}.json`

- [ ] **Step 1: Add keys under `connect.companyPage`**

Keys (English shown; translate for gu / gu-en / hi-en, no em-dashes):
`tabs.store` = "Store", `storeEmptyTitle` = "No store attached", `storeEmptyBody`
= "Attach a store to show your products here.", `attachStoreCta` = "Attach a
store", `attachStoreTitle` = "Attach a store", `attachStoreConfirm` = "Attach",
`storeLinkedElsewhere` = "Linked to another page", `noStoresToAttach` = "You have
no unlinked stores. Create one to attach.", `manageStore` = "Manage store",
`switchStore` = "Switch store", `unlinkStore` = "Unlink", `storeManagedHint` =
"Products are managed in the store, not here.", `storeVisibility.public` =
"Public", `storeVisibility.connections` = "Connections only",
`storeVisibility.hidden` = "Hidden", `visitStore` = "Visit store",
`storeProductCount` = "{count, plural, one {# product} other {# products}}".

Use the same CRLF/2-space injection script pattern used for the jobs i18n.

- [ ] **Step 2: Parity check**

Run: `cd crewroster-web && node scripts/check-i18n.js`
Expected: `OK`.

- [ ] **Step 3: Commit**

```bash
git add app/messages/en.json app/messages/gu.json app/messages/gu-en.json app/messages/hi-en.json
git commit -m "i18n(connect): company-page store link keys (4 locales)"
```

---

## Task 11: Verify + smoke handoff

- [ ] **Step 1: Backend build + targeted tests**

```bash
cd crewroster-backend && npx nest build
npx vitest run src/modules/connect/entities/__tests__/storefront-link.vitest.ts --no-file-parallelism
```

Expected: compile clean; tests pass.

- [ ] **Step 2: Web lint (all touched files) + i18n**

```bash
cd crewroster-web && npx eslint features/connect/entities/CompanyStoreCard.tsx features/connect/entities/AttachStorePicker.tsx features/connect/entities/CompanyPageStoreTab.tsx features/connect/entities/CompanyPageView.tsx features/connect/entities/ManageCompanyPageScreen.tsx features/connect/entities/company-page.actions.ts && node scripts/check-i18n.js
```

Expected: no lint errors; i18n OK.

- [ ] **Step 3: Owner smoke (report, do not auto-run)**

Owner runs the de-dup migration, deploys, then verifies: attach an existing store
from the page Store tab; products show only via the store card + Visit store
redirect; switch store swaps the link; unlink clears it; a second page cannot
attach a store already linked; manage-store opens the storefront console.

---

## Self-review notes

- Spec coverage: schema/index (T1), de-dup (T2), service attach/unlink/get (T3),
  endpoints+DTO (T4), actions (T5), store card (T6), picker (T7), manage tab (T8),
  public redirect section (T9), i18n (T10), verify (T11). All spec sections mapped.
- Open confirmations flagged inline (Listing field names, StartSellingButton prop,
  web Storefront type fields, audit action union) - resolve at implementation by
  reading the referenced file first.
