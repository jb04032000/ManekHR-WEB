# Connect @Mentions (Tagging) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let users `@`-tag people, company pages, and storefronts in Connect posts and comments; tags render as clickable chips and notify the tagged party, under a strict "who can tag whom" safety floor.

**Architecture:** Tags are stored as a structured, render-ready array on the post/comment record (`{type, refId, display, href}`), with the body kept as plain text that literally contains each `@<display>` token. The composer's picker is the source of truth (client sends the chosen refs); the server validates each token appears in the body in order, runs the permission gates, snapshots display + computes href, dedupes recipients, and dispatches one "you were tagged" alert per recipient. Read-time hydration is free (stored mentions are already link-ready). A lightweight suggest endpoint backs the picker. A shared `MentionText` renderer order-matches `@<display>` tokens to chips across all four display surfaces.

**Tech Stack:** NestJS + Mongoose (backend), Next.js + React + Ant Design + next-intl (web), Vitest (both). Spec: `crewroster-web/docs/superpowers/specs/2026-06-16-connect-mentions-tagging-design.md`.

**Binding repo rules for the executor:**

- **No git ops by the assistant.** Every "Checkpoint" is where the OWNER stages + commits. The executing agent must NOT run `git commit`/`push`.
- **No mobile.** Web + backend only.
- **Code comments on add/modify** (intent / cross-module links / gotchas), no em-dashes in comments.
- **i18n parity gate** must stay green: add `connect.mentions.*` to all four locales.
- **Env** only via the backend env loader.

**Cross-task shared contract (use these EXACT names everywhere):**

- Backend stored shape: `Mention = { type: 'profile'|'company'|'storefront'; refId: Types.ObjectId; display: string; href: string }`.
- DTO input shape: `MentionInputDto = { type: MentionType; refId: string; display: string }` (href is computed server-side, never trusted from the client).
- Web shape: `Mention = { type: 'profile'|'company'|'storefront'; refId: string; display: string; href: string }`.
- Notification category: `'connect.post_mentioned'` (used for BOTH post and comment tags; deep-links to the post).
- Per-body cap constant: `MENTION_CAP = 10`.
- New backend module path: `src/modules/connect/mention/`.
- New web renderer: `components/connect/MentionText.tsx`. New web typeahead hook/component: `components/connect/MentionTextArea.tsx`.

---

## Phase 1 - Backend: storage, parse/resolve/gates, write-path, hydration

### Task 1.1: Shared Mention sub-schema

**Files:**

- Create: `crewroster-backend/src/modules/connect/feed/schemas/mention.subschema.ts`

- [ ] **Step 1: Write the sub-schema** (no test on its own; covered by schema-load + service tests)

```ts
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Types } from 'mongoose';

/**
 * One @mention (tag) embedded in a post or comment body (Connect feed).
 * What it does: carries a resolved, link-ready reference to a tagged entity.
 * The body keeps the literal "@<display>" text; this sub-doc lets the renderer
 * order-match each "@<display>" occurrence to a chip (chips are atomic in the
 * composer, so the body always contains the exact token - no char offsets).
 * Cross-module: refId points at a User (profile) / CompanyPage / Storefront;
 * href is the precomputed public route the chip links to (computed server-side,
 * never trusted from the client). Shared by post.schema + comment.schema.
 * Watch: display + href are snapshots; a later rename/delete is handled at
 * render time (stale display renders, dead href degrades to plain text on FE).
 */
export const MENTION_TYPES = ['profile', 'company', 'storefront'] as const;
export type MentionType = (typeof MENTION_TYPES)[number];

@Schema({ _id: false })
export class Mention {
  @Prop({ type: String, enum: MENTION_TYPES, required: true })
  type: MentionType;

  @Prop({ type: Types.ObjectId, required: true })
  refId: Types.ObjectId;

  @Prop({ type: String, required: true, trim: true, maxlength: 120 })
  display: string;

  @Prop({ type: String, required: true, trim: true, maxlength: 200 })
  href: string;
}
export const MentionSchema = SchemaFactory.createForClass(Mention);
```

- [ ] **Step 2: Checkpoint** - owner stages + commits ("feat(connect): mention sub-schema").

### Task 1.2: Add `mentions` to Post + Comment schemas

**Files:**

- Modify: `crewroster-backend/src/modules/connect/feed/schemas/post.schema.ts` (after the `hashtags` prop ~line 145; add import at top; add index near other `Schema.index` calls)
- Modify: `crewroster-backend/src/modules/connect/feed/schemas/comment.schema.ts` (add import + prop)

- [ ] **Step 1: Post schema** - add import + field + index.

Add to imports:

```ts
import { Mention, MentionSchema } from './mention.subschema';
```

Add after the `hashtags` prop:

```ts
  /** @mentions (tags) parsed from the body via the composer picker - link-ready
   *  refs to a User / CompanyPage / Storefront. See mention.subschema. */
  @Prop({ type: [MentionSchema], default: [] })
  mentions: Mention[];
```

Add near the other `PostSchema.index(...)` declarations (bottom of file):

```ts
// "Posts that tag entity X" lookup (future "mentions of me" surface). Additive;
// legacy posts simply have an empty mentions array.
PostSchema.index({ 'mentions.refId': 1, createdAt: -1 });
```

- [ ] **Step 2: Comment schema** - add import + field.

Add import `import { Mention, MentionSchema } from './mention.subschema';` and after the `body` prop:

```ts
  /** @mentions (tags) in this comment body - same shape as Post.mentions. */
  @Prop({ type: [MentionSchema], default: [] })
  mentions: Mention[];
```

- [ ] **Step 3: Verify schemas still load** - run any existing feed schema/service test.

Run: `cd crewroster-backend && npx vitest run src/modules/connect/feed`
Expected: PASS (existing tests unaffected; new field defaults to `[]`).

- [ ] **Step 4: Checkpoint** - owner stages + commits.

### Task 1.3: MentionService - resolve + gates (the core; TDD)

**Files:**

- Create: `crewroster-backend/src/modules/connect/mention/mention.service.ts`
- Create: `crewroster-backend/src/modules/connect/mention/mention.constants.ts`
- Create: `crewroster-backend/src/modules/connect/mention/__tests__/mention.service.vitest.ts`

- [ ] **Step 1: Constants**

`mention.constants.ts`:

```ts
/** Max @mentions (tags) per post or comment body - matches the hashtag cap. */
export const MENTION_CAP = 10;
```

- [ ] **Step 2: Write the failing test** (`mention.service.vitest.ts`)

```ts
/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-return */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Stub @nestjs/mongoose decorators BEFORE importing the service (vitest/esbuild
// reflection guard - see auth.service.audit.vitest.ts).
vi.mock('@nestjs/mongoose', () => {
  const noopDecorator = () => () => undefined;
  return {
    Prop: () => noopDecorator(),
    Schema: () => noopDecorator(),
    SchemaFactory: { createForClass: () => ({ index: () => undefined }) },
    InjectModel: () => () => undefined,
    getModelToken: (name: string) => `${name}Model`,
    MongooseModule: { forFeature: () => ({}) },
  };
});

import { Types } from 'mongoose';
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { MentionService } from '../mention.service';

const oid = () => new Types.ObjectId();

describe('MentionService.resolveForWrite', () => {
  const author = oid();
  const personId = oid();
  let userModel: any;
  let profileModel: any;
  let pageModel: any;
  let storefrontModel: any;
  let blockModel: any;
  let network: any;
  let svc: MentionService;

  const leanOne = (val: any) => ({
    select: () => ({ lean: () => ({ exec: () => Promise.resolve(val) }) }),
  });
  const leanMany = (val: any) => ({
    select: () => ({ lean: () => ({ exec: () => Promise.resolve(val) }) }),
  });

  beforeEach(() => {
    userModel = {
      findById: vi.fn(() => leanOne({ _id: personId, name: 'Nita Patel', handle: 'nita' })),
    };
    profileModel = { findOne: vi.fn(() => leanOne({ userId: personId, visibility: 'public' })) };
    pageModel = { findById: vi.fn() };
    storefrontModel = { findById: vi.fn() };
    blockModel = { find: vi.fn(() => leanMany([])) };
    network = { listConnections: vi.fn().mockResolvedValue([]) };
    svc = new MentionService(
      userModel,
      profileModel,
      pageModel,
      storefrontModel,
      blockModel,
      network,
    );
  });

  it('resolves a public profile mention on a public post and returns it as a recipient', async () => {
    const body = `Great work @Nita Patel!`;
    const res = await svc.resolveForWrite(
      author,
      body,
      [{ type: 'profile', refId: String(personId), display: 'Nita Patel' }],
      'public',
    );
    expect(res.stored).toHaveLength(1);
    expect(res.stored[0]).toMatchObject({
      type: 'profile',
      display: 'Nita Patel',
      href: '/connect/u/nita',
    });
    expect(res.recipientUserIds).toEqual([String(personId)]);
  });

  it('rejects when the @display token is not present in the body (order-match guard)', async () => {
    await expect(
      svc.resolveForWrite(
        author,
        'no token here',
        [{ type: 'profile', refId: String(personId), display: 'Nita Patel' }],
        'public',
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects over the cap', async () => {
    const many = Array.from({ length: 11 }, () => ({
      type: 'profile' as const,
      refId: String(oid()),
      display: 'X',
    }));
    await expect(
      svc.resolveForWrite(author, '@X'.repeat(11), many, 'public'),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects a blocked target (bidirectional)', async () => {
    blockModel.find = vi.fn(() => leanMany([{ blockerUserId: personId, blockedUserId: author }]));
    await expect(
      svc.resolveForWrite(
        author,
        'hi @Nita Patel',
        [{ type: 'profile', refId: String(personId), display: 'Nita Patel' }],
        'public',
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('rejects a hidden profile', async () => {
    profileModel.findOne = vi.fn(() => leanOne({ userId: personId, visibility: 'hidden' }));
    await expect(
      svc.resolveForWrite(
        author,
        'hi @Nita Patel',
        [{ type: 'profile', refId: String(personId), display: 'Nita Patel' }],
        'public',
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects tagging a non-connection into a connections-only post', async () => {
    await expect(
      svc.resolveForWrite(
        author,
        'hi @Nita Patel',
        [{ type: 'profile', refId: String(personId), display: 'Nita Patel' }],
        'connections',
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('allows a connection into a connections-only post', async () => {
    network.listConnections = vi.fn().mockResolvedValue([{ userId: String(personId) }]);
    const res = await svc.resolveForWrite(
      author,
      'hi @Nita Patel',
      [{ type: 'profile', refId: String(personId), display: 'Nita Patel' }],
      'connections',
    );
    expect(res.stored).toHaveLength(1);
  });

  it('does not notify a self-mention', async () => {
    userModel.findById = vi.fn(() => leanOne({ _id: author, name: 'Me', handle: 'me' }));
    profileModel.findOne = vi.fn(() => leanOne({ userId: author, visibility: 'public' }));
    const res = await svc.resolveForWrite(
      author,
      'note to @Me',
      [{ type: 'profile', refId: String(author), display: 'Me' }],
      'public',
    );
    expect(res.stored).toHaveLength(1);
    expect(res.recipientUserIds).toEqual([]);
  });

  it('resolves a company page mention and notifies the page owner', async () => {
    const pageId = oid();
    const ownerId = oid();
    pageModel.findById = vi.fn(() => leanOne({ _id: pageId, slug: 'acme', ownerUserId: ownerId }));
    const res = await svc.resolveForWrite(
      author,
      'see @Acme',
      [{ type: 'company', refId: String(pageId), display: 'Acme' }],
      'public',
    );
    expect(res.stored[0]).toMatchObject({ type: 'company', href: '/connect/company/acme' });
    expect(res.recipientUserIds).toEqual([String(ownerId)]);
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `cd crewroster-backend && npx vitest run src/modules/connect/mention`
Expected: FAIL ("Cannot find module '../mention.service'").

- [ ] **Step 4: Implement `mention.service.ts`**

```ts
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { MENTION_CAP } from './mention.constants';
import type { MentionType } from '../feed/schemas/mention.subschema';
import { NetworkService } from '../network/network.service';

/** The client-sent tag (picker is source of truth). href is computed here. */
export interface MentionInput {
  type: MentionType;
  refId: string;
  display: string;
}
/** Stored, link-ready tag (mirrors the Mention sub-schema). */
export interface StoredMention {
  type: MentionType;
  refId: Types.ObjectId;
  display: string;
  href: string;
}

/**
 * MentionService - validates + resolves @mentions (tags) for posts/comments and
 * enforces the "who can tag whom" gates. What it does: order-matches each tag's
 * "@<display>" token against the body, resolves the entity, applies block +
 * visibility + cap gates, computes the public href, dedupes notification
 * recipients (skipping self). Cross-module: reads User/ConnectProfile (people),
 * CompanyPage/Storefront (pages), UserBlock (blocks), NetworkService
 * (connections). Used by FeedService.createPost/editPost + CommentService.
 * Watch: href is a snapshot; render-time handles later rename/delete.
 */
@Injectable()
export class MentionService {
  constructor(
    @InjectModel('User') private readonly userModel: Model<any>,
    @InjectModel('ConnectProfile') private readonly profileModel: Model<any>,
    @InjectModel('CompanyPage') private readonly pageModel: Model<any>,
    @InjectModel('Storefront') private readonly storefrontModel: Model<any>,
    @InjectModel('UserBlock') private readonly blockModel: Model<any>,
    private readonly network: NetworkService,
  ) {}

  async resolveForWrite(
    authorId: Types.ObjectId,
    body: string,
    input: MentionInput[] | undefined,
    visibility: 'public' | 'connections',
  ): Promise<{ stored: StoredMention[]; recipientUserIds: string[] }> {
    if (!input || input.length === 0) return { stored: [], recipientUserIds: [] };
    if (input.length > MENTION_CAP) {
      throw new BadRequestException(`You can tag up to ${MENTION_CAP} people or pages.`);
    }

    // Order-match guard: every "@<display>" must appear in the body, in order,
    // so the FE renderer can chip each token deterministically.
    let cursor = 0;
    for (const m of input) {
      const token = `@${m.display}`;
      const idx = body.indexOf(token, cursor);
      if (idx === -1) throw new BadRequestException('A tag does not match the post text.');
      cursor = idx + token.length;
    }

    const blocked = await this.getBlockedUserIds(authorId);
    let connectionIds: Set<string> | null = null;
    const connections = async (): Promise<Set<string>> => {
      if (!connectionIds) {
        const conns = await this.network.listConnections(authorId);
        connectionIds = new Set(conns.map((c) => c.userId));
      }
      return connectionIds;
    };
    const authorStr = String(authorId);
    const canSee = async (ownerId: string): Promise<boolean> =>
      ownerId === authorStr || (await connections()).has(ownerId);

    const stored: StoredMention[] = [];
    const recipients = new Set<string>();

    for (const m of input) {
      const resolved = await this.resolveOne(m);
      if (!resolved) throw new BadRequestException('A tagged account no longer exists.');
      const { ownerUserId, href, profileVisibility } = resolved;

      // Gate B - block (bidirectional), against the entity owner.
      if (ownerUserId && blocked.has(ownerUserId)) {
        throw new ForbiddenException('You cannot tag this account.');
      }

      // Gate C - reach / visibility.
      if (m.type === 'profile') {
        if (profileVisibility === 'hidden') {
          throw new BadRequestException('This profile cannot be tagged.');
        }
        if (visibility === 'connections') {
          if (!(await canSee(ownerUserId!))) {
            throw new ForbiddenException(
              'You can only tag your connections on a connections-only post.',
            );
          }
        } else if (profileVisibility === 'connections' && !(await canSee(ownerUserId!))) {
          throw new ForbiddenException('This profile cannot be tagged.');
        }
      } else if (visibility === 'connections' && ownerUserId && !(await canSee(ownerUserId))) {
        throw new ForbiddenException(
          'You can only tag pages whose owner is a connection on a connections-only post.',
        );
      }

      stored.push({ type: m.type, refId: new Types.ObjectId(m.refId), display: m.display, href });
      // Gate D - skip self, dedupe recipients.
      if (ownerUserId && ownerUserId !== authorStr) recipients.add(ownerUserId);
    }

    return { stored, recipientUserIds: [...recipients] };
  }

  /** All user ids blocked in EITHER direction relative to `viewer`. */
  private async getBlockedUserIds(viewer: Types.ObjectId): Promise<Set<string>> {
    const rows = await this.blockModel
      .find({ $or: [{ blockerUserId: viewer }, { blockedUserId: viewer }] })
      .select('blockerUserId blockedUserId')
      .lean()
      .exec();
    const set = new Set<string>();
    for (const r of rows as Array<{
      blockerUserId: Types.ObjectId;
      blockedUserId: Types.ObjectId;
    }>) {
      set.add(String(r.blockerUserId.equals(viewer) ? r.blockedUserId : r.blockerUserId));
    }
    return set;
  }

  /** Resolve one tag to its owner + public href + (people) profile visibility. */
  private async resolveOne(
    m: MentionInput,
  ): Promise<{ ownerUserId: string | null; href: string; profileVisibility?: string } | null> {
    if (!Types.ObjectId.isValid(m.refId)) return null;
    const refId = new Types.ObjectId(m.refId);
    if (m.type === 'profile') {
      const [user, profile] = await Promise.all([
        this.userModel.findById(refId).select('handle').lean().exec(),
        this.profileModel.findOne({ userId: refId }).select('visibility').lean().exec(),
      ]);
      if (!user || !profile) return null;
      const slug = (user as { handle?: string }).handle || String(refId);
      return {
        ownerUserId: String(refId),
        href: `/connect/u/${slug}`,
        profileVisibility: (profile as { visibility?: string }).visibility ?? 'public',
      };
    }
    if (m.type === 'company') {
      const page = await this.pageModel.findById(refId).select('slug ownerUserId').lean().exec();
      if (!page) return null;
      const p = page as { slug: string; ownerUserId?: Types.ObjectId };
      return {
        ownerUserId: p.ownerUserId ? String(p.ownerUserId) : null,
        href: `/connect/company/${p.slug}`,
      };
    }
    // storefront
    const store = await this.storefrontModel
      .findById(refId)
      .select('slug ownerUserId')
      .lean()
      .exec();
    if (!store) return null;
    const s = store as { slug: string; ownerUserId?: Types.ObjectId };
    return {
      ownerUserId: s.ownerUserId ? String(s.ownerUserId) : null,
      href: `/connect/store/${s.slug}`,
    };
  }
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd crewroster-backend && npx vitest run src/modules/connect/mention`
Expected: PASS (9 tests).

- [ ] **Step 6: Create the module** `crewroster-backend/src/modules/connect/mention/mention.module.ts`

```ts
import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { MentionService } from './mention.service';
import { NetworkModule } from '../network/network.module';

// Mention resolution + gates. Reuses the User/ConnectProfile/CompanyPage/
// Storefront/UserBlock collections (registered globally via their own modules,
// re-declared here with forFeature) + NetworkService for connection checks.
// Consumed by ConnectFeedModule (post + comment write paths) and the suggest
// endpoint (Phase 3). Keep model names in sync with their schema class names.
@Module({
  imports: [NetworkModule, MongooseModule.forFeature([{ name: 'User', schema: {} as never }])],
  providers: [MentionService],
  exports: [MentionService],
})
export class MentionModule {}
```

NOTE for the executor: the `forFeature` schema wiring above is a placeholder shape - register the SAME schema objects the feed/profile/entities modules already register (import the real `UserSchema`, `ConnectProfileSchema`, `CompanyPageSchema`, `StorefrontSchema`, `UserBlockSchema` and list them all in one `forFeature`). Mirror exactly how `ConnectFeedModule` imports these models today (check `connect-feed.module.ts`). Do NOT invent new model tokens.

- [ ] **Step 7: Run the suite again + Checkpoint**

Run: `cd crewroster-backend && npx vitest run src/modules/connect/mention`
Expected: PASS. Then owner stages + commits.

### Task 1.4: Wire MentionService into the post write path

**Files:**

- Modify: `crewroster-backend/src/modules/connect/feed/feed.service.ts` (interface ~79-109; createPost ~388-473; editPost ~641-688; toPage passthrough; constructor inject)
- Modify: `crewroster-backend/src/modules/connect/feed/dto/feed.dto.ts` (add MentionInputDto + field on CreatePostDto/EditPostDto)
- Modify: `crewroster-backend/src/modules/connect/feed/connect-feed.module.ts` (import MentionModule)
- Test: `crewroster-backend/src/modules/connect/feed/__tests__/feed.service.mentions.vitest.ts`

- [ ] **Step 1: DTO** - add to `feed.dto.ts` (mirror the existing nested `PostMediaDto` `@ValidateNested`/`@Type` pattern already used in `CreatePostDto`):

```ts
import { MENTION_TYPES, type MentionType } from '../schemas/mention.subschema';
// (existing imports: IsArray, IsOptional, IsString, MaxLength, ValidateNested, ArrayMaxSize, IsIn, IsMongoId, Type)

export class MentionInputDto {
  @IsIn(MENTION_TYPES)
  type: MentionType;

  @IsMongoId()
  refId: string;

  @IsString()
  @MaxLength(120)
  display: string;
}
```

Add to `CreatePostDto` AND `EditPostDto`:

```ts
  /** @mentions (tags) the composer picker produced. href computed server-side. */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @ValidateNested({ each: true })
  @Type(() => MentionInputDto)
  mentions?: MentionInputDto[];
```

- [ ] **Step 2: FeedPost interface** - add `mentions` so it flows through `toPage`'s `...p` spread:

In the `FeedPost` interface (after `hashtags`/`tags`):

```ts
  /** @mentions (tags) - link-ready refs stored on the post. */
  mentions: import('./schemas/mention.subschema').Mention[];
```

- [ ] **Step 3: Inject MentionService** in the FeedService constructor (add a `private readonly mentions: MentionService` param) and import it.

- [ ] **Step 4: createPost** - resolve + store + notify. After the hashtag line (`const hashtags = ...`), add:

```ts
const visibility = dto.visibility ?? 'public';
const { stored: mentions, recipientUserIds } = await this.mentions.resolveForWrite(
  author,
  body,
  dto.mentions,
  visibility,
);
```

Add `mentions,` to the `this.postModel.create({ ... })` object. After `this.emitPostChanged(post._id, 'created');`, add (best-effort notify; dispatched in Phase 2 helper):

```ts
this.notifyMentioned(recipientUserIds, author, String(post._id), body);
```

(`notifyMentioned` is added in Phase 2, Task 2.2. Until then, stub it as a private no-op method to keep this task self-compiling: `private notifyMentioned(_ids: string[], _actor: Types.ObjectId, _postId: string, _body: string): void {}` and replace its body in Phase 2.)

- [ ] **Step 5: editPost** - re-resolve on body change + notify newly added. Inside the `if (dto.body !== undefined)` block, after the hashtag re-parse line, add:

```ts
const before = new Set((post.mentions ?? []).map((m) => String(m.refId)));
const { stored, recipientUserIds } = await this.mentions.resolveForWrite(
  this.toObjectId(userId),
  body,
  dto.mentions,
  dto.visibility ?? post.visibility,
);
post.mentions = stored as never;
// Notify only NEWLY added recipients (never re-ping existing tags on edit).
const fresh = recipientUserIds.filter((id) => !before.has(id));
this.notifyMentioned(fresh, this.toObjectId(userId), String(post._id), body);
```

- [ ] **Step 6: Write the failing integration-ish test** (`feed.service.mentions.vitest.ts`) using the established @nestjs/mongoose mock pattern; assert createPost stores the resolved mentions returned by a mocked MentionService and calls `postModel.create` with them. (Mirror the mock setup from `auth.service.audit.vitest.ts`; mock `MentionService.resolveForWrite` to return `{ stored: [{type:'profile',refId,display:'X',href:'/connect/u/x'}], recipientUserIds: ['u1'] }` and assert it appears in the `create` arg.)

```ts
// ... @nestjs/mongoose stub + imports ...
it('stores resolved mentions on create', async () => {
  const create = vi
    .fn()
    .mockResolvedValue({ _id: new Types.ObjectId(), createdAt: new Date(), visibility: 'public' });
  // wire postModel.create = create; mentions.resolveForWrite returns one stored mention + one recipient
  // call svc.createPost(author, { kind: 'text', body: 'hi @X', mentions: [{type:'profile',refId,display:'X'}] })
  // expect(create).toHaveBeenCalledWith(expect.objectContaining({ mentions: [expect.objectContaining({ display: 'X' })] }))
});
```

(Executor: expand this to a full test following the auth-test mock scaffold; assert `mentions` passed to `create` and `notifyMentioned`/dispatch called for the recipient.)

- [ ] **Step 7: Run** `cd crewroster-backend && npx vitest run src/modules/connect/feed` - Expected: PASS.

- [ ] **Step 8: Module wiring** - add `MentionModule` to `connect-feed.module.ts` imports.

- [ ] **Step 9: Build check** `cd crewroster-backend && npm run build` - Expected: SWC build clean.

- [ ] **Step 10: Checkpoint** - owner stages + commits.

### Task 1.5: Wire MentionService into the comment write path

**Files:**

- Modify: `crewroster-backend/src/modules/connect/feed/comment.service.ts` (addComment ~67-177; listComments LeanComment type)
- Modify: `crewroster-backend/src/modules/connect/feed/dto/feed.dto.ts` (CreateCommentDto + `mentions`)
- Modify: `crewroster-backend/src/modules/connect/feed/feed.controller.ts` (pass `dto.mentions` into `addComment`)
- Test: extend `comment.service` tests

- [ ] **Step 1: DTO** - add the same `mentions?: MentionInputDto[]` block (from Task 1.4 Step 1) to `CreateCommentDto`.

- [ ] **Step 2: addComment signature + body** - change signature to accept mentions and the post visibility for the gate:

```ts
  async addComment(
    userId: string | Types.ObjectId,
    postId: string,
    body: string,
    parentId?: string,
    mentions?: MentionInput[],
  ): Promise<Comment> {
```

After `requireLivePost` (which returns the post, including `visibility` + `authorId`), before `commentModel.create`, resolve:

```ts
const { stored: resolvedMentions, recipientUserIds } = await this.mentions.resolveForWrite(
  commenterId,
  body.trim(),
  mentions,
  post.visibility,
);
```

(move `const commenterId = this.toObjectId(userId);` above this if needed). Add `mentions: resolvedMentions,` to the `commentModel.create({...})` object.

After the existing post-author + parent-author dispatches, add the mention dispatch, skipping already-notified parties to avoid double-pings:

```ts
// Tag alerts: notify each tagged party once. Skip self, the post author,
// and the parent-comment author (all already handled above) so one comment
// never double-pings the same person. Best-effort - never blocks the write.
const alreadyNotified = new Set<string>([
  String(commenterId),
  String(post.authorId),
  ...(parentAuthorId ? [String(parentAuthorId)] : []),
]);
for (const rid of recipientUserIds) {
  if (alreadyNotified.has(rid)) continue;
  void this.notificationsService
    .dispatch({
      recipientId: rid,
      actorId: commenterId,
      category: 'connect.post_mentioned',
      entityType: 'Post',
      entityId: postId,
      title: 'You were mentioned',
      message: body.trim().slice(0, 140),
      batchMessage: (count) => `${count} people mentioned you.`,
    })
    .catch(() => undefined);
}
```

Inject `MentionService` into `CommentService` (constructor + import; `comment.service` is in `ConnectFeedModule`, which now imports `MentionModule`).

- [ ] **Step 3: listComments hydration** - extend the `LeanComment` type with `mentions?: Mention[]`. No mapping change needed (lean returns the field; it flows through `[...top, ...replies]`).

- [ ] **Step 4: Controller** - pass `dto.mentions` into the `addComment` call in `feed.controller.ts`.

- [ ] **Step 5: Test + run** - add a comment-mentions test (mirror Task 1.4 Step 6). Run `cd crewroster-backend && npx vitest run src/modules/connect/feed`. Expected: PASS.

- [ ] **Step 6: Build + Checkpoint** - `npm run build`; owner stages + commits.

---

## Phase 2 - Backend: notifications

### Task 2.1: Register the `connect.post_mentioned` category

**Files:**

- Modify: `crewroster-backend/src/modules/notifications/notification-categories.ts`
- Modify: `crewroster-backend/src/modules/notifications/notifications.service.ts` (BATCHABLE_CATEGORIES)

- [ ] **Step 1:** In `NOTIFICATION_CATEGORIES`, after `'connect.post_replied',` add:

```ts
  // Connect - feed: fired when a user is @mentioned (tagged) in a post or
  // comment. Recipient = the tagged user (or a tagged page/storefront's owner);
  // actor = the tagger. User-toggleable + batchable. Keep in sync with
  // FeedService.notifyMentioned + CommentService mention dispatch + the web
  // notification-presentation route map.
  'connect.post_mentioned',
```

- [ ] **Step 2:** In `USER_TOGGLEABLE_CATEGORIES`, after `'connect.post_replied',` add `'connect.post_mentioned',`.

- [ ] **Step 3:** In `notifications.service.ts` `BATCHABLE_CATEGORIES`, add `'connect.post_mentioned',`.

- [ ] **Step 4: Test** - add a unit assertion that the category is present + toggleable + batchable (extend any existing notification-categories test, or add `notification-categories.mentions.vitest.ts`):

```ts
import { describe, it, expect } from 'vitest';
import { NOTIFICATION_CATEGORIES, USER_TOGGLEABLE_CATEGORIES } from '../notification-categories';
describe('connect.post_mentioned category', () => {
  it('is registered + toggleable', () => {
    expect(NOTIFICATION_CATEGORIES).toContain('connect.post_mentioned');
    expect(USER_TOGGLEABLE_CATEGORIES).toContain('connect.post_mentioned');
  });
});
```

Run: `cd crewroster-backend && npx vitest run src/modules/notifications`. Expected: PASS.

- [ ] **Step 5: Checkpoint.**

### Task 2.2: `notifyMentioned` helper in FeedService

**Files:**

- Modify: `crewroster-backend/src/modules/connect/feed/feed.service.ts`

- [ ] **Step 1:** Replace the Task 1.4 stub with the real helper:

```ts
  /** Fire one "you were tagged" alert per recipient (best-effort, batchable).
   *  Recipients are pre-deduped + self-skipped by MentionService. Links: feed ->
   *  notifications (connect.post_mentioned). Never blocks the post write. */
  private notifyMentioned(
    recipientUserIds: string[],
    actorId: Types.ObjectId,
    postId: string,
    body: string,
  ): void {
    for (const rid of recipientUserIds) {
      void this.notificationsService
        .dispatch({
          recipientId: rid,
          actorId,
          category: 'connect.post_mentioned',
          entityType: 'Post',
          entityId: postId,
          title: 'You were mentioned',
          message: body.trim().slice(0, 140),
          batchMessage: (count) => `${count} people mentioned you.`,
        })
        .catch(() => undefined);
    }
  }
```

(Ensure `NotificationsService` is injected in FeedService - it may already be; if not, add it + import, and confirm `ConnectFeedModule` imports `NotificationsModule`.)

- [ ] **Step 2: Test** - extend `feed.service.mentions.vitest.ts`: assert `notificationsService.dispatch` is called once per recipient with `category: 'connect.post_mentioned'`. Run the feed suite. Expected: PASS.

- [ ] **Step 3: Checkpoint.**

### Task 2.3: Web notification routing for the new category

**Files:**

- Modify: `crewroster-web/features/connect/notifications/notification-presentation.ts`
- Test: `crewroster-web/features/connect/notifications/notification-presentation.mentions.vitest.ts` (or extend existing)

- [ ] **Step 1:** In `tagKeyOf()`, after the `post_replied` case add:

```ts
    case 'connect.post_mentioned':
      return 'mention';
```

In `primaryAction()`, after the `post_commented`/`post_replied` case add:

```ts
    case 'connect.post_mentioned':
      return {
        labelKey: 'actions.viewPost',
        href: n.entityId ? `/connect/posts/${n.entityId}` : '/connect/feed',
      };
```

(`groupOf()` already routes `connect.post_*` to `feed` - no change.)

- [ ] **Step 2: Test** - assert `groupOf` returns `'feed'`, `tagKeyOf` returns `'mention'`, and `primaryAction` deep-links for a `connect.post_mentioned` item. Run: `cd crewroster-web && npx vitest run features/connect/notifications`. Expected: PASS.

- [ ] **Step 3: i18n** - add `mention` to the notifications tag strings + ensure `actions.viewPost` exists (it does). Covered fully in Phase 6.

- [ ] **Step 4: Checkpoint.**

---

## Phase 3 - Backend: lightweight suggest endpoint (picker)

> v1 uses a direct indexed Mongo prefix query over the three public collections (simple, exact, fast at current scale). A later optimization can route this through the existing Meili search indexes; the response shape stays identical so the FE never changes.

### Task 3.1: MentionSuggestService + controller

**Files:**

- Create: `crewroster-backend/src/modules/connect/mention/mention-suggest.service.ts`
- Create: `crewroster-backend/src/modules/connect/mention/mention.controller.ts`
- Create: `crewroster-backend/src/modules/connect/mention/dto/suggest.dto.ts`
- Create: `crewroster-backend/src/modules/connect/mention/__tests__/mention-suggest.service.vitest.ts`
- Modify: `mention.module.ts` (declare the controller + service)

- [ ] **Step 1: DTO** (`suggest.dto.ts`)

```ts
import { IsOptional, IsString, MaxLength, MinLength, IsIn } from 'class-validator';
export const MENTION_SCOPES = ['all', 'people', 'companies', 'storefronts'] as const;
export type MentionScope = (typeof MENTION_SCOPES)[number];
export class SuggestQueryDto {
  @IsString()
  @MinLength(1)
  @MaxLength(60)
  q: string;

  @IsOptional()
  @IsIn(MENTION_SCOPES)
  scope?: MentionScope;
}
```

- [ ] **Step 2: Failing test** (`mention-suggest.service.vitest.ts`) - mock the three models + block model; assert it returns compact `{type,id,display,href,avatar}` rows, excludes self + blocked, and respects scope. (Mirror the @nestjs/mongoose stub + lean-chain mock helpers from Task 1.3.)

- [ ] **Step 3: Implement `mention-suggest.service.ts`**

```ts
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import type { MentionScope } from './dto/suggest.dto';

export interface MentionSuggestion {
  type: 'profile' | 'company' | 'storefront';
  id: string;
  display: string;
  href: string;
  avatar: string | null;
}

const PER_TYPE = 6;
/** Escape user text for a safe prefix regex (anchored, case-insensitive). */
function prefix(q: string): RegExp {
  return new RegExp('^' + q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
}

/**
 * MentionSuggestService - backs the composer @-picker. What it does: fast,
 * compact prefix search over public people + company pages + storefronts,
 * excluding the viewer + anyone blocked either way. Returns only what a chip
 * needs. Cross-module: reads User/ConnectProfile, CompanyPage, Storefront,
 * UserBlock. Watch: keep the public filters identical to the search helpers
 * (page-search.helpers / storefront-search.helpers) so the picker never
 * surfaces something the search would hide.
 */
@Injectable()
export class MentionSuggestService {
  constructor(
    @InjectModel('User') private readonly userModel: Model<any>,
    @InjectModel('ConnectProfile') private readonly profileModel: Model<any>,
    @InjectModel('CompanyPage') private readonly pageModel: Model<any>,
    @InjectModel('Storefront') private readonly storefrontModel: Model<any>,
    @InjectModel('UserBlock') private readonly blockModel: Model<any>,
  ) {}

  async suggest(
    viewerId: string,
    q: string,
    scope: MentionScope = 'all',
  ): Promise<MentionSuggestion[]> {
    const rx = prefix(q.trim());
    if (!q.trim()) return [];
    const blocked = await this.getBlockedUserIds(new Types.ObjectId(viewerId));
    const out: MentionSuggestion[] = [];

    if (scope === 'all' || scope === 'people') {
      const users = (await this.userModel
        .find({ $or: [{ name: rx }, { handle: rx }] })
        .select('_id name handle profilePicture')
        .limit(PER_TYPE * 3)
        .lean()
        .exec()) as Array<{
        _id: Types.ObjectId;
        name: string;
        handle?: string;
        profilePicture?: string;
      }>;
      const ids = users.map((u) => u._id);
      const publicProfiles = (await this.profileModel
        .find({ userId: { $in: ids }, visibility: 'public' })
        .select('userId')
        .lean()
        .exec()) as Array<{ userId: Types.ObjectId }>;
      const publicSet = new Set(publicProfiles.map((p) => String(p.userId)));
      for (const u of users) {
        const id = String(u._id);
        if (id === viewerId || blocked.has(id) || !publicSet.has(id)) continue;
        out.push({
          type: 'profile',
          id,
          display: u.name,
          href: `/connect/u/${u.handle || id}`,
          avatar: u.profilePicture ?? null,
        });
        if (out.filter((r) => r.type === 'profile').length >= PER_TYPE) break;
      }
    }
    if (scope === 'all' || scope === 'companies') {
      const pages = (await this.pageModel
        .find({ name: rx, visibility: 'public' }) // EXECUTOR: match page-search.helpers public filter
        .select('_id name slug logo')
        .limit(PER_TYPE)
        .lean()
        .exec()) as Array<{ _id: Types.ObjectId; name: string; slug: string; logo?: string }>;
      for (const p of pages) {
        out.push({
          type: 'company',
          id: String(p._id),
          display: p.name,
          href: `/connect/company/${p.slug}`,
          avatar: p.logo ?? null,
        });
      }
    }
    if (scope === 'all' || scope === 'storefronts') {
      const stores = (await this.storefrontModel
        .find({ name: rx, visibility: 'public' }) // EXECUTOR: match storefront-search.helpers public filter
        .select('_id name slug logo')
        .limit(PER_TYPE)
        .lean()
        .exec()) as Array<{ _id: Types.ObjectId; name: string; slug: string; logo?: string }>;
      for (const s of stores) {
        out.push({
          type: 'storefront',
          id: String(s._id),
          display: s.name,
          href: `/connect/store/${s.slug}`,
          avatar: s.logo ?? null,
        });
      }
    }
    return out;
  }

  private async getBlockedUserIds(viewer: Types.ObjectId): Promise<Set<string>> {
    const rows = (await this.blockModel
      .find({ $or: [{ blockerUserId: viewer }, { blockedUserId: viewer }] })
      .select('blockerUserId blockedUserId')
      .lean()
      .exec()) as Array<{ blockerUserId: Types.ObjectId; blockedUserId: Types.ObjectId }>;
    const set = new Set<string>();
    for (const r of rows)
      set.add(String(r.blockerUserId.equals(viewer) ? r.blockedUserId : r.blockerUserId));
    return set;
  }
}
```

- [ ] **Step 4: Controller** (`mention.controller.ts`) - JWT-guarded + throttled, mirroring the search controller's guard/throttle pattern:

```ts
import { Controller, Get, Query, UseGuards, Req } from '@nestjs/common';
import { JwtAuthGuard } from '../../../auth/guards/jwt-auth.guard'; // EXECUTOR: confirm path used by search.controller
import { ConnectSearchThrottlerGuard } from '../search/connect-search-throttler.guard';
import { MentionSuggestService } from './mention-suggest.service';
import { SuggestQueryDto } from './dto/suggest.dto';

// Composer @-picker source. GET /connect/mention/suggest?q=&scope=. Reuses the
// search throttler (typing fires many calls). Returns compact suggestions only.
@Controller('connect/mention')
@UseGuards(JwtAuthGuard)
export class MentionController {
  constructor(private readonly suggest: MentionSuggestService) {}

  @Get('suggest')
  @UseGuards(ConnectSearchThrottlerGuard)
  async getSuggestions(@Req() req: { user: { sub: string } }, @Query() dto: SuggestQueryDto) {
    return this.suggest.suggest(req.user.sub, dto.q, dto.scope ?? 'all');
  }
}
```

EXECUTOR: confirm the JWT guard import path + the `req.user` shape from how `search.controller.ts` does it, and register `MentionController` + `MentionSuggestService` in `mention.module.ts`.

- [ ] **Step 5: Run** `cd crewroster-backend && npx vitest run src/modules/connect/mention` + `npm run build`. Expected: PASS + clean.

- [ ] **Step 6: Checkpoint.**

---

## Phase 4 - Web: types, actions, renderer, render-site swaps

### Task 4.1: Types + actions

**Files:**

- Modify: `crewroster-web/features/connect/feed.types.ts`
- Modify: `crewroster-web/features/connect/feed.actions.ts`
- Create: `crewroster-web/features/connect/mention.actions.ts`

- [ ] **Step 1:** Add the shared type to `feed.types.ts` (top, near other shared types):

```ts
/** A resolved @mention (tag) - link-ready, mirrors the backend Mention shape. */
export interface Mention {
  type: 'profile' | 'company' | 'storefront';
  refId: string;
  display: string;
  href: string;
}
```

Add `mentions?: Mention[];` to: `FeedPost`, `FeedComment`, `ActivityComment`. Add `mentions?: { type: Mention['type']; refId: string; display: string }[];` to `CreatePostInput` and `EditPostInput` (input omits href - server computes it).

- [ ] **Step 2:** `addComment` action - extend signature + payload:

```ts
export async function addComment(
  postId: string,
  body: string,
  parentId?: string,
  mentions?: { type: 'profile' | 'company' | 'storefront'; refId: string; display: string }[],
): Promise<ActionResult<{ id: string }>> {
  // ... in the POST body: { body, ...(parentId ? { parentId } : {}), ...(mentions?.length ? { mentions } : {}) }
}
```

(`createPost`/`editPost` already forward the whole input object, so the new `mentions` field flows automatically once it is on the input types.)

- [ ] **Step 3:** New `mention.actions.ts` - the picker fetch:

```ts
'use server';
import { serverHttp, unwrapServer, toError, type ActionResult } from './http'; // EXECUTOR: match how feed.actions imports these
import type { MentionScope } from './feed.types';

export interface MentionSuggestion {
  type: 'profile' | 'company' | 'storefront';
  id: string;
  display: string;
  href: string;
  avatar: string | null;
}

/** Composer @-picker fetch. Links: backend GET /connect/mention/suggest. */
export async function suggestMentions(
  q: string,
  scope: 'all' | 'people' | 'companies' | 'storefronts' = 'all',
): Promise<ActionResult<MentionSuggestion[]>> {
  try {
    const http = await serverHttp();
    const res = await http.get(`/connect/mention/suggest`, { params: { q, scope } });
    return { ok: true, data: unwrapServer<MentionSuggestion[]>(res) };
  } catch (e) {
    return { ok: false, error: toError(e) };
  }
}
```

EXECUTOR: match the exact import sources/`BASE` prefix used at the top of `feed.actions.ts`.

- [ ] **Step 4: Checkpoint.**

### Task 4.2: `MentionText` renderer (TDD)

**Files:**

- Create: `crewroster-web/components/connect/MentionText.tsx`
- Create: `crewroster-web/components/connect/MentionText.test.tsx`

- [ ] **Step 1: Failing test**

```tsx
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import MentionText from './MentionText';

describe('MentionText', () => {
  it('renders plain text unchanged when there are no mentions', () => {
    render(<MentionText text="hello world" />);
    expect(screen.getByText('hello world')).toBeInTheDocument();
  });

  it('renders an @display token as a link to its href', () => {
    render(
      <MentionText
        text="hi @Nita Patel welcome"
        mentions={[
          { type: 'profile', refId: 'u1', display: 'Nita Patel', href: '/connect/u/nita' },
        ]}
      />,
    );
    const link = screen.getByRole('link', { name: '@Nita Patel' });
    expect(link).toHaveAttribute('href', '/connect/u/nita');
  });

  it('order-matches duplicate display names left to right', () => {
    render(
      <MentionText
        text="@A and @A again"
        mentions={[
          { type: 'profile', refId: 'u1', display: 'A', href: '/connect/u/a1' },
          { type: 'profile', refId: 'u2', display: 'A', href: '/connect/u/a2' },
        ]}
      />,
    );
    const links = screen.getAllByRole('link');
    expect(links[0]).toHaveAttribute('href', '/connect/u/a1');
    expect(links[1]).toHaveAttribute('href', '/connect/u/a2');
  });

  it('renders a mention as plain text when its href is empty (deleted entity)', () => {
    render(
      <MentionText
        text="bye @Gone"
        mentions={[{ type: 'profile', refId: 'x', display: 'Gone', href: '' }]}
      />,
    );
    expect(screen.queryByRole('link')).toBeNull();
    expect(screen.getByText(/@Gone/)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run** `cd crewroster-web && npx vitest run components/connect/MentionText.test.tsx` - Expected: FAIL.

- [ ] **Step 3: Implement `MentionText.tsx`** (Server-Component-safe: no hooks, just `next/link`):

```tsx
import Link from 'next/link';
import type { Mention } from '@/features/connect/feed.types';

/**
 * MentionText - renders a plain-text post/comment body, turning each tag's
 * "@<display>" token into a clickable chip linking to the tagged entity. What it
 * does: walks the body once, order-matching each mention's "@<display>" to the
 * next occurrence (chips are atomic in the composer, so the token is always
 * present). Cross-module: consumes feed.types Mention; used by PostCard,
 * PublicPostView, PostComments, ActivityCommentList. Watch: a mention with an
 * empty href (deleted/renamed entity) renders as plain text, never a dead link.
 * No raw HTML is produced (XSS-safe) - only text nodes + next/link elements.
 */
export default function MentionText({ text, mentions }: { text: string; mentions?: Mention[] }) {
  if (!mentions || mentions.length === 0) {
    return <span style={{ whiteSpace: 'pre-wrap' }}>{text}</span>;
  }
  const nodes: React.ReactNode[] = [];
  let cursor = 0;
  let key = 0;
  for (const m of mentions) {
    const token = `@${m.display}`;
    const idx = text.indexOf(token, cursor);
    if (idx === -1) continue; // body edited out of sync; skip gracefully
    if (idx > cursor) nodes.push(<span key={key++}>{text.slice(cursor, idx)}</span>);
    if (m.href) {
      nodes.push(
        <Link
          key={key++}
          href={m.href}
          style={{ color: 'var(--cr-primary, #4f46e5)', fontWeight: 600 }}
          onClick={(e) => e.stopPropagation()}
        >
          {token}
        </Link>,
      );
    } else {
      nodes.push(<span key={key++}>{token}</span>);
    }
    cursor = idx + token.length;
  }
  if (cursor < text.length) nodes.push(<span key={key++}>{text.slice(cursor)}</span>);
  return <span style={{ whiteSpace: 'pre-wrap' }}>{nodes}</span>;
}
```

- [ ] **Step 4: Run** the test - Expected: PASS (4 tests).

- [ ] **Step 5: Checkpoint.**

### Task 4.3: Swap the four render sites to `MentionText`

**Files:**

- Modify: `crewroster-web/components/connect/PostCard.tsx` (~885-896)
- Modify: `crewroster-web/components/connect/PublicPostView.tsx` (~65-78)
- Modify: `crewroster-web/features/connect/feed/PostComments.tsx` (~147-156)
- Modify: `crewroster-web/features/connect/profile/ActivityCommentList.tsx` (~76-86)

- [ ] **Step 1: PostCard** - import `MentionText` and replace `{body}` inside the body `<p>` with:

```tsx
<MentionText text={body} mentions={post.mentions} />
```

(Keep the `<p>` wrapper + its styles; `MentionText` renders an inline span. Remove `whiteSpace: 'pre-wrap'` from the `<p>` only if duplicated - `MentionText` already applies it; leaving it is harmless.)

- [ ] **Step 2: PublicPostView** - same swap: `<MentionText text={post.body} mentions={post.mentions} />`.

- [ ] **Step 3: PostComments** (`renderComment`) - replace `{comment.body}` with `<MentionText text={comment.body} mentions={comment.mentions} />`.

- [ ] **Step 4: ActivityCommentList** - replace `{comment.body}` with `<MentionText text={comment.body} mentions={comment.mentions} />`.

- [ ] **Step 5: Typecheck** `cd crewroster-web && npx tsc --noEmit` (or scoped) - Expected: 0 errors in touched files.

- [ ] **Step 6: Checkpoint.**

---

## Phase 5 - Web: composer @-typeahead

### Task 5.1: `MentionTextArea` (shared @-aware input)

**Files:**

- Create: `crewroster-web/components/connect/MentionTextArea.tsx`
- Create: `crewroster-web/components/connect/MentionTextArea.test.tsx`

A controlled wrapper around Ant `Input.TextArea` that: detects an `@<query>` being typed at the caret, calls `suggestMentions`, shows a dropdown, and on select inserts `@<display> ` while recording the chosen `{type, refId, display}` in a parallel mentions list. Chips are atomic: on every change it re-derives the live mentions list by keeping only those whose `@<display>` token still appears in the text (so deleting any part of the token drops the tag).

- [ ] **Step 1: Failing test** - render, type `@ni`, assert `suggestMentions` (mocked) is called and selecting a row calls `onChange` with body containing `@Nita Patel` and the mentions array containing that ref.

- [ ] **Step 2: Implement** (props: `value: string`, `mentions: PickedMention[]`, `onChange(value, mentions)`, plus passthrough `placeholder`, `maxLength`, `autoSize`, `aria-label`, `scope`). Key behaviors:
  - On change, compute the active `@token` immediately before the caret (regex `/@([^\s@]{1,40})$/` on `value.slice(0, caret)`); if present and length >= 1, debounce-call `suggestMentions(query, scope)` and open the dropdown; else close it.
  - Reconcile mentions on every change: `next = mentions.filter((m) => value.includes('@' + m.display))` (drops tags whose token was edited away). This enforces atomic chips without a rich editor.
  - On select: replace the active `@query` with `@<display> `, append the picked `{type, refId, display}` to mentions, fire `onChange`.
  - Keyboard: ArrowUp/Down to move highlight, Enter/Tab to select, Escape to close; full `role="listbox"`/`option` + `aria-activedescendant` (WCAG AA).

(Executor: model the dropdown styling on the existing `ConnectSearchBar.tsx` results dropdown; reuse `ConnectAvatar` for the row avatar.)

- [ ] **Step 3: Run** the test - Expected: PASS.

- [ ] **Step 4: Checkpoint.**

### Task 5.2: Use `MentionTextArea` in the post composer

**Files:**

- Modify: `crewroster-web/components/connect/Composer.tsx` (state ~80; textarea ~253-260; submit ~147-196)

- [ ] **Step 1:** Add state: `const [mentions, setMentions] = useState<{ type: 'profile'|'company'|'storefront'; refId: string; display: string }[]>([]);`
- [ ] **Step 2:** Replace the `<Input.TextArea ... value={body} onChange=...>` with:

```tsx
<MentionTextArea
  value={body}
  mentions={mentions}
  onChange={(v, m) => {
    setBody(v);
    setMentions(m);
  }}
  placeholder={t('placeholder')}
  autoSize={{ minRows: 3, maxRows: 10 }}
  maxLength={MAX_BODY}
  aria-label={t('bodyLabel')}
/>
```

- [ ] **Step 3:** In `submit`, add `mentions: mentions.length ? mentions : undefined,` to the `createPost({ ... })` payload, and add `mentions` to the `useCallback` deps. In `reset`, clear `setMentions([])`.
- [ ] **Step 4: Typecheck + Checkpoint.**

### Task 5.3: Use `MentionTextArea` in the comment box

**Files:**

- Modify: `crewroster-web/features/connect/feed/PostComments.tsx` (`CommentBox` ~238-279; the `onSubmit` plumbing)

- [ ] **Step 1:** Change `CommentBox`'s `onSubmit` to `(body, mentions) => Promise<boolean>`; track a local `mentions` state; replace the `<Input.TextArea>` with `<MentionTextArea ... onChange={(v,m)=>{setBody(v);setMentions(m);}} />`; pass `mentions` to `onSubmit`; clear on success.
- [ ] **Step 2:** Update the parent caller of `CommentBox` to forward `mentions` into `addComment(postId, body, parentId, mentions)`.
- [ ] **Step 3: Typecheck** `npx tsc --noEmit` + run `npx vitest run features/connect/feed` - Expected: PASS.
- [ ] **Step 4: Checkpoint.**

---

## Phase 6 - Cross-cutting: i18n, analytics, final gates

### Task 6.1: i18n (all four locales)

**Files:**

- Modify: `crewroster-web/app/messages/en.json` (add `connect.mentions.*` + `connect.notifications.tag.mention`)
- Modify: `crewroster-web/app/messages/gu.json`, `gu-en.json`, `hi-en.json` (same keys, translated)

- [ ] **Step 1:** Add to `en.json` under `connect` (sibling of `share`):

```json
    "mentions": {
      "trigger": "Tag people or pages",
      "searching": "Searching...",
      "noResults": "No matches",
      "people": "People",
      "companies": "Pages",
      "storefronts": "Shops",
      "capReached": "You can tag up to {max} people or pages."
    }
```

And add the notifications tag label `"mention": "Mention"` to the existing `connect.notifications.tag` object (key path used by `tagKeyOf`).

- [ ] **Step 2:** Add the SAME keys (translated, non-empty) to `gu.json`, `gu-en.json`, `hi-en.json`. (gu = Gujarati; gu-en/hi-en = romanized Gujarati/Hindi.)
- [ ] **Step 3: Run the parity gate** `cd crewroster-web && npx vitest run app/messages/locale-parity.vitest.ts` and `npm run check:i18n` - Expected: PASS (no missing keys, no blanks).
- [ ] **Step 4: Checkpoint.**

### Task 6.2: Analytics events

**Files:**

- Modify: `crewroster-web/lib/analytics-events.ts`
- Wire calls in `MentionTextArea` (picker opened/selected) + `MentionText` (chip clicked)

- [ ] **Step 1:** Add to `ConnectEvents`:

```ts
  /** The @-picker opened in a composer (post or comment). */
  mentionPickerOpened: 'connect.mentions.picker_opened',
  /** A tag was inserted from the picker. `entity` = which type. */
  mentionAdded: 'connect.mentions.added',
  /** A rendered mention chip was clicked through. `entity` = which type. */
  mentionClicked: 'connect.mentions.clicked',
```

Add to `ConnectEventProps` (no PII - type + surface only):

```ts
  'connect.mentions.picker_opened': { surface: 'post' | 'comment' };
  'connect.mentions.added': { entity: 'profile' | 'company' | 'storefront'; surface: 'post' | 'comment' };
  'connect.mentions.clicked': { entity: 'profile' | 'company' | 'storefront' };
```

- [ ] **Step 2:** Call `trackEvent(ConnectEvents.mentionAdded, { entity: m.type, surface })` on select in `MentionTextArea`; `trackEvent(ConnectEvents.mentionPickerOpened, { surface })` when the dropdown first opens; `trackEvent(ConnectEvents.mentionClicked, { entity: m.type })` in the `MentionText` chip `onClick`.
- [ ] **Step 3: Test** - add an events test (mirror `connect-limit.vitest.ts` / `CtaButton.vitest.tsx`): spy the analytics sink, assert the picker-select fires `mentionAdded` with the right shape. Run the relevant vitest. Expected: PASS.
- [ ] **Step 4: Checkpoint.**

### Task 6.3: Full verification gates

- [ ] **Step 1: Backend** `cd crewroster-backend && npx vitest run src/modules/connect/mention src/modules/connect/feed src/modules/notifications` - Expected: all PASS.
- [ ] **Step 2: Backend build** `npm run build` - Expected: SWC clean.
- [ ] **Step 3: Web** `cd crewroster-web && npx vitest run components/connect features/connect app/messages` - Expected: all PASS.
- [ ] **Step 4: Web typecheck + lint** `npx tsc --noEmit` (or scoped) + `npx eslint <changed files> --max-warnings=0` - Expected: 0 errors.
- [ ] **Step 5: i18n** `npm run check:i18n` - Expected: PASS.
- [ ] **Step 6: Manual smoke (owner, with the app running):** create a post tagging a person + a page; verify the chip links through; verify the tagged person gets one alert and can turn it off; verify you cannot tag someone who blocked you; verify tagging a non-connection into a connections-only post is refused; verify the cap message at the 11th tag.
- [ ] **Step 7: Final checkpoint** - owner stages + commits the full feature.

---

## Self-review (spec coverage)

- Tag people + company pages + storefronts -> Tasks 1.1-1.3 (resolve all three), 3.1 (suggest all three), 4.1/4.2/4.3 (render all three).
- Posts AND comments -> Tasks 1.4 (post), 1.5 (comment), 5.2 (post composer), 5.3 (comment box).
- Clickable chip -> Task 4.2/4.3.
- "You were tagged" alert + opt-out -> Tasks 2.1-2.3 (category is user-toggleable = opt-out via existing prefs UI).
- Who-can-tag-whom matrix -> Task 1.3 (block bidirectional, connections-only reach, hidden not taggable, self-skip, cap) with tests for each gate.
- Reach = anyone on public posts -> Task 1.3 public branch (no network restriction on public posts; only block + hidden gates).
- Lightweight picker -> Phase 3.
- i18n 4 locales / analytics / audit-safe / tests -> Phase 6 + per-task tests.
- Deferred (not in this plan, per spec): "mentions of me" surface, mobile, multi-admin page routing, DMs, per-user "who may tag me" setting.

**Placeholder note:** Two spots are intentionally marked `EXECUTOR:` where an exact import path / public-filter field must be confirmed against a named existing file (JWT guard path + req.user shape from `search.controller.ts`; the public filter in `page-search.helpers.ts` / `storefront-search.helpers.ts`; the `forFeature` model list from `connect-feed.module.ts`). These are confirm-against-named-file steps, not invented code.
