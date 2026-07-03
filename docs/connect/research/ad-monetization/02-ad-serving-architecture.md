# Ad-Serving / Delivery-Engine Architecture

## zari360 Connect -- Reference Design

> Status: Research reference, not production code. Pseudocode and ASCII diagrams are intentional.
> Audience: Backend engineers building the NestJS ad-server module and the Next.js rail/feed integration layer.
> Stack baseline: NestJS + Mongoose/MongoDB, Next.js App Router (server actions + axios), Socket.IO, AntD v6 + Tailwind, existing prepaid credit ledger + platform credit pool.

---

## Table of Contents

1. [Build-vs-Buy Recommendation](#1-build-vs-buy-recommendation)
2. [Overall Delivery Architecture](#2-overall-delivery-architecture)
3. [MongoDB Data Model](#3-mongodb-data-model)
4. [Single-Slot Decisioning Algorithm](#4-single-slot-decisioning-algorithm)
5. [Budget Pacing and Billing](#5-budget-pacing-and-billing)
6. [B2B Targeting Dimensions](#6-b2b-targeting-dimensions)
7. [Measurement and Anti-Fraud](#7-measurement-and-anti-fraud)
8. [Serve-Time Performance](#8-serve-time-performance)
9. [Next.js Integration Pattern](#9-nextjs-integration-pattern)
10. [Rollout Phasing](#10-rollout-phasing)

---

## 1. Build-vs-Buy Recommendation

### Decision: Hybrid -- own first-party server, Google Ad Manager for remnant

**Rationale**

zari360 Connect is a closed B2B network. The most valuable inventory (in-feed promoted listings, boosted posts, profile spotlights, left/right rail panels) maps to first-party advertisers who are also platform users. These advertisers pay via the existing prepaid credit ledger -- routing that spend through Google Ad Manager would hand Google a revenue-share cut on money already sitting in the platform's own wallet. That is the single strongest reason to build a lightweight first-party server.

At the same time, unsold (remnant) inventory on lower-value placements should waterfall to Google Ad Manager / AdSense as a passive fill rather than leaving those impressions empty.

| Layer                         | Who serves                          | Payment flow                |
| ----------------------------- | ----------------------------------- | --------------------------- |
| Direct/first-party campaigns  | Own ad server (NestJS module)       | Debit prepaid credit ledger |
| House promos (platform-owned) | Own ad server, zero cost            | Internal marketing pool     |
| Remnant / unsold              | Google Ad Manager tag (passthrough) | AdSense revenue share       |

**What NOT to buy for first-party serving**

Commercial ad servers (Google Ad Manager 360, AdButler, Kevel) charge CPM fees or monthly platform fees and impose data-residency constraints that conflict with India-first operations and the sensitivity of B2B firmographic data. Kevel's API-first model is the closest viable buy option, but even Kevel's base tier adds per-request cost and an external call on the hot path. Building a minimal NestJS module is the correct call at this stage: the decisioning logic fits in roughly 300-400 lines of service code, and the data model lives in the existing MongoDB cluster.

**When to revisit**

If daily ad requests exceed 5 million, or if real-time bidding with external DSPs is needed, the architecture should be re-evaluated for a dedicated auction microservice or a managed RTB platform. Neither applies at launch.

---

### Waterfall vs. Unified Auction -- Recommendation: Sequential Waterfall

**Unified auction / header bidding** (Prebid.js model) runs all demand sources simultaneously and picks the highest eCPM. It is the industry gold standard for maximising yield on a high-traffic open-web publisher. For zari360 Connect at launch it is premature for two reasons:

1. First-party B2B demand (boosted posts, promoted listings) is not price-competitive with programmatic display CPMs. B2B buyers are buying audience relevance, not cheapest CPM. Putting first-party campaigns into an open auction against AdSense would consistently lose on price and drain the advertiser experience.
2. Header bidding requires client-side JavaScript orchestration (Prebid.js) or a server-side auction proxy, both of which add latency and infrastructure complexity with no yield benefit until remnant fill rates become meaningful.

**Recommended waterfall sequence (per slot render):**

```
1. Eligibility filter  -->  2. First-party auction (eCPM rank)
         |
         | (no eligible first-party ad)
         v
3. House promo (if slot supports it)
         |
         | (no house promo)
         v
4. Google Ad Manager passthrough tag
         |
         | (GAM returns no fill)
         v
5. Empty / collapsed slot
```

This matches how LinkedIn, Keka, and early-stage vertical networks have operated before programmatic demand matures.

---

## 2. Overall Delivery Architecture

```
                         Next.js App Router (SSR / RSC)
                         +-------------------------------+
  Feed page              |  FeedPage (Server Component)  |
  Rail page              |  RailPanel (Server Component) |
                         |                               |
                         |  calls AdDecisionService      |
                         |  (internal HTTP or direct     |
                         |   module import in monorepo)  |
                         +---------------+---------------+
                                         |
                         NestJS AdServer Module
                         +---------------v---------------+
                         |  POST /ads/decide             |
                         |  (AdDecisionController)       |
                         |                               |
                         |  1. EligibilityFilter         |
                         |  2. TargetingEvaluator        |
                         |  3. FrequencyCapChecker       |
                         |  4. PacingThrottler           |
                         |  5. eCPM Ranker               |
                         |  6. WinnerSelector            |
                         |  7. ImpressionTokenIssuer     |
                         +---+-------------------+-------+
                             |                   |
                    MongoDB  |                   | Redis (hot state)
              +--------------v----+   +----------v----------+
              | AdCampaign        |   | freq_cap:{uid}:{adId}|
              | AdSet             |   | pacing:{adSetId}     |
              | Creative          |   | decision_cache:{key} |
              | Placement         |   +---------------------+
              | ImpressionLog     |
              | ClickLog          |
              | CreditLedger      |
              +-------------------+
                             |
                    (remnant fallback)
                             |
                    Google Ad Manager
                    GPT tag rendered
                    client-side after
                    first-party miss
```

---

## 3. MongoDB Data Model

All collections live in the existing MongoDB cluster alongside Connect collections. Mongoose schemas follow the same pattern as existing platform schemas.

### 3.1 Advertiser

Maps to an existing `User` or `ConnectProfile`. No separate collection needed -- the advertiser IS the user.

Reference field on Campaign: `advertiserId: ObjectId (ref: User)`.

### 3.2 Campaign

```
Collection: ad_campaigns

Field                  Type           Notes
-----                  ----           -----
_id                    ObjectId
advertiserId           ObjectId       ref: User
workspaceId            ObjectId       ref: Workspace (optional, for ERP-linked ads)
name                   String
status                 Enum           draft | active | paused | completed | cancelled
objective              Enum           awareness | consideration | conversion
budgetType             Enum           total | daily
budgetAmount           Number         in platform credits (1 credit = INR 1 by default)
budgetSpent            Number         running total, updated on confirmed impression/click
pacingStrategy         Enum           even | accelerated
startDate              Date
endDate                Date
frequencyCapPerUser    Number         max impressions per user per day (default: 3)
frequencyCapWindow     Enum           day | week | flight
billingEvent           Enum           cpm | cpc | cpa
createdAt              Date
updatedAt              Date
```

Indexes:

- `{ status: 1, startDate: 1, endDate: 1 }` -- eligibility sweep
- `{ advertiserId: 1, status: 1 }` -- advertiser dashboard
- `{ workspaceId: 1 }` -- ERP-linked campaign lookup

### 3.3 AdSet

An AdSet binds one Campaign to one Placement and one Targeting profile.

```
Collection: ad_sets

Field                  Type           Notes
-----                  ----           -----
_id                    ObjectId
campaignId             ObjectId       ref: ad_campaigns
placementId            ObjectId       ref: ad_placements
targeting              Object         see TargetingSpec below
bidAmount              Number         credits; semantics depend on Campaign.billingEvent
dailyBudgetCap         Number         optional cap per adset per day
dailySpent             Number         reset each day by cron
dailySpentResetAt      Date           last reset timestamp
status                 Enum           active | paused
createdAt              Date
```

Indexes:

- `{ campaignId: 1, status: 1 }`
- `{ placementId: 1, status: 1 }` -- used in decisioning hot path

### 3.4 Creative

```
Collection: ad_creatives

Field                  Type           Notes
-----                  ----           -----
_id                    ObjectId
adSetId                ObjectId       ref: ad_sets
advertiserId           ObjectId       denormalised for fast access
format                 Enum           native_feed | banner_300x250 | banner_160x600 |
                                      banner_728x90 | sponsored_text | video_15s
headline               String (i18n)  { en, gu, hi-en, gu-en }
bodyText               String (i18n)
imageUrl               String
videoUrl               String
ctaLabel               String (i18n)
destinationUrl         String
status                 Enum           pending_review | approved | rejected | paused
reviewNote             String
createdAt              Date
```

Indexes:

- `{ adSetId: 1, status: 1 }`
- `{ advertiserId: 1, status: 1 }`

### 3.5 Placement

Defines named ad slots in the product. Seeded at deploy time, not created by advertisers.

```
Collection: ad_placements

Field                  Type           Notes
-----                  ----           -----
_id                    ObjectId
slug                   String         e.g. feed_native, rail_right_top, rail_left_mid,
                                      search_results_top, profile_sidebar
label                  String
supportedFormats       String[]       subset of Creative.format enum
floorCpm               Number         minimum accepted eCPM in credits
isActive               Boolean
```

Indexes:

- `{ slug: 1 }` unique -- decisioning looks up by slug

### 3.6 TargetingSpec (embedded in AdSet)

```typescript
// Embedded object, not a separate collection
interface TargetingSpec {
  industries: string[]; // e.g. ["textiles","garments"]
  roles: string[]; // designation slugs
  districts: string[]; // Indian district names
  states: string[]; // Indian states
  companySizes: string[]; // "1-10" | "11-50" | "51-200" | "201+"
  connectionDegree: number; // 1 | 2 | 3 (0 = any)
  skills: string[]; // skill slugs
  languages: string[]; // "en" | "gu" | "hi-en" | "gu-en"
  deviceTypes: string[]; // "mobile" | "desktop" | "tablet"
  // Lookalike targeting -- resolved offline, stored as a pre-computed audience segment ID
  lookalikeSeedSegmentId: ObjectId | null;
  // Exclusion lists
  excludeUserIds: ObjectId[]; // dedupe against already-converted users
  excludeCompanyIds: ObjectId[];
}
```

### 3.7 AudienceSegment (for lookalike / retargeting)

```
Collection: ad_audience_segments

Field                  Type           Notes
-----                  ----           -----
_id                    ObjectId
advertiserId           ObjectId
name                   String
segmentType            Enum           retargeting | lookalike | custom_upload
userIds                ObjectId[]     resolved member list (max 500k, sharded if larger)
computedAt             Date
expiresAt              Date           segments refresh every 7 days
status                 Enum           computing | ready | expired
```

Indexes:

- `{ advertiserId: 1, status: 1 }`

### 3.8 ImpressionLog

Hot-write collection. One document per served impression.

```
Collection: ad_impressions

Field                  Type           Notes
-----                  ----           -----
_id                    ObjectId
adSetId                ObjectId
campaignId             ObjectId       denormalised
creativeId             ObjectId       denormalised
placementSlug          String         denormalised (no join needed for rollup)
userId                 ObjectId
sessionId              String         from request header
impressionToken        String         UUID v4, signed with HMAC; used for dedup
viewable               Boolean        set to true on VIEW_CONFIRM beacon
viewableAt             Date
servedAt               Date           index anchor
chargedAt              Date           null until billing confirmed
chargeAmount           Number         credits debited
deviceType             String
locale                 String
ipHash                 String         SHA-256 of IP, not raw IP (privacy)
userAgent              String
isFraud                Boolean        default false; set by async IVT check
```

Indexes:

- `{ adSetId: 1, servedAt: 1 }` -- pacing queries
- `{ userId: 1, adSetId: 1, servedAt: 1 }` -- frequency cap check
- `{ impressionToken: 1 }` unique -- dedup guard
- `{ servedAt: 1 }` -- TTL candidate for raw log pruning after 90 days
- `{ campaignId: 1, chargedAt: 1 }` -- billing reconciliation

### 3.9 ClickLog

```
Collection: ad_clicks

Field                  Type           Notes
-----                  ----           -----
_id                    ObjectId
impressionId           ObjectId       ref: ad_impressions (1:1 relationship enforced)
adSetId                ObjectId
campaignId             ObjectId
creativeId             ObjectId
userId                 ObjectId
clickToken             String         UUID v4 signed; one-time use
clickedAt              Date
isValid                Boolean        default false; set by validation job
validatedAt            Date
chargeAmount           Number         for CPC campaigns
ipHash                 String
userAgent              String
```

Indexes:

- `{ impressionId: 1 }` unique -- one click per impression
- `{ clickToken: 1 }` unique
- `{ adSetId: 1, clickedAt: 1 }`

### 3.10 DailyRollup (pre-aggregated reporting)

```
Collection: ad_daily_rollups

Field                  Type           Notes
-----                  ----           -----
_id                    ObjectId
adSetId                ObjectId
campaignId             ObjectId
date                   Date           UTC midnight bucket
impressions            Number
viewableImpressions    Number
clicks                 Number
validClicks            Number
spend                  Number         credits
ctr                    Number         computed field
viewability            Number         viewableImpressions / impressions
avgFrequency           Number
uniqueUsers            Number         HyperLogLog approximation or exact for small counts
```

Indexes:

- `{ campaignId: 1, date: -1 }` -- advertiser dashboard
- `{ adSetId: 1, date: -1 }`

### 3.11 Credit Ledger Integration

The existing `PlatformCreditPool` and `PlatformCreditLedger` schemas are reused directly. Ad spend creates ledger entries with `source: 'ad_campaign'` and `referenceId: campaignId`. No new schema needed -- only a new ledger entry type constant.

```typescript
// Ledger entry type extension (no schema change)
type CreditLedgerSource =
  | 'subscription'
  | 'marketing_pool'
  | 'ad_campaign' // <-- new
  | 'system';
```

---

## 4. Single-Slot Decisioning Algorithm

This runs for every ad slot render. Target latency: under 30ms P95 with Redis-assisted caching.

### Input

```typescript
interface DecisionRequest {
  placementSlug: string; // e.g. "feed_native"
  userId: ObjectId;
  userProfile: UserAdProfile; // pre-fetched, cached; see Section 6
  sessionId: string;
  deviceType: 'mobile' | 'desktop' | 'tablet';
  locale: string;
  excludeAdSetIds?: ObjectId[]; // already shown in same page render (same-page dedup)
}
```

### Step-by-Step Algorithm

```
STEP 1 -- Placement Lookup
  Read ad_placements by slug (Redis cache, TTL 5 min).
  If placement.isActive == false: return EMPTY.

STEP 2 -- Candidate Fetch
  Query ad_sets where:
    placementId = placement._id
    status = 'active'
    campaign.status = 'active'
    campaign.startDate <= now <= campaign.endDate
    campaign.budgetSpent < campaign.budgetAmount         (budget remaining)
    adSet.dailySpent < adSet.dailyBudgetCap (if set)
    creative.status = 'approved'
  Use compound index { placementId: 1, status: 1 }.
  Join campaign + creative via $lookup (or pre-denormalised fields).
  Limit fetch to top 50 candidates by bid DESC to bound query time.

STEP 3 -- Targeting Filter
  For each candidate adSet, evaluate TargetingSpec against userProfile:
    industries match?          (userProfile.industry in adSet.targeting.industries OR industries is [])
    roles match?               (userProfile.role in adSet.targeting.roles OR roles is [])
    location match?            (userProfile.district/state match OR location lists are [])
    companySize match?         (userProfile.companySize in adSet.targeting.companySizes OR [] )
    connectionDegree match?    (computed from graph, pre-cached on userProfile)
    skills match?              (intersection of userProfile.skills and targeting.skills is non-empty OR skills is [])
    locale match?              (userProfile.locale in targeting.languages OR languages is [])
    deviceType match?          (deviceType in targeting.deviceTypes OR deviceTypes is [])
    lookalike match?           (userId in AudienceSegment.userIds, checked via Redis Set)
    NOT in excludeUserIds
    NOT in excludeCompanyIds
    NOT in excludeAdSetIds (same-page dedup)
  Retain only matching candidates.

STEP 4 -- Frequency Cap Check (Redis)
  For each surviving candidate:
    key = freq_cap:{userId}:{adSetId}:{window}
    count = REDIS GET key
    If count >= campaign.frequencyCapPerUser: discard candidate.
  Window = 'day' means key TTL = seconds until midnight UTC.
  Window = 'week' means TTL = seconds until Sunday midnight.
  Window = 'flight' means TTL = campaign.endDate - now.

STEP 5 -- Pacing Throttle Check (Redis)
  For each surviving candidate:
    key = pacing:{adSetId}:throttle
    If key EXISTS (throttle flag set by pacing daemon): discard candidate.
  See Section 5 for how the pacing daemon sets this flag.

STEP 6 -- eCPM Normalisation and Ranking
  For each surviving candidate compute effective_ecpm:

  IF billingEvent == 'cpm':
    effective_ecpm = bidAmount

  IF billingEvent == 'cpc':
    pCTR = candidate.predictedCtr  (see note below)
    effective_ecpm = pCTR * bidAmount * 1000

  IF billingEvent == 'cpa':
    pCTR = candidate.predictedCtr
    pCVR = candidate.predictedCvr
    effective_ecpm = pCTR * pCVR * bidAmount * 1000

  relevance_score = normalised 0.0-1.0 from targeting match depth
                   (exact-match on 4+ dimensions = 1.0; 1 dimension = 0.25)

  final_score = effective_ecpm * (0.85 + 0.15 * relevance_score)
              -- 85% pure price signal, 15% relevance boost cap

  Sort candidates by final_score DESC.
  Winner = candidates[0].

  Note on pCTR / pCVR at launch: use simple historical averages from DailyRollup
  per (adSetId, placementSlug, deviceType). For new ad sets with no history,
  use placement-level average CTR as prior. A proper ML pCTR model is a Phase 2
  upgrade -- the algorithm slot is identical, only the input signal changes.

STEP 7 -- Floor Price Enforcement
  If winner.effective_ecpm < placement.floorCpm: discard winner.
  Repeat for runner-up, etc.
  If no candidate clears the floor: waterfall to house promo, then to GAM tag.

STEP 8 -- Impression Token Issue
  Generate impressionToken = sign(UUID_v4, HMAC_SECRET).
  Write ImpressionLog document (status: pending, chargedAt: null).
  Increment Redis freq cap counter: INCR freq_cap:{userId}:{adSetId}:{window} EX {ttl}.
  Increment Redis pacing counter: INCR pacing:{adSetId}:impressions:{minute_bucket}.

STEP 9 -- Return Decision
  {
    adSetId, creativeId, creative payload (headline/body/image/cta/destination),
    impressionToken,
    beaconUrl: "/ads/beacon/impression/{impressionToken}",
    clickUrl:  "/ads/click/{clickToken}",
    fallbackGamTag: null    (only set if winner was null and GAM fills)
  }
```

### Fallback Chain Summary

```
First-party winner found          --> serve first-party ad
No first-party winner + house promo available  --> serve house promo (no charge)
No house promo + GAM passthrough enabled       --> return GAM ad tag (client renders)
No GAM fill                                    --> return null (slot collapses)
```

---

## 5. Budget Pacing and Billing

### 5.1 Pacing Goals

Even pacing: the daily budget should be distributed uniformly across the day's available hours so the campaign does not exhaust budget in the first hour and go dark. This is the default for all campaigns.

Accelerated pacing (opt-in): spend as fast as possible. Useful for time-sensitive promotions. Simply omit throttle flag checks in Step 5.

### 5.2 Even Pacing via Token Bucket (Redis)

```
Every minute, a NestJS cron job (PacingDaemon) runs for each active adSet:

  target_impressions_per_minute = dailyBudgetRemaining / (minutesLeftInDay * avgCpm / 1000)

  actual_impressions_this_minute = REDIS GET pacing:{adSetId}:impressions:{prev_minute_bucket}

  IF actual_impressions_this_minute > target_impressions_per_minute * 1.2:
    SET pacing:{adSetId}:throttle "1" EX 60    -- throttle for next minute
  ELSE:
    DEL pacing:{adSetId}:throttle              -- release throttle
```

This is a simplified single-controller throttle. For accelerated pacing, the daemon never sets the throttle flag.

### 5.3 Budget Burndown and Billing -- Prepaid Wallet

**The critical constraint**: the platform's credit ledger must never double-charge. Because the decisioning path is concurrent (multiple users hitting the same slot simultaneously), naive decrement on win creates race conditions.

**Two-phase commit pattern:**

```
Phase A -- Reserve (at win time, Step 8):
  Atomically increment campaign.budgetSpent by estimated charge using
  MongoDB findOneAndUpdate with:
    filter: { _id: campaignId, budgetSpent: { $lte: budgetAmount - estimatedCharge } }
    update: { $inc: { budgetSpent: estimatedCharge } }
  If the atomic update returns null (budget exhausted mid-race), abort:
    do NOT issue impression token, fall to next candidate.

Phase B -- Confirm (on viewability beacon for CPM, on valid click for CPC):
  Update ImpressionLog.chargedAt = now, ImpressionLog.chargeAmount = actualCharge.
  Write CreditLedger debit entry { source: 'ad_campaign', referenceId: campaignId,
    amount: -actualCharge, idempotencyKey: impressionToken }.
  For CPC: wait for ClickLog validation (see Section 7) before writing ledger entry.

Phase C -- Reconcile (nightly cron):
  Find ImpressionLog documents where chargedAt IS null AND servedAt < (now - 2h).
  These are impressions served but never confirmed viewable (user left before beacon fired).
  Release the reserved budgetSpent back to the campaign.
  Write a reversal CreditLedger entry { source: 'ad_campaign_reversal' }.
```

**Idempotency**: every ledger write uses `impressionToken` as the idempotencyKey. A unique index on `CreditLedger.idempotencyKey` prevents double-writes from retries.

### 5.4 Daily Budget Reset

A nightly cron at 00:00 IST:

- Sets `adSet.dailySpent = 0` and `adSet.dailySpentResetAt = now` for all active adSets.
- Resets `campaign.budgetSpent` daily counter (separate from total flight spend).
- Purges expired `pacing:*:impressions:*` Redis keys.

---

## 6. B2B Targeting Dimensions

### 6.1 Dimensions and Data Sources

| Dimension          | Source                                                | Cardinality           | Serve-time cost                  |
| ------------------ | ----------------------------------------------------- | --------------------- | -------------------------------- |
| Industry           | ConnectProfile.industry                               | ~50 values            | O(1) set membership              |
| Role / Designation | TeamMember.designationId + ConnectProfile.currentRole | ~200 slugs            | O(1) set membership              |
| District           | ConnectProfile.location.district                      | ~750 Indian districts | O(1) set membership              |
| State              | ConnectProfile.location.state                         | 28 + 8 UTs            | O(1) set membership              |
| Company size       | ConnectProfile.linkedWorkspace.employeeCount bucket   | 4 buckets             | O(1)                             |
| Connection degree  | Pre-computed graph hop, cached on profile             | 3 levels              | O(1) cached                      |
| Skills             | ConnectProfile.skills (array)                         | ~1000 slugs           | O(n) array intersection, n small |
| Language / locale  | User.locale                                           | 4 values              | O(1)                             |
| Device type        | Request header                                        | 3 values              | O(1)                             |
| Lookalike segment  | AudienceSegment.userIds (Redis Set)                   | 10k-500k users        | O(1) SISMEMBER                   |
| Retargeting        | AudienceSegment.userIds (Redis Set)                   | per advertiser        | O(1) SISMEMBER                   |
| Exclusion list     | TargetingSpec.excludeUserIds (small array)            | <1000 per campaign    | O(n)                             |

### 6.2 UserAdProfile -- Pre-computed Per User

To avoid joining ConnectProfile + TeamMember + graph data on every ad decision, a `UserAdProfile` is pre-computed and cached in Redis with TTL of 15 minutes.

```typescript
interface UserAdProfile {
  userId: string;
  industry: string;
  role: string; // designation slug
  district: string;
  state: string;
  companySize: string; // bucket string
  connectionDegree1Ids: string[]; // direct connections (for degree=1 targeting)
  skills: string[];
  locale: string;
  segmentIds: string[]; // IDs of AudienceSegments this user belongs to
  computedAt: number; // unix ms
}
```

Cache key: `user_ad_profile:{userId}`.

The profile is invalidated (deleted from Redis) when:

- User updates ConnectProfile.
- User accepts a new connection.
- AudienceSegment containing this user is recomputed.

### 6.3 Lookalike Segment Computation

Lookalike audiences are computed offline (nightly batch), not at serve time.

Algorithm (simple cosine-similarity baseline, upgradeable to ALS/Node2Vec later):

```
1. Advertiser seeds a lookalike from a source list (e.g., their existing customers or
   profile-visitors who converted).
2. Batch job computes a feature vector for each seed user:
   industry + role + district + companySize + top 10 skills (one-hot).
3. For each non-seed user on the platform, compute cosine similarity to the centroid
   of seed vectors.
4. Top N (default: 5x seed size, max 200k) are written to AudienceSegment.userIds.
5. AudienceSegment is also loaded into a Redis Set for O(1) membership checks at serve time.
```

---

## 7. Measurement and Anti-Fraud

### 7.1 Viewability -- MRC Standard

MRC defines a viewable display impression as: at least 50% of the ad's pixels visible in the browser viewport for at least 1 continuous second.

Implementation:

```javascript
// Client-side beacon script (injected with each ad creative)
const observer = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (entry.intersectionRatio >= 0.5) {
        if (!viewTimer) {
          viewTimer = setTimeout(() => {
            // Fire viewability beacon
            fetch(`/ads/beacon/view/${impressionToken}`, { method: 'POST', keepalive: true });
            observer.disconnect();
          }, 1000);
        }
      } else {
        clearTimeout(viewTimer);
        viewTimer = null;
      }
    });
  },
  { threshold: 0.5 },
);
observer.observe(adElement);
```

On beacon receipt, the server sets `ImpressionLog.viewable = true` and `viewableAt = now`. For CPM campaigns, Phase B billing is triggered here.

### 7.2 Click Validation

A raw click fires `POST /ads/click/{clickToken}`. The server:

1. Validates the click token (HMAC signature, not yet used, TTL not expired -- 30 minute window).
2. Checks that the parent ImpressionLog exists and `isFraud == false`.
3. Checks that a ClickLog document does NOT already exist for this impressionId (unique index prevents insert if duplicate -- idempotent).
4. Writes ClickLog with `isValid = false` (pending async validation).
5. An async job (sub-second) runs heuristic checks:
   - Time between impression and click < 500ms: likely bot, mark invalid.
   - Click from same IP hash as > 5 clicks in 60 seconds across any campaign: rate limit, mark invalid.
   - User agent is in known bot list: mark invalid.
   - If all checks pass: set `isValid = true`, trigger Phase B billing.

### 7.3 Invalid Traffic (IVT) -- General IVT (GIVT) Baseline

IAB MRC classifies invalid traffic into:

- GIVT: detectable by standard means (bots, crawlers, known data centre IPs, blank user agents).
- SIVT: sophisticated bots mimicking human behavior.

For launch, implement GIVT filtering only:

```
At impression serve time (Step 8, before issuing token):
  IF userAgent matches bot_ua_list (Googlebot, bingbot, etc.): abort, return null.
  IF ip_to_asn(ipHash) resolves to data-centre ASN: flag as suspected IVT.
  IF request has no valid session cookie: suspicious, serve but flag.

Async post-serve IVT check (within 5 minutes of impression):
  Query: same userId, same adSetId, more than 50 impressions in past 1 hour?
    --> mark as SIVT, set ImpressionLog.isFraud = true, reverse billing.
  Query: same ipHash, more than 200 impressions across all campaigns in past 1 hour?
    --> mark as SIVT, reverse billing.
```

SIVT detection (ML-based behavioral analysis) is a Phase 2 concern. For launch, the GIVT baseline satisfies MRC's minimum requirement for a first-party publisher.

### 7.4 Reporting Rollup

The `ad_daily_rollups` collection is populated by a nightly aggregation pipeline:

```javascript
// Pseudocode -- run as MongoDB aggregation
db.ad_impressions.aggregate([
  { $match: { servedAt: { $gte: todayStart, $lt: todayEnd } } },
  {
    $group: {
      _id: { adSetId: '$adSetId', campaignId: '$campaignId' },
      impressions: { $sum: 1 },
      viewableImpressions: { $sum: { $cond: ['$viewable', 1, 0] } },
      spend: { $sum: '$chargeAmount' },
      uniqueUsers: { $addToSet: '$userId' }, // use $approxCountDistinct in Mongo 7+
    },
  },
  // Join clicks from ad_clicks for same date range
  // Compute CTR, viewability rate
  // Write to ad_daily_rollups (upsert by adSetId + date)
]);
```

Real-time stats (for the advertiser dashboard's "live" counter): Redis counters updated in Step 8, read by the dashboard API. No MongoDB reads on the hot path for live stats.

---

## 8. Serve-Time Performance

### 8.1 Latency Budget

| Step                                        | Target latency |
| ------------------------------------------- | -------------- |
| Placement lookup (Redis)                    | 1ms            |
| Candidate fetch (MongoDB indexed)           | 5-10ms         |
| Targeting filter (in-memory)                | 1ms            |
| Frequency cap check (Redis pipeline)        | 2ms            |
| Pacing throttle check (Redis)               | 1ms            |
| eCPM ranking (in-memory, 50 candidates max) | <1ms           |
| Impression token issue + Redis write        | 3ms            |
| Total P50                                   | ~15ms          |
| Total P95 target                            | <30ms          |

### 8.2 Caching Strategy

| Data                           | Cache        | TTL                     | Invalidation                 |
| ------------------------------ | ------------ | ----------------------- | ---------------------------- |
| Placement config               | Redis string | 5 min                   | On placement update          |
| UserAdProfile                  | Redis JSON   | 15 min                  | On profile/connection update |
| Candidate adSets for placement | Redis list   | 30 sec                  | On adSet status change       |
| AudienceSegment membership     | Redis Set    | Until segment recompute | Nightly batch                |
| Frequency cap counters         | Redis INCR   | Window TTL (day/week)   | Natural expiry               |
| Pacing throttle flag           | Redis string | 60 sec                  | PacingDaemon                 |

The 30-second candidate cache for a placement means: at most 30 seconds of serving a paused ad after pause. This is acceptable. If stricter enforcement is needed, set TTL to 5 seconds.

### 8.3 Decision Cache (Same-User, Same-Slot, Short Window)

For feed pages where the same user scrolls through multiple posts, the feed interleaver calls the decision endpoint once per ad slot. If the user re-renders the same page within 5 seconds (e.g., hot reload, optimistic update), the decision result is cached in Redis:

```
key = decision_cache:{userId}:{placementSlug}:{pageLoadId}
TTL = 5 seconds
```

This prevents double-billing on rapid re-renders. The `pageLoadId` is a UUID generated client-side and sent with every ad request in that page session.

### 8.4 MongoDB Index Summary (all collections)

```
ad_campaigns:
  { status: 1, startDate: 1, endDate: 1 }
  { advertiserId: 1, status: 1 }
  { workspaceId: 1 }

ad_sets:
  { campaignId: 1, status: 1 }
  { placementId: 1, status: 1 }         -- HOT PATH

ad_creatives:
  { adSetId: 1, status: 1 }
  { advertiserId: 1, status: 1 }

ad_placements:
  { slug: 1 } unique

ad_impressions:
  { adSetId: 1, servedAt: 1 }
  { userId: 1, adSetId: 1, servedAt: 1 }
  { impressionToken: 1 } unique
  { campaignId: 1, chargedAt: 1 }
  { servedAt: 1 }                        -- TTL index (90 day expiry)

ad_clicks:
  { impressionId: 1 } unique
  { clickToken: 1 } unique
  { adSetId: 1, clickedAt: 1 }

ad_daily_rollups:
  { campaignId: 1, date: -1 }
  { adSetId: 1, date: -1 }

ad_audience_segments:
  { advertiserId: 1, status: 1 }
```

---

## 9. Next.js Integration Pattern

### 9.1 Recommended Pattern: Server-Side Decision, Client-Side Beacon

The ad decision (Steps 1-8 above) runs server-side so that:

- The ad content is rendered in the initial HTML (no layout shift, better perceived performance).
- The userId and UserAdProfile are available without a client-to-server round trip.
- Frequency cap increments happen before the page reaches the client (no double-counting on SSR + hydration).

The viewability beacon and click redirect fire client-side (they require browser DOM events).

```typescript
// app/connect/feed/page.tsx  (Server Component, simplified)
import { AdDecisionService } from '@/server/ads/AdDecisionService';

export default async function FeedPage() {
  const session = await getServerSession();

  // Fetch ad for the feed native slot
  const adDecision = await AdDecisionService.decide({
    placementSlug: 'feed_native',
    userId: session.userId,
    locale: session.locale,
    deviceType: headers().get('x-device-type') ?? 'desktop',
    sessionId: session.sessionId,
  });

  return (
    <FeedLayout>
      <FeedList ... />
      {/* Feed interleaver injects this at position N */}
      {adDecision
        ? <AdCard decision={adDecision} />       // Client Component for beacons
        : <GamFallbackSlot placement="feed_native" />  // Client Component, GAM tag
      }
    </FeedLayout>
  );
}
```

`AdDecisionService` in Next.js is a thin wrapper: in development (monorepo co-location) it imports the NestJS service directly via a shared package. In production it calls `POST /ads/decide` over the internal network (same VPC, sub-1ms overhead).

### 9.2 Rail Panels

Left/right rail panels follow the same pattern. Each panel slot is a Server Component that calls `AdDecisionService.decide({ placementSlug: 'rail_right_top', ... })`. The existing rail panel slot architecture in the Connect layout already has the provider-agnostic hook point.

### 9.3 Feed Interleaver Integration

The existing in-feed ad interleaver (house promo slot) is extended to accept first-party `AdDecision` objects:

```typescript
// Interleaver contract extension
type FeedItem = PostItem | AdDecision | HousePromoItem;

function interleaveFeed(
  posts: PostItem[],
  ads: AdDecision[],
  promos: HousePromoItem[],
): FeedItem[] {
  // Inject one ad every N posts (N = workspace setting, default 5)
  // Priority: AdDecision > HousePromoItem > nothing
}
```

### 9.4 Client-Side Ad Component Responsibilities

The `<AdCard>` Client Component handles only:

1. Mounting the IntersectionObserver for viewability beacon.
2. Wrapping the CTA link with a click-redirect URL (`/ads/click/{clickToken}`).
3. Rendering the "Sponsored" label per IAB disclosure requirements.
4. Reporting the `impressionToken` to the beacon endpoint on mount (for served-but-not-viewable tracking).

It does NOT handle ad selection, frequency logic, or billing. All of that is server-side.

---

## 10. Rollout Phasing

### Phase 1 (Foundation)

- MongoDB collections + indexes for Campaign/AdSet/Creative/Placement.
- `POST /ads/decide` endpoint with Steps 1-9 (no pCTR model, use flat CTR prior).
- Frequency cap via Redis.
- ImpressionLog write, viewability beacon endpoint.
- Credit ledger debit (CPM only, Phase A+B).
- Feed interleaver integration.
- GAM passthrough tag for remnant.

### Phase 2 (Pacing + CPC + Reporting)

- PacingDaemon cron.
- CPC billing (click validation, Phase B on valid click).
- ClickLog + async IVT validation.
- DailyRollup aggregation pipeline.
- Advertiser dashboard (campaign stats from rollup + Redis live counters).
- AudienceSegment + lookalike batch computation.

### Phase 3 (Optimisation)

- pCTR model (logistic regression on impression/click history per placement+device+industry).
- SIVT heuristic (volume anomaly detection).
- CPA billing model.
- Retargeting segments from Connect activity events (profile views, post engagements).

---

## References

The following sources informed this document:

- Playwire: Ad Tech Stack Build vs. Buy -- https://www.playwire.com/blog/ad-tech-build-vs.-buy-series-ad-serving
- Kevel Open Source Ad Server Guide -- https://www.kevel.com/blog/open-source-ad-server
- Blockthrough CPM/eCPM Pricing Models -- https://blockthrough.com/blog/ad-tech-pricing-models-explained
- Google Ad Manager eCPM in Exchange -- https://support.google.com/admanager/answer/6334268
- Google Ad Manager Line Item Pacing -- https://support.google.com/admanager/answer/2669484
- LinkedIn Budget Pacing Paper (Agarwal et al.) -- http://www0.cs.ucl.ac.uk/staff/w.zhang/rtb-papers/linkedin-pacing.pdf
- Arxiv: A Practical Guide to Budget Pacing Algorithms -- https://arxiv.org/abs/2503.06942
- Kevel Ad Pacing Goals API -- https://dev.kevel.com/docs/ad-pacing-goals
- IAB MRC IVT Detection Guidelines -- https://www.iab.com/guidelines/mrc-invalid-traffic-ivt-detection-and-filtration-guidelines-addendum
- AdTech Book: Ad Fraud and Viewability -- https://adtechbook.clearcode.cc/ad-fraud-and-viewability
- LinkedIn Predictive Audiences -- https://www.linkedin.com/business/marketing/blog/linkedin-ads/predictive-audiences-b2b-targeting
- Catch Metrics: Next.js Ad Latency Optimization -- http://www.catchmetrics.io/blog/nextjs-ad-latency-optimization-strategies
- Upstash: Next.js Caching with Redis -- https://upstash.com/blog/nextjs-caching-with-redis
- ML Systems Weekly: CPM vs oCPM vs eCPM -- https://mlsystemsweekly.substack.com/p/cpm-cost-per-mille-vs-ocpm-optimized
