# Connect Referral Program Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let any Connect user share a referral link/code; when a referred friend becomes an active user, both sides earn admin-configurable boost credits (held briefly, then spendable), surfaced on a dedicated page + boost page + profile, with full admin controls and a log.

**Architecture:** New backend module `connect/referrals` mirroring `connect/institutes` (first-touch attribution on the `connect.profile.created` event) and `connect/ads` (singleton admin-config + audited writes). Referral credits land in the existing `AdvertiserWallet` via a new `referral` ledger type so free credits stay distinguishable from bought/granted credits. Web adds a dedicated `/connect/referrals` page, entry points, signup capture, and an admin editor + log, all gated by a kill switch and an admin `enabled` flag (ship off).

**Tech Stack:** NestJS + Mongoose + `@nestjs/event-emitter` + `@nestjs/schedule` + vitest (backend); Next.js App Router + React + AntD v6 + next-intl + server actions + vitest (web).

**Binding repo rules (read before coding):**

- Backend: env via `src/config/env.ts` only; every endpoint `JwtAuthGuard` (or `@Public()`) + class-validator DTO + throttler tier; audit every admin write via `AuditService.logEvent` with the right `AppModule`; Sentry/OTel/PostHog patterns; tests colocated `*.vitest.ts` under `__tests__/`.
- Web: every data route ships a co-located `loading.tsx` mirroring the page; AntD **v6** APIs only (no banned legacy forms); add the file-header code comment (what / cross-module links / watch) on every file touched.
- **Both repos: assistant does NOT run git (`feedback_no_git_ops`).** The "Commit" steps below are written for the OWNER to run, or for the executor to surface as a ready-to-stage diff. Work stays on the current branch (no new branch).
- **This is a NEW feature, not polish** — it is a logical change (new schema/endpoints/money-path). Per both CLAUDE.md files it needs explicit owner go-ahead before build, and the wallet ledger change (Task 6) is the sharpest gate.

**Spec:** `docs/superpowers/specs/2026-06-18-connect-referral-program-design.md`

---

## File structure (created / modified)

**Backend — new module `crewroster-backend/src/modules/connect/referrals/`:**

- `schemas/connect-referral-config.schema.ts` — singleton admin config (mirror `connect-pricing-config.schema.ts`).
- `schemas/connect-referral.schema.ts` — one row per referred person (tracking + audit).
- `dto/admin-referral-config.dto.ts` — admin config write DTO.
- `services/connect-referral-config.service.ts` — get/update + guardrails + audit + cache (mirror `connect-pricing-config.service.ts`).
- `services/referral.service.ts` — code gen, attribution, qualify (event), release (cron), summary, admin log + clawback.
- `referral-code.util.ts` — collision-safe code generator.
- `controllers/referral.controller.ts` — `GET /connect/referrals/me`.
- `controllers/referral-admin.controller.ts` — admin config + log + clawback.
- `events/` — reuse existing `CONNECT_PROFILE_CREATED`; no new event needed.
- `connect-referrals.module.ts` — wiring.
- `__tests__/*.vitest.ts` — per service/controller.

**Backend — modified:**

- `src/modules/connect/ads/schemas/ad-wallet-ledger.schema.ts` — add `referral` to `type` enum.
- `src/modules/connect/ads/services/wallet.service.ts` — add `creditReferral(...)`.
- `src/modules/users/schemas/user.schema.ts` — add `referralCode`, `referredByUserId`.
- `src/modules/auth/dto/auth.dto.ts` — add optional `referralCode` to `RegisterDto` (+ SMS verify DTO).
- `src/modules/auth/auth.service.ts` (+ sms-otp path) — best-effort `attachReferralAtSignup` call.
- The Connect feature module + `AdminModule` surface — import `ConnectReferralsModule`.

**Web — new `crewroster-web/features/connect/referrals/`:**

- `referrals.types.ts`, `referral-gate.ts`, `referrals.actions.ts`, `ReferralScreen.tsx`, `AdminReferralEditor.tsx`, `ReferralLogTable.tsx`.
- `app/connect/referrals/page.tsx` + `app/connect/referrals/loading.tsx`.
- `app/admin/connect/referrals/page.tsx`.

**Web — modified:**

- `components/connect/ConnectModuleNav.tsx` — "Refer & earn" nav item.
- `features/connect/ads/BoostsManagerScreen.tsx` — reminder card.
- `app/connect/profile/OwnProfileClient.tsx` (or `ProfileView.tsx`) — profile entry.
- `app/auth/AuthClient.tsx` + `components/auth/modes/SignupMode.tsx` — `?ref=` capture + code field.
- `components/layout/AdminLayout.tsx` — admin nav item.
- `app/messages/{en,gu,gu-en,hi-en}.json` — `connect.referrals.*` + signup + admin keys.

---

## PHASE 1 — Backend admin config (the levers)

### Task 1: `ConnectReferralConfig` singleton schema

**Files:**

- Create: `crewroster-backend/src/modules/connect/referrals/schemas/connect-referral-config.schema.ts`

- [ ] **Step 1: Write the schema** (mirror `connect-pricing-config.schema.ts` exactly — singleton `key:'default'`, defaults constant, view interface)

```ts
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

/**
 * Connect Referrals -- `ConnectReferralConfig` singleton.
 * What: platform-wide referral levers the admin tunes WITHOUT a deploy (credit
 *   per side, holdback, caps, velocity, master on/off).
 * Cross-module links: read by ReferralService (qualify/release decisions) +
 *   referral-admin controller; written by AdminReferralController. Mirrors
 *   ConnectPricingConfig (single doc, key:'default', platform-wide, no workspaceId).
 * Watch: amounts are SNAPSHOTTED onto ConnectReferral at qualify time, so changing
 *   a value here never re-prices an already-qualified referral -- only future ones.
 */
@Schema({ timestamps: true, collection: 'connect_referral_configs' })
export class ConnectReferralConfig extends Document {
  @Prop({ type: String, required: true, unique: true, default: 'default' })
  key: string;

  /** Master on/off. Ships OFF; admin flips on after legal sign-off + smoke. */
  @Prop({ type: Boolean, required: true, default: false })
  enabled: boolean;

  /** Credits the referrer earns per qualified referral (whole credits = rupees). */
  @Prop({ type: Number, required: true, default: 50, min: 0 })
  referrerCredits: number;

  /** Credits the new joiner earns. */
  @Prop({ type: Number, required: true, default: 50, min: 0 })
  refereeCredits: number;

  /** Days a qualified credit is held before it becomes spendable. */
  @Prop({ type: Number, required: true, default: 7, min: 0 })
  holdbackDays: number;

  /** Max REWARDED referrals per referrer, lifetime. 0 = unlimited. */
  @Prop({ type: Number, required: true, default: 0, min: 0 })
  perReferrerCap: number;

  /** Max rewarded referrals per referrer per calendar month. 0 = unlimited. */
  @Prop({ type: Number, required: true, default: 0, min: 0 })
  monthlyPerReferrerCap: number;

  /** Max referral credits a single user can EARN per financial year (194R guard). 0 = unlimited. */
  @Prop({ type: Number, required: true, default: 19000, min: 0 })
  annualCreditCeilingPerUser: number;

  /** Program-wide ceiling on total credits granted; auto-pause when hit. 0 = unlimited. */
  @Prop({ type: Number, required: true, default: 0, min: 0 })
  totalBudgetCap: number;

  /** Max referrals attributed to one referrer per 24h. 0 = unlimited. */
  @Prop({ type: Number, required: true, default: 10, min: 0 })
  dailyVelocityPerReferrer: number;

  createdAt?: Date;
  updatedAt?: Date;
}

export type ConnectReferralConfigDocument = ConnectReferralConfig & Document;
export const ConnectReferralConfigSchema = SchemaFactory.createForClass(ConnectReferralConfig);

/** Shipped defaults (seed + fallback + test snapshot). Keep in sync with @Prop defaults. */
export const CONNECT_REFERRAL_DEFAULTS = {
  enabled: false,
  referrerCredits: 50,
  refereeCredits: 50,
  holdbackDays: 7,
  perReferrerCap: 0,
  monthlyPerReferrerCap: 0,
  annualCreditCeilingPerUser: 19000,
  totalBudgetCap: 0,
  dailyVelocityPerReferrer: 10,
} as const;

/** Public-safe read shape (no Mongo metadata). */
export interface ConnectReferralConfigView {
  enabled: boolean;
  referrerCredits: number;
  refereeCredits: number;
  holdbackDays: number;
  perReferrerCap: number;
  monthlyPerReferrerCap: number;
  annualCreditCeilingPerUser: number;
  totalBudgetCap: number;
  dailyVelocityPerReferrer: number;
}
```

- [ ] **Step 2: Commit** (owner): `feat(connect-referrals): referral config singleton schema`

### Task 2: `AdminReferralConfigDto`

**Files:**

- Create: `crewroster-backend/src/modules/connect/referrals/dto/admin-referral-config.dto.ts`

- [ ] **Step 1: Write the DTO** (shape validation only; real bounds live in the service, like `AdminPricingConfigDto`)

```ts
import { IsBoolean, IsInt, Min } from 'class-validator';

/** Admin write shape for ConnectReferralConfig. Bounds enforced in the service. */
export class AdminReferralConfigDto {
  @IsBoolean() enabled: boolean;
  @IsInt() @Min(0) referrerCredits: number;
  @IsInt() @Min(0) refereeCredits: number;
  @IsInt() @Min(0) holdbackDays: number;
  @IsInt() @Min(0) perReferrerCap: number;
  @IsInt() @Min(0) monthlyPerReferrerCap: number;
  @IsInt() @Min(0) annualCreditCeilingPerUser: number;
  @IsInt() @Min(0) totalBudgetCap: number;
  @IsInt() @Min(0) dailyVelocityPerReferrer: number;
}
```

### Task 3: `ConnectReferralConfigService` (get/update + guardrails + audit + cache)

**Files:**

- Create: `crewroster-backend/src/modules/connect/referrals/services/connect-referral-config.service.ts`
- Test: `crewroster-backend/src/modules/connect/referrals/__tests__/connect-referral-config.service.vitest.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BadRequestException } from '@nestjs/common';
import { ConnectReferralConfigService } from '../services/connect-referral-config.service';
import { CONNECT_REFERRAL_DEFAULTS } from '../schemas/connect-referral-config.schema';

function makeModel(doc: any) {
  return {
    findOneAndUpdate: vi.fn().mockReturnValue({ exec: vi.fn().mockResolvedValue(doc) }),
  } as any;
}
const audit = { logEvent: vi.fn().mockResolvedValue(undefined) } as any;

describe('ConnectReferralConfigService', () => {
  beforeEach(() => vi.clearAllMocks());

  it('upserts + returns defaults on first read', async () => {
    const doc = { _id: 'x', ...CONNECT_REFERRAL_DEFAULTS };
    const svc = new ConnectReferralConfigService(makeModel(doc), audit);
    const view = await svc.getConfig(1000);
    expect(view.referrerCredits).toBe(50);
    expect(view.enabled).toBe(false);
  });

  it('rejects holdbackDays above guardrail', async () => {
    const svc = new ConnectReferralConfigService(makeModel({}), audit);
    await expect(
      svc.updateConfig({ ...CONNECT_REFERRAL_DEFAULTS, holdbackDays: 1000 } as any, 'admin1'),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('writes + audits a valid update', async () => {
    const doc = { _id: 'cfg1', ...CONNECT_REFERRAL_DEFAULTS, referrerCredits: 100 };
    const svc = new ConnectReferralConfigService(makeModel(doc), audit);
    const view = await svc.updateConfig(
      { ...CONNECT_REFERRAL_DEFAULTS, referrerCredits: 100 } as any,
      'admin1',
    );
    expect(view.referrerCredits).toBe(100);
    expect(audit.logEvent).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'referral_config_updated', actorId: 'admin1' }),
    );
  });
});
```

- [ ] **Step 2: Run + verify fail** — `cd crewroster-backend && npx vitest run src/modules/connect/referrals/__tests__/connect-referral-config.service.vitest.ts` → FAIL (module not found).

- [ ] **Step 3: Implement** (mirror `ConnectPricingConfigService`; guardrails table below)

```ts
import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  ConnectReferralConfig,
  type ConnectReferralConfigDocument,
  type ConnectReferralConfigView,
  CONNECT_REFERRAL_DEFAULTS,
} from '../schemas/connect-referral-config.schema';
import { AuditService } from '../../../audit/audit.service';
import { AppModule } from '../../../../common/enums/modules.enum';
import type { AdminReferralConfigDto } from '../dto/admin-referral-config.dto';

const SINGLETON_KEY = 'default';

// Hard safety rails. Admin tunes live values WITHIN these (no deploy).
const G = {
  creditMax: 10_000,
  holdbackMax: 90,
  capMax: 1_000_000,
  ceilingMax: 10_000_000,
  budgetMax: 1_000_000_000,
  velocityMax: 1_000,
} as const;

/**
 * Reads + writes the single ConnectReferralConfig lever doc. Mirrors
 * ConnectPricingConfigService (60s cache busted on write, audited writes,
 * upsert-on-read). Injected by ReferralService + the admin controller.
 */
@Injectable()
export class ConnectReferralConfigService {
  private readonly logger = new Logger(ConnectReferralConfigService.name);
  private static readonly CACHE_TTL_MS = 60_000;
  private cached: { view: ConnectReferralConfigView; at: number } | null = null;

  constructor(
    @InjectModel(ConnectReferralConfig.name)
    private readonly model: Model<ConnectReferralConfigDocument>,
    private readonly audit: AuditService,
  ) {}

  async getConfig(nowMs: number = Date.now()): Promise<ConnectReferralConfigView> {
    if (this.cached && nowMs - this.cached.at < ConnectReferralConfigService.CACHE_TTL_MS) {
      return this.cached.view;
    }
    const doc = await this.model
      .findOneAndUpdate(
        { key: SINGLETON_KEY },
        { $setOnInsert: { key: SINGLETON_KEY, ...CONNECT_REFERRAL_DEFAULTS } },
        { new: true, upsert: true },
      )
      .exec();
    const view = this.toView(doc);
    this.cached = { view, at: nowMs };
    return view;
  }

  async updateConfig(
    dto: AdminReferralConfigDto,
    adminUserId: string,
  ): Promise<ConnectReferralConfigView> {
    const next = this.validate(dto);
    const doc = await this.model
      .findOneAndUpdate(
        { key: SINGLETON_KEY },
        { $set: next, $setOnInsert: { key: SINGLETON_KEY } },
        { new: true, upsert: true },
      )
      .exec();
    this.cached = null;
    await this.audit.logEvent({
      module: AppModule.ADS,
      entityType: 'ConnectReferralConfig',
      entityId: String(doc._id),
      action: 'referral_config_updated',
      actorId: adminUserId,
      meta: { ...next },
    });
    this.logger.log(`Connect referral config updated by admin=${adminUserId}`);
    return this.toView(doc);
  }

  private toView(doc: ConnectReferralConfigDocument): ConnectReferralConfigView {
    return {
      enabled: doc.enabled,
      referrerCredits: doc.referrerCredits,
      refereeCredits: doc.refereeCredits,
      holdbackDays: doc.holdbackDays,
      perReferrerCap: doc.perReferrerCap,
      monthlyPerReferrerCap: doc.monthlyPerReferrerCap,
      annualCreditCeilingPerUser: doc.annualCreditCeilingPerUser,
      totalBudgetCap: doc.totalBudgetCap,
      dailyVelocityPerReferrer: doc.dailyVelocityPerReferrer,
    };
  }

  private validate(dto: AdminReferralConfigDto): ConnectReferralConfigView {
    const bounded = (label: string, v: number, max: number): number => {
      if (!Number.isInteger(v) || v < 0 || v > max) {
        throw new BadRequestException(`${label} must be an integer between 0 and ${max}`);
      }
      return v;
    };
    return {
      enabled: !!dto.enabled,
      referrerCredits: bounded('referrerCredits', dto.referrerCredits, G.creditMax),
      refereeCredits: bounded('refereeCredits', dto.refereeCredits, G.creditMax),
      holdbackDays: bounded('holdbackDays', dto.holdbackDays, G.holdbackMax),
      perReferrerCap: bounded('perReferrerCap', dto.perReferrerCap, G.capMax),
      monthlyPerReferrerCap: bounded('monthlyPerReferrerCap', dto.monthlyPerReferrerCap, G.capMax),
      annualCreditCeilingPerUser: bounded(
        'annualCreditCeilingPerUser',
        dto.annualCreditCeilingPerUser,
        G.ceilingMax,
      ),
      totalBudgetCap: bounded('totalBudgetCap', dto.totalBudgetCap, G.budgetMax),
      dailyVelocityPerReferrer: bounded(
        'dailyVelocityPerReferrer',
        dto.dailyVelocityPerReferrer,
        G.velocityMax,
      ),
    };
  }
}
```

- [ ] **Step 4: Run + verify pass.** **Step 5: Commit** (owner): `feat(connect-referrals): admin referral config service + dto`

---

## PHASE 2 — Backend data model

### Task 4: `ConnectReferral` schema

**Files:**

- Create: `crewroster-backend/src/modules/connect/referrals/schemas/connect-referral.schema.ts`

- [ ] **Step 1: Write the schema**

```ts
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type ReferralStatus = 'pending' | 'qualified' | 'rewarded' | 'rejected';

/**
 * Connect Referrals -- one row per referred person (tracking + audit).
 * What: lifecycle pending -> qualified (active, credit on hold) -> rewarded
 *   (credited, spendable); or rejected (cap/fraud/clawback).
 * Cross-module links: referrer/referee -> User; referrerLedgerId/refereeLedgerId
 *   -> AdWalletLedger (the granted credit rows). Powers /connect/referrals/me
 *   stats + the admin log.
 * Watch: refereeUserId is UNIQUE (each person referred at most once). Amounts are
 *   snapshotted at qualify time -- never re-read from live config when rewarding.
 */
@Schema({ timestamps: true, collection: 'connect_referrals' })
export class ConnectReferral extends Document {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  referrerUserId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true, unique: true })
  refereeUserId: Types.ObjectId;

  @Prop({ type: String, required: true })
  codeUsed: string;

  @Prop({
    type: String,
    enum: ['pending', 'qualified', 'rewarded', 'rejected'],
    required: true,
    default: 'pending',
  })
  status: ReferralStatus;

  @Prop({ type: String })
  rejectionReason?: string; // self_referral | duplicate | cap_exceeded | budget_exceeded | velocity | fraud_review | manual_clawback

  @Prop({ type: Number, default: 0 })
  referrerCreditAmount: number;

  @Prop({ type: Number, default: 0 })
  refereeCreditAmount: number;

  @Prop({ type: Date })
  qualifiedAt?: Date;

  @Prop({ type: Date })
  rewardedAt?: Date;

  @Prop({ type: Types.ObjectId, ref: 'AdWalletLedger' })
  referrerLedgerId?: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'AdWalletLedger' })
  refereeLedgerId?: Types.ObjectId;

  @Prop({ type: Object })
  signupContext?: {
    ipHash?: string;
    deviceHash?: string;
    refereeMobileSnapshot?: string;
    refereeEmailSnapshot?: string;
  };

  createdAt?: Date;
  updatedAt?: Date;
}

export type ConnectReferralDocument = ConnectReferral & Document;
export const ConnectReferralSchema = SchemaFactory.createForClass(ConnectReferral);

ConnectReferralSchema.index({ referrerUserId: 1, createdAt: -1 });
ConnectReferralSchema.index({ status: 1, qualifiedAt: 1 }); // release cron scan
```

### Task 5: `User` schema additions

**Files:**

- Modify: `crewroster-backend/src/modules/users/schemas/user.schema.ts` (add two props near `invitedByCompanyPageId`, line ~185)

- [ ] **Step 1: Add props** (sparse indexes — null-safe, like the existing identity fields)

```ts
  /** The user's own shareable referral code. Set lazily on first share/visit.
   *  Cross-module: ConnectReferral.codeUsed resolves back to this user. */
  @Prop({ type: String, index: { unique: true, sparse: true } })
  referralCode?: string;

  /** Who referred this user. Set ONCE at signup, immutable (first-code-wins).
   *  Mirrors invitedByCompanyPageId. */
  @Prop({ type: Types.ObjectId, ref: 'User', default: null })
  referredByUserId?: Types.ObjectId | null;
```

- [ ] **Step 2: Commit** (owner): `feat(connect-referrals): referral row schema + user referral fields`

---

## PHASE 3 — Wallet integration (LOGICAL money-path change — owner approval gate)

### Task 6: `referral` ledger type + `WalletService.creditReferral`

**Files:**

- Modify: `crewroster-backend/src/modules/connect/ads/schemas/ad-wallet-ledger.schema.ts` (add `'referral'` to the `type` enum array, line ~30-41)
- Modify: `crewroster-backend/src/modules/connect/ads/services/wallet.service.ts` (add method)
- Test: `crewroster-backend/src/modules/connect/ads/__tests__/wallet.service.referral.vitest.ts`

- [ ] **Step 1: Add enum value** — insert `'referral',` into the ledger `type` enum with a comment: `// Connect referral reward (free credits, kept distinct from topup/grant for tax/records).`

- [ ] **Step 2: Write the failing test** — assert `creditReferral` adds to `balance`, writes a `type:'referral'` ledger row with the idempotency key, and is a no-op on duplicate key (reads back the prior row). Mirror the existing wallet test setup (`wallet.service.*.vitest.ts`).

```ts
// Core assertions (adapt to the existing wallet test harness/mocks):
// 1) creditReferral(userId, 50, { idempotencyKey:'referral:R1:referrer', referralId:'R1', recordedBy:'sys' })
//    -> wallet.balance increases by 50; one AdWalletLedger row { type:'referral', amount:50, idempotencyKey } returned.
// 2) calling again with the SAME idempotencyKey -> no second balance change; returns the existing ledger row id.
```

- [ ] **Step 3: Implement `creditReferral`** — follow the existing claim-first / guarded-write + idempotency pattern in `wallet.service.ts` (`adjust`/`debit` are the references). Shape:

```ts
/**
 * Credit a referral reward into the permanent `balance` bucket and write a
 * `type:'referral'` ledger row. Idempotent on idempotencyKey (partial unique
 * index) so the release cron can retry safely. Distinct ledger type so free
 * referral credits stay separable from topup/grant/adjustment for tax/records.
 * Cross-module: called by ReferralService.releaseHeldReferrals; clawback uses adjust().
 */
async creditReferral(
  userId: string,
  amount: number,
  opts: { idempotencyKey: string; referralId?: string; recordedBy?: string },
): Promise<{ ledgerId: string; balanceAfter: number }> {
  // 1. Validate amount > 0 (BadRequestException otherwise).
  // 2. Pre-insert the ledger row claiming opts.idempotencyKey (catch 11000 -> return existing row, no-op).
  // 3. Guarded $inc of wallet.balance by +amount (upsert wallet if absent).
  // 4. Finalize ledger { type:'referral', amount, balanceAfter, reservedAfter, recordedBy, note:`referral:${referralId}` }.
  // 5. Emit PostHog `ads.referral_credit` { userId, amount, balanceAfter } + return { ledgerId, balanceAfter }.
}
```

- [ ] **Step 4: Run + verify pass.** **Step 5: Commit** (owner): `feat(ads-wallet): referral ledger type + creditReferral (idempotent)`

---

## PHASE 4 — Referral service

### Task 7: referral code generator + `getOrCreateMyCode`

**Files:**

- Create: `crewroster-backend/src/modules/connect/referrals/referral-code.util.ts`
- Test: `crewroster-backend/src/modules/connect/referrals/__tests__/referral-code.util.vitest.ts`

- [ ] **Step 1: Write the failing test** — `generateReferralCode('Rajesh Patel')` returns 6-10 chars, uppercase, no ambiguous glyphs (`[0O1lI]` absent), starts with an alpha stem from the name.

```ts
import { describe, it, expect } from 'vitest';
import { generateReferralCode } from '../referral-code.util';

it('produces a clean 6-10 char code', () => {
  const code = generateReferralCode('Rajesh Patel', () => 0.5);
  expect(code).toMatch(/^[A-Z2-9]{6,10}$/);
  expect(code).not.toMatch(/[0O1lI]/);
});
```

- [ ] **Step 2: Implement**

```ts
/** Build a shareable code: name/handle stem + random base32 suffix.
 *  No ambiguous glyphs (0/O/1/l/I). rng injectable for deterministic tests. */
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; // no 0 O 1 I L
export function generateReferralCode(seed: string, rng: () => number = Math.random): string {
  const stem =
    (seed || 'CR')
      .toUpperCase()
      .replace(/[^A-Z]/g, '')
      .slice(0, 4) || 'CR';
  let suffix = '';
  for (let i = 0; i < 4; i++) suffix += ALPHABET[Math.floor(rng() * ALPHABET.length)];
  return (stem + suffix).slice(0, 10);
}
```

- [ ] **Step 3:** In `referral.service.ts`, `getOrCreateMyCode(userId)`: return existing `User.referralCode`; else generate from name/handle and persist with a retry loop on the unique-index `E11000` (regenerate suffix on collision, max ~5 tries). Test the collision retry with a mocked userModel that throws 11000 once.

### Task 8: `attachReferralAtSignup` (attribution + anti-fraud)

**Files:**

- Modify: `referral.service.ts`
- Test: `crewroster-backend/src/modules/connect/referrals/__tests__/referral.service.attach.vitest.ts`

- [ ] **Step 1: Failing tests** — cover: (a) disabled config → no-op; (b) unknown code → no-op; (c) self-referral (code belongs to the referee, or shared mobile) → no row, reason logged; (d) referee already has `referredByUserId` → no-op; (e) happy path → creates `ConnectReferral{status:'pending'}` + sets `User.referredByUserId` once; (f) never throws even if a DB call rejects.

- [ ] **Step 2: Implement** (best-effort, never throws — mirror `InstituteReferralService` defensiveness)

```ts
/** Bind a referral at signup. Best-effort: wrapped so it NEVER blocks auth.
 *  Cross-module: called by AuthService.register (+ sms verify) after user+session
 *  exist. First-code-wins: referredByUserId set once via conditional update. */
async attachReferralAtSignup(input: {
  refereeUserId: string;
  code?: string | null;
  signupContext?: ConnectReferral['signupContext'];
}): Promise<void> {
  try {
    const code = (input.code || '').trim().toUpperCase();
    if (!code) return;
    const cfg = await this.configService.getConfig();
    if (!cfg.enabled) return;
    const referrer = await this.userModel.findOne({ referralCode: code })
      .select('_id mobile email status').lean().exec();
    if (!referrer) return;
    if (String(referrer._id) === input.refereeUserId) return; // self
    const referee = await this.userModel.findById(input.refereeUserId)
      .select('mobile email referredByUserId').lean().exec();
    if (!referee || referee.referredByUserId != null) return; // once-only
    // self-referral by shared identity:
    if (referrer.mobile && referrer.mobile === referee.mobile) return;
    if (referrer.email && referee.email && referrer.email === referee.email) return;
    // daily velocity pre-check (referrals attributed to this referrer in last 24h):
    if (cfg.dailyVelocityPerReferrer > 0) {
      const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const recent = await this.referralModel.countDocuments({ referrerUserId: referrer._id, createdAt: { $gt: since } });
      if (recent >= cfg.dailyVelocityPerReferrer) return;
    }
    // set referredByUserId once (atomic gate), then create the pending row.
    const stamp = await this.userModel.updateOne(
      { _id: input.refereeUserId, referredByUserId: null },
      { $set: { referredByUserId: referrer._id } },
    ).exec();
    if ((stamp.modifiedCount ?? 0) === 0) return;
    await this.referralModel.create({
      referrerUserId: referrer._id,
      refereeUserId: new Types.ObjectId(input.refereeUserId),
      codeUsed: code,
      status: 'pending',
      signupContext: input.signupContext,
    });
  } catch (err) {
    this.logger.warn(`attachReferralAtSignup failed: ${err instanceof Error ? err.message : String(err)}`);
    Sentry.captureException(err, { tags: { module: 'connect.referral', op: 'attachAtSignup' } });
  }
}
```

> Note: disposable-email blocklist + MX check are an additive guard inside this method — add a small `isDisposableEmail(email)` helper (static list file) and skip attribution if the referee email is disposable. Keep the list in `referrals/disposable-domains.ts`.

### Task 9: `qualifyReferral` (activation event listener)

**Files:**

- Modify: `referral.service.ts`
- Test: `referral.service.qualify.vitest.ts`

- [ ] **Step 1: Failing tests** — on `connect.profile.created` for a referee with a `pending` row: status → `qualified`, `qualifiedAt` set, amounts snapshotted from live config; if no pending row → no-op; never throws.

- [ ] **Step 2: Implement**

```ts
/** Mark the referee's pending referral as qualified (credit earned, on hold).
 *  Cross-module: listens to CONNECT_PROFILE_CREATED (same event institutes use).
 *  Phone already OTP-verified at signup, so first profile = first real action. */
@OnEvent(CONNECT_PROFILE_CREATED)
async onProfileCreated(ev: ConnectProfileCreatedEvent): Promise<void> {
  try {
    if (!ev?.userId) return;
    const cfg = await this.configService.getConfig();
    const row = await this.referralModel.findOne({ refereeUserId: ev.userId, status: 'pending' }).exec();
    if (!row) return;
    row.status = 'qualified';
    row.qualifiedAt = new Date();
    row.referrerCreditAmount = cfg.referrerCredits;
    row.refereeCreditAmount = cfg.refereeCredits;
    await row.save();
  } catch (err) {
    this.logger.warn(`qualifyReferral failed for ${ev?.userId}: ${err instanceof Error ? err.message : String(err)}`);
    Sentry.captureException(err, { tags: { module: 'connect.referral', op: 'qualify' } });
  }
}
```

### Task 10: `releaseHeldReferrals` (daily cron — credit both sides)

**Files:**

- Modify: `referral.service.ts`
- Test: `referral.service.release.vitest.ts`

- [ ] **Step 1: Failing tests** — qualified row past holdback: both sides credited via `creditReferral` with keys `referral:<id>:referrer|referee`, ledger ids stored, status `rewarded`; annual ceiling / perReferrer / monthly / totalBudget exceeded → status `rejected` with reason, no credit; idempotent (running twice does not double-credit).

- [ ] **Step 2: Implement** (cap checks use `ConnectReferral` aggregates; FY = Apr-Mar for India)

```ts
/** Daily: release qualified referrals past their holdback, crediting both sides
 *  if still within caps. Idempotent via creditReferral keys. */
@Cron(CronExpression.EVERY_DAY_AT_2AM) // align with existing retention crons
async releaseHeldReferrals(now: Date = new Date()): Promise<void> {
  const cfg = await this.configService.getConfig();
  if (!cfg.enabled) return;
  const cutoffMs = now.getTime() - cfg.holdbackDays * 24 * 60 * 60 * 1000;
  const due = await this.referralModel
    .find({ status: 'qualified', qualifiedAt: { $lte: new Date(cutoffMs) } })
    .sort({ qualifiedAt: 1 })
    .exec();
  for (const row of due) {
    try {
      const reason = await this.capRejectionReason(row, cfg, now); // null if OK
      if (reason) { row.status = 'rejected'; row.rejectionReason = reason; await row.save(); continue; }
      if (row.referrerCreditAmount > 0) {
        const r = await this.wallet.creditReferral(String(row.referrerUserId), row.referrerCreditAmount,
          { idempotencyKey: `referral:${row._id}:referrer`, referralId: String(row._id), recordedBy: 'system' });
        row.referrerLedgerId = new Types.ObjectId(r.ledgerId);
      }
      if (row.refereeCreditAmount > 0) {
        const e = await this.wallet.creditReferral(String(row.refereeUserId), row.refereeCreditAmount,
          { idempotencyKey: `referral:${row._id}:referee`, referralId: String(row._id), recordedBy: 'system' });
        row.refereeLedgerId = new Types.ObjectId(e.ledgerId);
      }
      row.status = 'rewarded';
      row.rewardedAt = now;
      await row.save();
    } catch (err) {
      this.logger.warn(`release failed for referral ${row._id}: ${err instanceof Error ? err.message : String(err)}`);
      Sentry.captureException(err, { tags: { module: 'connect.referral', op: 'release' } });
    }
  }
}
```

> `capRejectionReason(row, cfg, now)`: returns `'cap_exceeded'` / `'budget_exceeded'` / null. Counts `status:'rewarded'` rows for the referrer (lifetime, this-month) against `perReferrerCap`/`monthlyPerReferrerCap`; sums rewarded `referrerCreditAmount` for the referrer this FY against `annualCreditCeilingPerUser`; sums all rewarded credit against `totalBudgetCap`. Write a focused unit test per branch.

### Task 11: `getMyReferralSummary`

**Files:** Modify `referral.service.ts`; Test `referral.service.summary.vitest.ts`.

- [ ] Implement + test: returns `{ code, enabled, referrerCredits, refereeCredits, referredCount, rewardedCount, pendingCount, creditsEarned, creditsPending, recent: [{ name, status, date }] }`. `creditsEarned` = Σ rewarded `referrerCreditAmount`; `creditsPending` = Σ qualified (not rewarded) `referrerCreditAmount`. Calls `getOrCreateMyCode` so the code always exists. `recent` joins the referee `User` name/handle (limit 20, newest first).

### Task 12: admin `listReferrals` + `clawback`

**Files:** Modify `referral.service.ts`; Test `referral.service.admin.vitest.ts`.

- [ ] `listReferrals({ status?, referrerUserId?, page, pageSize })` → paginated rows + total. `clawback(referralId, reason, adminUserId)`: if `rewarded`, reverse via `wallet.adjust(userId, -amount, 'referral clawback', ...)` for each credited side; set `status:'rejected'`, `rejectionReason:'manual_clawback'`; `audit.logEvent({ action:'referral_clawback', actorId })`. Test the reversal + audit.

- [ ] **Commit** (owner) after Phase 4: `feat(connect-referrals): referral service (attribute/qualify/release/summary/admin)`

---

## PHASE 5 — Controllers, auth wiring, module

### Task 13: `referral.controller.ts`

**Files:** Create `controllers/referral.controller.ts`; Test colocated.

- [ ] `@Controller('connect/referrals') @UseGuards(JwtAuthGuard)` + throttler tier. `GET /me` → `referralService.getMyReferralSummary(req.user.sub)`. Add OTel span; no PostHog on this read. Test: returns summary for the authed user.

### Task 14: `referral-admin.controller.ts`

**Files:** Create `controllers/referral-admin.controller.ts`; Test colocated.

- [ ] `@Controller('admin/connect/referrals') @UseGuards(JwtAuthGuard, IsAdminGuard)`. `GET /config` → `configService.getConfig()`; `PUT /config` (`AdminReferralConfigDto`) → `configService.updateConfig(dto, req.user.sub)`; `GET /` (query: status/page) → `referralService.listReferrals(...)`; `POST /:id/clawback` (`{ reason }`) → `referralService.clawback(id, reason, req.user.sub)`. adminUserId always from `req.user.sub`. Tests: admin-guard rejects non-admin; PUT audits.

### Task 15: `RegisterDto.referralCode` + auth wiring

**Files:** Modify `src/modules/auth/dto/auth.dto.ts`, `src/modules/auth/auth.service.ts`, sms-otp path.

- [ ] Add `@IsOptional() @IsString() @MaxLength(16) referralCode?: string;` to `RegisterDto` (+ the SMS verify DTO that creates a user).
- [ ] In `auth.service.register()` (and SMS verify), AFTER user + session creation, call (best-effort, do not await-block the response path if it risks latency — but it is already try/caught internally):

```ts
// referral attribution (best-effort, never blocks signup) -- referrals module.
await this.referralService
  .attachReferralAtSignup({
    refereeUserId: String(user._id),
    code: dto.referralCode,
    signupContext: {
      ipHash: hash(ipAddress),
      refereeMobileSnapshot: user.mobile,
      refereeEmailSnapshot: user.email,
    },
  })
  .catch(() => undefined);
```

- [ ] Inject `ReferralService` into `AuthService` (import `ConnectReferralsModule` or expose the service). Test: register with a valid code attributes; register with no code is unaffected; a thrown referral error does not fail registration.

### Task 16: `ConnectReferralsModule` + wiring + cron

**Files:** Create `connect-referrals.module.ts`; modify the Connect feature module + `AdminModule` surface + auth module imports.

- [ ] Module registers all schemas (`ConnectReferralConfig`, `ConnectReferral`, plus `User` and `AdWalletLedger`/`AdvertiserWallet` schema tokens as needed), imports `AuditModule`, the ads/wallet module (for `WalletService`), and `ScheduleModule` (cron). Exports `ReferralService` + `ConnectReferralConfigService` so `AuthModule` can inject. Confirm no circular import (mirror how institutes imports User schema-only). Run `npm run build` (SWC) to confirm wiring compiles.

- [ ] **Commit** (owner): `feat(connect-referrals): controllers + auth attribution + module wiring`

---

## PHASE 6 — Web shared (types, gate, actions)

### Task 17: types + kill switch + server actions

**Files:**

- Create `features/connect/referrals/referrals.types.ts`, `referral-gate.ts`, `referrals.actions.ts`.

- [ ] `referral-gate.ts` (mirror `features/connect/ads/checkout-gate.ts`):

```ts
// Single source of truth for the referral kill switch. Ship OFF; flip on after
// legal sign-off. The backend admin `enabled` flag is the real gate; this hides
// the UI entirely (nav + page + entry points) when the feature is dark.
export const REFERRAL_ENABLED: boolean = false;
```

- [ ] `referrals.types.ts`: `ReferralSummaryView`, `ReferralConfigView`, `ReferralLogRow` (match backend views/field names exactly).
- [ ] `referrals.actions.ts` (server actions via `serverHttp`, mirror `features/connect/ads/ads-admin.actions.ts`): `getMyReferral()` → `GET /connect/referrals/me`; admin `getReferralConfig()`, `updateReferralConfig(body)`, `listReferrals(params)`, `clawbackReferral(id, reason)`.

---

## PHASE 7 — Web user surfaces

### Task 18: dedicated `/connect/referrals` page + screen + loading

**Files:**

- Create `app/connect/referrals/page.tsx` (server: guard on `REFERRAL_ENABLED`; if off, render the disabled panel or `notFound()`); fetch `getMyReferral()`; render `<ReferralScreen />`.
- Create `app/connect/referrals/loading.tsx` (binding skeleton rule — mirror the screen's hero + 3 stat cards + list using `components/connect/Skeleton.tsx` primitives, `aria-hidden`).
- Create `features/connect/referrals/ReferralScreen.tsx`.

- [ ] `ReferralScreen` (client) renders: hero (link `${appUrl}/auth?ref=${code}` + Copy + `waMeHref` WhatsApp share + native share), the plain earn line (referee benefit first), 3 stat cards (Referred / Credits earned / Credits pending), referred list with status chips, how-it-works (3 steps), Terms link, empty + disabled states. AntD v6 APIs only. Use `connect.referrals.*` i18n keys (Task 24). Add the file-header comment.
- [ ] Tests (web vitest): renders stats from a summary fixture; hides spendable CTA when `creditsEarned===0`; disabled state when `!enabled`.

### Task 19: nav entry

**Files:** Modify `components/connect/ConnectModuleNav.tsx`.

- [ ] Add a PRESENCE-group item `{ key:'/connect/referrals', label: t('nav.referrals'), icon: <GiftOutlined /> }`, rendered only when `REFERRAL_ENABLED`. Keep existing order otherwise.

### Task 20: boost-page reminder card

**Files:** Modify `features/connect/ads/BoostsManagerScreen.tsx` (near `HubWalletStrip`).

- [ ] Add a dismissible card: "Earn free boost credits — refer a friend" → links `/connect/referrals`; show referral credits earned if the summary is passed in (optional fetch). Gate on `REFERRAL_ENABLED`. Reuse existing card styling. i18n `connect.referrals.boostNudge.*`.

### Task 21: profile entry

**Files:** Modify `app/connect/profile/OwnProfileClient.tsx` (owner-only section) or `features/connect/profile/ProfileView.tsx`.

- [ ] Add a small owner-only "Refer & earn" row/link (+ referred count if cheaply available) → `/connect/referrals`. Gate on `REFERRAL_ENABLED`. Do not show on other people's profiles.

### Task 22: signup `?ref=` capture + code field

**Files:** Modify `app/auth/AuthClient.tsx`, `components/auth/modes/SignupMode.tsx`.

- [ ] In `AuthClient`: on mount read `?ref=` from the URL; persist to a cookie + `localStorage` (`cr_ref`, 30-day) so it survives the OTP round-trip; read it back when building the register/verify payload and pass as `referralCode`.
- [ ] In `SignupMode`: add an optional "Referral code (optional)" input, prefilled from the stored value, editable; light client validation (`^[A-Za-z2-9]{6,10}$`); include in submit. i18n `connect.referrals.signup.*`.
- [ ] Test: a `?ref=ABCD23` query prefills the field and is included in the register call.

- [ ] **Commit** (owner) after Phase 7: `feat(connect-referrals-web): referral page, entry points, signup capture`

---

## PHASE 8 — Web admin

### Task 23: admin editor + log + page + nav

**Files:**

- Create `features/connect/referrals/AdminReferralEditor.tsx` (mirror `features/connect/ads/AdminPricingEditor.tsx`): `Switch` for `enabled`, `InputNumber` (AntD v6: `suffix=` not `addonAfter=`) per numeric field, guardrail hints, save via `updateReferralConfig`, success copy "Live on the next referral."
- Create `features/connect/referrals/ReferralLogTable.tsx`: AntD `Table` of `listReferrals` rows (referrer, referee, status chip, amounts, date) with a clawback action (confirm modal → `clawbackReferral`).
- Create `app/admin/connect/referrals/page.tsx`: server-fetch config + first log page; render editor + table.
- Modify `components/layout/AdminLayout.tsx`: add nav item `{ key:'/admin/connect/referrals', label:'Referrals' }`.

- [ ] Tests: editor renders config + posts an update; non-admin cannot reach the route (existing `AdminLayout` guard covers it — assert the menu item + guard).

- [ ] **Commit** (owner): `feat(connect-referrals-admin): config editor + referral log`

---

## PHASE 9 — i18n + final verification

### Task 24: i18n keys (all four locales)

**Files:** Modify `app/messages/{en,gu,gu-en,hi-en}.json`.

- [ ] Add the `connect.referrals.*` namespace (hero, earnLine, stats.{referred,earned,pending}, list.status.{joined,active,credited}, howItWorks.{step1,step2,step3}, terms, disabled, empty, boostNudge.{title,body,cta}, signup.{label,placeholder,hint}, nav.referrals) + admin strings, to ALL FOUR files in parity. Native gu/gu-en/hi-en wording (owner reviews). No em-dashes / no banned glyphs (respect `check:i18n`).
- [ ] Run `npm run check:i18n` → key parity green.

### Task 25: final gates

- [ ] Backend: `cd crewroster-backend && npx vitest run src/modules/connect/referrals` (+ wallet referral test) → all green; `npm run build` (SWC) clean. (Full `tsc` OOMs on this machine — rely on SWC build + CI for full typecheck, per existing notes.)
- [ ] Web: `cd crewroster-web && npm run check:i18n && npx tsc --noEmit && npx eslint <changed files> && npx vitest run features/connect/referrals` → green; confirm `app/connect/referrals/loading.tsx` exists.
- [ ] Manual smoke (owner, after flipping `REFERRAL_ENABLED=true` + admin `enabled=true` in a dev env): share link → second signup with code → activate → fast-forward holdback (or run the cron) → both wallets credited → admin log + clawback work.

---

## Self-review

**Spec coverage:** registration field (T15, T22), URL/link (T17 hero, T22), admin panel amounts + caps + on/off + log (T1-3, T14, T23), user account placement = dedicated page + boost reminder + profile (T18, T20, T21), "how many referred + credits earned/pending" (T11, T18), both-sides credit (T6, T10), labelled-separate credits (T6 `referral` type), anti-fraud (T8 self/velocity/disposable, T10 caps/budget, holdback via T9→T10), attribution first-code-wins (T5, T8), i18n 4 locales (T24), legal flags documented (spec §13). No gap found.

**Placeholder scan:** numeric defaults, guardrails, idempotency keys, and event/cron names are all concrete. The few "follow the existing pattern" steps (T6 guarded-write internals, T17/T23 mirror files) name the exact reference file to copy — acceptable in an established codebase.

**Type consistency:** `ConnectReferralConfigView`, `ReferralStatus`, `creditReferral({ idempotencyKey, referralId, recordedBy })`, ledger key format `referral:<id>:referrer|referee`, and the summary field names are used consistently across backend + web tasks.

**Owner gates:** (1) approve the build at all (new feature); (2) approve the wallet ledger change (T6); (3) legal sign-off before flipping the flag on (spec §13); (4) owner runs all git + the migration-free deploy + the smoke.
