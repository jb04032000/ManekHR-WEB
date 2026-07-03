# Third-Party Ad Network Integration + India Compliance

## zari360 Connect - Research Findings

**Researched:** 2026-05-26
**Confidence:** MEDIUM-HIGH (official Google/Meta sources + Indian government rules verified; some implementation
details are community-verified)
**Scope:** Google AdSense vs GAM decision, Meta Audience Network web availability (hard blocker check),
India DPDP Act/Rules consent architecture, GPT on Next.js App Router, ads.txt/sellers.json,
GST treatment, day-one compliant rollout sequence.

---

## Table of Contents

1. [Hard Blocker: Meta Audience Network on Web](#1-hard-blocker-meta-audience-network-on-web)
2. [Google: AdSense vs Google Ad Manager](#2-google-adsense-vs-google-ad-manager)
3. [AdSense / GAM Eligibility and Site Review Hurdles](#3-adsense--gam-eligibility-and-site-review-hurdles)
4. [UGC/Social Platform Policy Risks](#4-ugcsocial-platform-policy-risks)
5. [GPT on Next.js App Router - Integration Guide](#5-gpt-on-nextjs-app-router---integration-guide)
6. [Script Weight and Core Web Vitals](#6-script-weight-and-core-web-vitals)
7. [India DPDP Act 2023 and DPDP Rules 2025 - Ad Targeting Compliance](#7-india-dpdp-act-2023-and-dpdp-rules-2025---ad-targeting-compliance)
8. [Consent Architecture: IAB TCF v2.2, Google Consent Mode v2, India DPDP](#8-consent-architecture-iab-tcf-v22-google-consent-mode-v2-india-dpdp)
9. [Consent Record Schema](#9-consent-record-schema)
10. [ads.txt / sellers.json / Brand Safety Basics](#10-adstxt--sellersjson--brand-safety-basics)
11. [GST and Tax Treatment of Ad Revenue - India](#11-gst-and-tax-treatment-of-ad-revenue---india)
12. [Step-by-Step Integration and Approval Sequence](#12-step-by-step-integration-and-approval-sequence)
13. [Day-One Minimum-Viable Compliant Rollout](#13-day-one-minimum-viable-compliant-rollout)
14. [Compliance Checklist](#14-compliance-checklist)
15. [Sources](#15-sources)

---

## 1. Hard Blocker: Meta Audience Network on Web

**VERDICT: Meta Audience Network does NOT support standard web publishers. It is a mobile-app SDK only.**

### Official Confirmation

The Meta Audience Network landing page at https://www.facebook.com/audiencenetwork/ states explicitly that the
network "empowers **app developers and publishers**" and lists only app-format inventory:

- Rewarded video ads (for gamers)
- Interstitial ads (during breaks in gameplay)
- Rewarded interstitial ads (in-game rewards)
- Native ads (app integration)
- Banner ads (app placement)

There is zero mention of web publisher support, desktop web, or mobile web monetization on the official product
page. The five ad formats are all tied to native app contexts, not browser DOM rendering.

The getting-started flow at https://www.facebook.com/audiencenetwork/getting-started leads to a mobile SDK
onboarding path, not a JavaScript tag or web integration.

### What "Over 10 Million Websites" Claims Mean

Some third-party articles claim Meta Audience Network reaches websites. This refers to the **advertiser side**:
Meta Audience Network places ads from Facebook advertisers INTO third-party apps and mobile web inventory.
For **publishers**, the intake channel is the mobile SDK. A browser-only Next.js web app cannot register as a
publisher in Meta Audience Network.

### Recommended Second Demand Source

Since Meta Audience Network is eliminated, the realistic second demand source for a web publisher is a
**programmatic SSP via Prebid.js header bidding**. Recommended options for Indian publishers:

| SSP                     | Notes                                                  | India Presence |
| ----------------------- | ------------------------------------------------------ | -------------- |
| **PubMatic / OpenWrap** | Prebid-native wrapper, strong APAC, good CPMs in India | Strong         |
| **Magnite (Rubicon)**   | Premium SSP, minimum traffic thresholds apply          | Moderate       |
| **Index Exchange**      | High quality demand, commonly paired with GAM          | Moderate       |
| **OpenX**               | Solid fill rates for APAC                              | Moderate       |

**Recommended path:** Implement Google Ad Manager (GAM) as the ad server. Connect AdX (Google Ad Exchange)
as the primary demand source. Add PubMatic OpenWrap (Prebid.js) as header bidding wrapper to bring in
Index Exchange and OpenX as additional SSPs. This replaces any Meta Audience Network dependency and
delivers real competitive pressure on your inventory.

---

## 2. Google: AdSense vs Google Ad Manager

### Decision Matrix

| Criterion                                   | AdSense            | Google Ad Manager (GAM) Free / GAM 360         |
| ------------------------------------------- | ------------------ | ---------------------------------------------- |
| Own direct/first-party ad sales             | Cannot manage      | Native support via direct line items           |
| Remnant/programmatic demand                 | Google demand only | AdX + header bidding + multiple SSPs           |
| Floor pricing                               | Not configurable   | Fully configurable                             |
| Ad unit granularity                         | Limited            | Complete control                               |
| Reporting                                   | Basic              | Advanced + custom dimensions                   |
| Header bidding (Prebid.js)                  | Not compatible     | Fully compatible                               |
| Private auction/PMP deals                   | No                 | Yes                                            |
| Multiple inventory types (web + future app) | No                 | Yes                                            |
| Minimum traffic                             | None specified     | GAM Free: no hard minimum; GAM 360: negotiated |
| Setup complexity                            | Very low           | Medium                                         |

### Recommendation: Google Ad Manager (GAM Free Tier)

zari360 Connect must use **Google Ad Manager**, not AdSense, for the following reasons:

1. The owner has decided to sell **first-party/direct ads** alongside remnant. AdSense cannot serve
   direct-sold line items. GAM is explicitly designed for this mixed model.

2. GAM is required to connect to **Google Ad Exchange (AdX)**, which provides significantly higher CPMs
   than the AdSense network alone.

3. GAM enables **Prebid.js header bidding** integration. This is the mechanism to bring in the PubMatic/
   Index Exchange second demand source that replaces Meta Audience Network.

4. GAM Free tier (formerly DFP Small Business) supports up to 90 million impressions/month with no cost.
   This is sufficient for early-stage traffic.

5. AdSense can still be **linked to GAM** as a demand source, capturing AdSense demand through the GAM
   waterfall, so no AdSense revenue is sacrificed.

### How to Link AdSense to GAM

Create an AdSense account, link it to your GAM network under Admin > Ad Exchange > AdSense linking.
AdSense then competes in the GAM unified auction. You get AdSense demand without the limitations of
AdSense-as-primary-ad-server.

---

## 3. AdSense / GAM Eligibility and Site Review Hurdles

### Google Account Requirements (source: Google AdSense Help - Eligibility Requirements)

- Publisher must be 18 years of age or older.
- Publisher must own and control the submitted domain.
- Site must not be previously terminated from AdSense.
- Application review takes 1-14 days (commonly cited), but can take up to 30 days for complex sites.

### Site Content Requirements

Google reviews both the publisher account and each submitted site URL. Key gates:

| Requirement                                 | Notes                                                                              |
| ------------------------------------------- | ---------------------------------------------------------------------------------- |
| Original, high-quality content              | AI-generated filler, thin content, or copied content = rejection                   |
| Sufficient content volume                   | No hard minimum stated, but reviewers look for established content                 |
| Clear navigation                            | Standard header/footer nav required                                                |
| Privacy Policy page                         | Must be accessible from every page; must describe data collection and ad use       |
| About Us page                               | Required for trust signals                                                         |
| Contact Us page                             | Required                                                                           |
| No prohibited content on any monetized page | Covers all pages where ad code appears, including UGC pages                        |
| Site age (unofficial)                       | Some sources note 6-month minimum for new sites, but this is not officially stated |

### GAM-Specific: AdX Access

AdX (the premium programmatic exchange within GAM) requires either:

- Automatic access via Google (granted when GAM account shows sufficient quality traffic), OR
- A GAM 360 contract (large publishers, negotiated CPMs, account manager assigned).

For a new platform, start with GAM Free. AdX access is typically provisioned automatically within weeks
of reaching quality traffic thresholds. There is no formal application for AdX in GAM Free - Google
evaluates and enables it.

---

## 4. UGC/Social Platform Policy Risks

### Core Policy Requirement (source: Google AdSense Help - UGC overview)

The publisher is **fully responsible** for all user-generated content on pages where ads appear. Google
states: "As a publisher, you need to be prepared to ensure that what they do post complies with all
applicable Program policies."

### Content Categories That Trip Policy Review

| Risk Category          | What Google Prohibits                                 | Mitigation for zari360 Connect                                |
| ---------------------- | ----------------------------------------------------- | ------------------------------------------------------------- |
| Adult/explicit content | Pornographic or sexually explicit material            | Pre-moderation or post-report workflows; community guidelines |
| Hate speech            | Content targeting groups by protected characteristics | Automated keyword filter + report-and-review workflow         |
| Harassment             | Personal attacks, doxxing                             | Report-and-remove flow with 24-hr SLA                         |
| Excessive profanity    | Pervasive profanity without redemptive value          | Profanity filter on post/comment submission                   |
| Dangerous content      | Drug sales, weapons, malware links                    | Link scanning on submission                                   |
| Spam/low-quality UGC   | Keyword-stuffed profiles/posts for SEO                | Rate limiting, CAPTCHA, spam classifier                       |

### Key Risk for a Professional Network

A professional network like zari360 Connect (LinkedIn-style for textile SMBs) has naturally lower
explicit-content risk than a general consumer social network. The main risks are:

- **Spam profiles** created to post SEO content or promote competitors.
- **Unverified product listings** in the marketplace section that violate pricing/trade policies.
- **Job postings** that contain discriminatory language (age, gender, caste restrictions - prohibited by
  Indian law as well).

### Required Moderation Infrastructure Before AdSense/GAM Approval

1. Published community guidelines page (linked from footer and onboarding flow).
2. Content reporting mechanism on every user-generated post, comment, and profile element.
3. Admin moderation queue with ability to remove content and suspend accounts.
4. Privacy Policy that explicitly discloses ad serving and data use.

---

## 5. GPT on Next.js App Router - Integration Guide

### Script Loading Strategy

Next.js App Router does NOT support the `strategy="worker"` (Partytown) mode. Use `afterInteractive`.

```tsx
// app/layout.tsx (root layout)
import Script from 'next/script';

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        {children}
        <Script
          id="gpt-script"
          src="https://securepubads.g.doubleclick.net/tag/js/gpt.js"
          strategy="afterInteractive"
        />
        <Script id="gpt-init" strategy="afterInteractive">
          {`
            window.googletag = window.googletag || { cmd: [] };
          `}
        </Script>
      </body>
    </html>
  );
}
```

### Ad Slot Component Pattern (SPA-safe)

The critical SPA problem: in Next.js App Router, route transitions do not unmount the root layout,
so GPT slots defined on one route linger when navigating to another. The component must destroy
and redefine slots on each route change.

```tsx
// components/ads/AdSlot.tsx
'use client';
import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';

interface AdSlotProps {
  adUnitPath: string; // e.g. '/12345678/connect-feed-banner'
  sizes: googletag.GeneralSize;
  divId: string; // must be unique per slot instance
  containerStyle?: React.CSSProperties;
}

export function AdSlot({ adUnitPath, sizes, divId, containerStyle }: AdSlotProps) {
  const pathname = usePathname();
  const slotRef = useRef<googletag.Slot | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.googletag) return;

    window.googletag.cmd.push(() => {
      // Destroy previous slot if it exists
      if (slotRef.current) {
        window.googletag.destroySlots([slotRef.current]);
        slotRef.current = null;
      }

      const slot = window.googletag
        .defineSlot(adUnitPath, sizes, divId)
        ?.addService(window.googletag.pubads());

      if (slot) {
        slotRef.current = slot;
        window.googletag.pubads().enableSingleRequest();
        window.googletag.enableServices();
        window.googletag.display(divId);
      }
    });

    return () => {
      window.googletag?.cmd.push(() => {
        if (slotRef.current) {
          window.googletag.destroySlots([slotRef.current]);
          slotRef.current = null;
        }
      });
    };
  }, [pathname, adUnitPath, divId]);

  // Reserve space to prevent CLS
  return (
    <div
      id={divId}
      style={{
        minWidth: Array.isArray(sizes) && sizes.length > 0 ? (sizes[0] as number[])[0] : 300,
        minHeight: Array.isArray(sizes) && sizes.length > 0 ? (sizes[0] as number[])[1] : 250,
        ...containerStyle,
      }}
    />
  );
}
```

### Ad Configuration File

```ts
// lib/ads/config.ts
export const AD_UNITS = {
  feedBanner: {
    path: '/YOUR_NETWORK_CODE/zari360-connect-feed',
    sizes: [
      [728, 90],
      [320, 50],
    ] as googletag.GeneralSize,
    id: 'div-ad-feed-banner',
  },
  sidebarBox: {
    path: '/YOUR_NETWORK_CODE/zari360-connect-sidebar',
    sizes: [
      [300, 250],
      [300, 600],
    ] as googletag.GeneralSize,
    id: 'div-ad-sidebar',
  },
} as const;
```

### Consent Gating (DPDP + Consent Mode v2)

GPT must be initialized differently depending on consent state:

```tsx
// Before consent is given: non-personalized ads (NPA)
window.googletag.cmd.push(() => {
  window.googletag.pubads().setRequestNonPersonalizedAds(1);
  window.googletag.pubads().setPrivacySettings({ nonPersonalizedAds: true });
});

// After consent granted: personalized ads
window.googletag.cmd.push(() => {
  window.googletag.pubads().setPrivacySettings({ nonPersonalizedAds: false });
});
```

---

## 6. Script Weight and Core Web Vitals

### GPT Script Impact

| Metric                              | Impact                                               | Mitigation                                                                                |
| ----------------------------------- | ---------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| LCP (Largest Contentful Paint)      | Low-medium: GPT loads async, does not block paint    | Use `afterInteractive`; ensure ad containers are below fold on mobile                     |
| CLS (Cumulative Layout Shift)       | HIGH risk if containers not pre-sized                | Always set explicit `min-width` / `min-height` on ad container divs before slot is filled |
| FID/INP (Interaction to Next Paint) | Low-medium: GPT JS execution adds task queue entries | Use `afterInteractive` + limit total third-party scripts on page                          |
| TBT (Total Blocking Time)           | Low: GPT is async                                    | Avoid synchronous GPT initialization                                                      |

### Consent SDK Weight (e.g., CookieYes / Osano)

A consent banner SDK adds approximately 15-40 KB gzipped. Load it with `beforeInteractive` ONLY if
legal strictness requires it (i.e., if DPDP requires consent before any JS fires). Otherwise use
`afterInteractive` with GPT blocked until consent resolves.

For DPDP (India): the law does not yet require a cookie-blocking mechanism equivalent to GDPR
(enforcement starts May 2027). A lightweight first-party consent banner with localStorage persistence
is sufficient for day-one compliance. See Section 13.

### Recommended Script Budget

| Script                 | Strategy         | Max Budget   |
| ---------------------- | ---------------- | ------------ |
| GPT (gpt.js)           | afterInteractive | ~75 KB gzip  |
| Consent banner         | afterInteractive | 40 KB gzip   |
| Prebid.js (if used)    | afterInteractive | ~100 KB gzip |
| Total ad-tech overhead | -                | ~215 KB gzip |

Keep total third-party payload under 300 KB gzipped to maintain a passing Core Web Vitals score.

---

## 7. India DPDP Act 2023 and DPDP Rules 2025 - Ad Targeting Compliance

### Legislation Summary

- **Digital Personal Data Protection Act, 2023** - enacted August 11, 2023.
- **DPDP Rules, 2025** - notified November 13-14, 2025.
- **Enforcement dates:** Rules 1, 2, 17-21 effective immediately (November 2025). Consent Manager
  registration rule (Rule 4) effective November 2026. All substantive provisions (notice, consent,
  rights, cross-border, children rules) effective **May 13, 2027**.

This means: full DPDP enforcement is not yet active, but building compliant infrastructure NOW is the
correct approach because retrofitting consent into an established user base is significantly harder.

### Key Obligations for an Ad-Serving Platform

| Obligation                                  | What it requires                                                                                                                                      |
| ------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Consent before personal data processing** | Explicit, free, specific, informed, unconditional consent before using personal data for ad targeting                                                 |
| **Purpose limitation**                      | Consent for "advertising personalization" cannot be re-used for "analytics" or "CRM" without separate consent                                         |
| **Notice requirements**                     | Every consent request must be accompanied by a notice: categories of data, purposes, grievance mechanism, withdrawal procedure, contact info          |
| **Consent withdrawal**                      | Must be as easy to withdraw as to grant; platform must honor withdrawals within reasonable time                                                       |
| **Data principal rights**                   | Right to access, correction, erasure, and grievance redressal must be operable                                                                        |
| **Children / under-18**                     | Verifiable parental consent required. Behavioral monitoring and targeted advertising to under-18s is PROHIBITED without Central Government permission |
| **Third-party processors**                  | Platform remains responsible for data shared with Google/ad networks; processor contracts (DPAs) must be in place with Google                         |
| **Cross-border transfer**                   | Permitted by default (negative list model) unless Central Government restricts specific countries. Google's infrastructure is currently unrestricted  |
| **Security safeguards**                     | Appropriate technical and organizational measures for personal data shared with ad networks                                                           |

### Children/Under-18 Hard Rule

This is the **most material hard blocker for personalized ads** on zari360 Connect.

The DPDP Act bans targeted advertising to under-18 users without specific Central Government authorization.
Because zari360 Connect is a professional network for SMBs, the realistic user base should be 18+.
However, the platform must:

1. Collect date-of-birth or age attestation at registration.
2. Gate ad personalization to verified 18+ users only.
3. Serve **non-personalized (contextual) ads only** to any user who has not confirmed age, or who is
   confirmed under 18.

### Cross-Border Transfer to Google

Google's ad infrastructure processes data on servers outside India. Under DPDP Rules 2025 (Rule 15),
cross-border transfer is permitted to all destinations unless the Central Government issues a blocking
order for a specific country/entity. As of the research date, no such restriction exists for Google.

However, the privacy notice shown to users must disclose that personal data may be transferred to
Google's servers outside India for ad personalization purposes.

---

## 8. Consent Architecture: IAB TCF v2.2, Google Consent Mode v2, India DPDP

### Does India Require IAB TCF?

**No.** IAB TCF v2.2/v2.3 is a legal requirement only for the EEA (EU/GDPR), UK, and Switzerland.
Google's mandatory certified-CMP requirement (enforced January 2024) applies only to publishers serving
personalized ads to users in those jurisdictions.

For an India-only platform, IAB TCF is technically not required. However, implementing
**Google Consent Mode v2** is strongly recommended because:

- It allows GAM/AdSense to adjust ad behavior based on consent signals even without full TCF.
- It enables Google's **modeled conversions** for advertisers (improving CPM yield for the publisher).
- It future-proofs the platform if international expansion occurs.

### Recommended Consent Architecture

Implement a lightweight **first-party consent system** with these components:

#### Layer 1: First-Party Consent Banner

A custom banner (not a third-party CMP SDK) that:

- Appears on first visit and after login for new users.
- Presents three clearly labeled purposes: (a) Necessary/functional, (b) Analytics, (c) Ad personalization.
- Does NOT pre-tick optional categories.
- Records consent to the platform's own backend (see schema below).
- Stores a `consentToken` in a first-party cookie and `localStorage` for session persistence.

#### Layer 2: Google Consent Mode v2 Integration

Before loading GPT, set Google Consent Mode signals:

```html
<!-- In <head>, before any Google tags -->
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag() {
    dataLayer.push(arguments);
  }

  // Default state: deny everything until consent
  gtag('consent', 'default', {
    ad_storage: 'denied',
    ad_user_data: 'denied',
    ad_personalization: 'denied',
    analytics_storage: 'denied',
    wait_for_update: 500,
  });
</script>
```

After user grants consent:

```js
// Called from consent banner callback on accept
function applyGoogleConsent(consentRecord) {
  gtag('consent', 'update', {
    ad_storage: consentRecord.adPersonalization ? 'granted' : 'denied',
    ad_user_data: consentRecord.adPersonalization ? 'granted' : 'denied',
    ad_personalization: consentRecord.adPersonalization ? 'granted' : 'denied',
    analytics_storage: consentRecord.analytics ? 'granted' : 'denied',
  });
}
```

#### Layer 3: GPT Non-Personalized Ads (NPA) Flag

```js
// Set on GAM/AdSense request when ad_storage is denied
googletag.pubads().setRequestNonPersonalizedAds(1); // 1 = non-personalized
```

#### Layer 4: Backend Consent Record (DPDP audit trail)

All consent decisions must be stored server-side (see schema in Section 9) to satisfy DPDP requirements
for demonstrable consent and the 7-year retention requirement for consent records when a Consent Manager
is used.

### Should You Use a Third-Party CMP?

For day-one India-only launch, a custom lightweight banner is sufficient and avoids the 15-40 KB SDK
overhead. If the platform expands to EEA users, a Google-certified CMP supporting IAB TCF v2.3 will
become mandatory at that point (by February 2026 deadline for TCF v2.3).

Recommended CMPs if/when needed: **CookieYes, Usercentrics, Osano** - all Google-certified, all support
TCF v2.3 and Consent Mode v2 simultaneously.

---

## 9. Consent Record Schema

This schema must be persisted in MongoDB (or equivalent) per user session/action. This is the audit
trail required by DPDP to demonstrate that consent was obtained lawfully.

### MongoDB Collection: `consent_records`

| Field                        | Type                 | Required               | Notes                                                                                            |
| ---------------------------- | -------------------- | ---------------------- | ------------------------------------------------------------------------------------------------ |
| `_id`                        | ObjectId             | yes                    | Primary key                                                                                      |
| `userId`                     | ObjectId (ref: User) | yes (if authenticated) | Null for pre-auth anonymous consent                                                              |
| `sessionId`                  | String               | yes                    | Browser session identifier (first-party cookie value)                                            |
| `workspaceId`                | ObjectId             | no                     | Populated after login                                                                            |
| `consentToken`               | String (UUID v4)     | yes                    | Stable token stored in first-party cookie; links future sessions to this record                  |
| `recordedAt`                 | Date                 | yes                    | UTC timestamp of consent action                                                                  |
| `ipAddress`                  | String               | yes                    | Hashed or truncated (last octet zeroed) - do not store raw IP per DPDP minimal data principle    |
| `userAgent`                  | String               | yes                    | Browser UA string for audit evidence                                                             |
| `consentVersion`             | String               | yes                    | Version of the consent notice shown, e.g., "1.0.0"                                               |
| `locale`                     | String               | yes                    | Locale shown to user: en / gu / gu-en / hi-en                                                    |
| `action`                     | Enum                 | yes                    | `granted` or `denied` or `withdrawn`                                                             |
| `purposes.necessary`         | Boolean              | yes                    | Always true; functional cookies                                                                  |
| `purposes.analytics`         | Boolean              | yes                    | Analytics/performance tracking consent                                                           |
| `purposes.adPersonalization` | Boolean              | yes                    | Personalized ad targeting consent                                                                |
| `purposes.adMeasurement`     | Boolean              | yes                    | Ad conversion measurement consent                                                                |
| `dataCategories`             | String[]             | yes                    | List of data categories consented to, e.g., `["device_id", "browsing_behavior", "profile_data"]` |
| `processingPurposes`         | String[]             | yes                    | List of purposes: `["analytics", "ad_targeting", "ad_measurement"]`                              |
| `thirdParties`               | String[]             | yes                    | Third parties named at time of consent: `["Google LLC", "PubMatic Inc"]`                         |
| `crossBorderTransfer`        | Boolean              | yes                    | Whether user was informed of cross-border transfer (true for Google)                             |
| `withdrawalMethod`           | String               | no                     | Populated on `action=withdrawn`: "banner", "settings_page", "api"                                |
| `withdrawnAt`                | Date                 | no                     | UTC timestamp if action is `withdrawn`                                                           |
| `ageVerified`                | Boolean              | yes                    | Whether user confirmed age >= 18 at time of consent (gates personalized ads)                     |
| `parentalConsentToken`       | String               | no                     | If user is under 18, token from parent/guardian consent flow                                     |
| `retainUntil`                | Date                 | yes                    | `recordedAt + 7 years` (DPDP 7-year retention for Consent Manager records)                       |

### Indexes Required

```js
// Lookup by user
{ userId: 1, recordedAt: -1 }

// Lookup by session/token
{ consentToken: 1 }

// TTL index for auto-expiry after 7 years
{ retainUntil: 1 }, { expireAfterSeconds: 0 }

// Audit queries by date
{ recordedAt: -1 }
```

### Consent Notice Version Registry

Maintain a separate `consent_notice_versions` collection:

| Field                | Type     | Notes                                                    |
| -------------------- | -------- | -------------------------------------------------------- |
| `version`            | String   | e.g., "1.0.0"                                            |
| `effectiveFrom`      | Date     | When this version became active                          |
| `changeLog`          | String   | What changed from prior version                          |
| `noticeTextHash`     | String   | SHA-256 of canonical notice text shown to users          |
| `thirdPartiesListed` | String[] | Exact list of third parties named in this notice version |

---

## 10. ads.txt / sellers.json / Brand Safety Basics

### ads.txt (Authorized Digital Sellers)

ads.txt is a plain-text file placed at the domain root (`https://yoursite.com/ads.txt`) that declares
which companies are authorized to sell your ad inventory. It is **required by Google** for AdSense and
GAM publishers. Without it, Google may limit ad delivery or CPM yield.

**Minimum required entries for zari360 Connect:**

```
# ads.txt for zari360 Connect
google.com, YOUR_PUBLISHER_ID, DIRECT, f08c47fec0942fa0
google.com, YOUR_PUBLISHER_ID, RESELLER, f08c47fec0942fa0
```

If using PubMatic OpenWrap header bidding, add PubMatic's ads.txt entries (available from PubMatic
publisher portal after signup).

**Where to find YOUR_PUBLISHER_ID:** GAM Admin > Global Settings > Network Code (a numeric string
like "12345678").

**Maintenance:** Every new demand partner (SSP) added via header bidding requires adding their
ads.txt entries. Treat this as a required PR step for any new SSP integration.

### sellers.json

sellers.json is a file Google publishes at https://storage.googleapis.com/adx-rtb-dictionaries/sellers.json
that buyers use to verify seller identity. As a publisher using GAM, you do not host sellers.json yourself;
Google lists your publisher ID in theirs. You must verify your domain is correctly associated in GAM settings.

### Brand Safety Settings in GAM

In GAM, under Inventory > Ad Exchange rules:

- Set content category blocking (e.g., block "Competitive brands").
- Set sensitive category restrictions (alcohol, gambling, etc.) appropriate for a professional network
  audience.
- Enable frequency capping to prevent ad fatigue.
- Set a floor price to avoid low-quality remnant ads appearing on premium inventory.

---

## 11. GST and Tax Treatment of Ad Revenue - India

### Treatment of AdSense/GAM Revenue

Google pays Indian publishers through **Google Asia Pacific Pte Ltd** (Singapore entity). Under Indian
GST law, this makes the publisher's service an **export of services** to a foreign entity.

| Scenario                               | GST Treatment                     |
| -------------------------------------- | --------------------------------- |
| Ad revenue from Google (AdSense/GAM)   | Export of services - 0% GST rate  |
| Direct-sold ads to Indian advertisers  | Domestic supply - 18% GST applies |
| Direct-sold ads to foreign advertisers | Export of services - 0% GST rate  |

### LUT Requirement

To export services without paying GST and claiming refund later, the company must file a **Letter of
Undertaking (LUT)** with the GST department annually. LUT filing is free and done via the GST portal
(gstin.gov.in). Without LUT, the company must pay IGST on exports and then claim a refund, which
creates cash flow issues.

### GST Registration Threshold

GST registration is mandatory for any entity providing taxable inter-state supplies. Importantly,
the standard threshold exemptions (Rs. 20 lakh / Rs. 10 lakh for special category states) do NOT
apply to export services or to suppliers of OIDAR (Online Information Database Access and Retrieval)
services. An ad-tech platform may qualify as an OIDAR service provider, which requires GST
registration from the first rupee of revenue.

**Recommendation:** Consult a CA (Chartered Accountant) to determine OIDAR applicability and
register for GST immediately upon revenue commencement.

### Income Tax

Ad revenue is ordinary business income subject to corporate income tax at the applicable rate
(25% for eligible domestic companies under Section 115BAA, or 22% reduced rate if no exemptions
claimed). TDS may be deducted by Indian advertisers on direct-sold ad payments; ensure the platform
issues Form 15CA/15CB for foreign remittances.

---

## 12. Step-by-Step Integration and Approval Sequence

### Phase 1: Pre-Launch Legal and Content Infrastructure (Week 1-2)

| Step | Action                                                             | Lead Time                         | Owner       |
| ---- | ------------------------------------------------------------------ | --------------------------------- | ----------- |
| 1.1  | Publish Privacy Policy page (linked from footer + onboarding)      | 1 day                             | Dev + Legal |
| 1.2  | Publish Terms of Service page                                      | 1 day                             | Legal       |
| 1.3  | Publish Community Guidelines page                                  | 1 day                             | Product     |
| 1.4  | Add content reporting mechanism to all UGC surfaces                | 3-5 days                          | Dev         |
| 1.5  | Add admin moderation queue (remove/suspend)                        | 3-5 days                          | Dev         |
| 1.6  | Add age attestation (18+) gate at registration                     | 1-2 days                          | Dev         |
| 1.7  | Build consent banner (first-party, DPDP-compliant)                 | 3-5 days                          | Dev         |
| 1.8  | Build consent record backend (`consent_records` collection + APIs) | 3-5 days                          | Dev         |
| 1.9  | Register for GST / file LUT                                        | 2-4 weeks (filing to certificate) | Finance/CA  |

### Phase 2: Google Account and Property Setup (Week 2-3)

| Step | Action                                                               | Lead Time                  | Notes                              |
| ---- | -------------------------------------------------------------------- | -------------------------- | ---------------------------------- |
| 2.1  | Create Google Ad Manager account (free tier) at admanager.google.com | 1 day                      | Requires Google account; immediate |
| 2.2  | Create GAM network; note Network Code                                | 1 day                      |                                    |
| 2.3  | Add zari360 Connect domain to GAM; submit for review                 | 1-14 days                  | Google crawls and reviews site     |
| 2.4  | Create AdSense account; link to GAM network                          | 1 day (after GAM approved) | Linking is near-instant            |
| 2.5  | Set up ads.txt file on domain root                                   | 1 day                      | Required before ad serving         |
| 2.6  | Create ad units in GAM (define sizes, targeting keys)                | 1-2 days                   |                                    |
| 2.7  | Enable AdX in GAM (auto-provisioned)                                 | 1-14 days waiting          | Google reviews traffic quality     |

**GAM site review lead time: 1-14 days. AdX provisioning: 1-14 days after GAM approved. Plan 4 weeks
total buffer from signup to first live ad.**

### Phase 3: GPT Integration in Next.js (Week 3-4)

| Step | Action                                                                          | Notes         |
| ---- | ------------------------------------------------------------------------------- | ------------- |
| 3.1  | Add `<Script>` tag for gpt.js to root layout with `strategy="afterInteractive"` | See Section 5 |
| 3.2  | Implement `AdSlot` component with slot destroy/redefine on route change         | See Section 5 |
| 3.3  | Add Google Consent Mode v2 default-deny snippet to `<head>` (before GPT)        | See Section 8 |
| 3.4  | Wire consent banner callback to `gtag('consent', 'update', ...)`                | See Section 8 |
| 3.5  | Set `setRequestNonPersonalizedAds(1)` when ad consent is denied                 | See Section 5 |
| 3.6  | Add CSS `min-height` / `min-width` to all ad containers to prevent CLS          | See Section 6 |
| 3.7  | Test with GAM Ad Preview Tool; verify NPA mode when consent denied              |               |

### Phase 4: Second Demand Source - Prebid.js + PubMatic (Week 4-6)

| Step | Action                                                                    | Lead Time       | Notes                                                              |
| ---- | ------------------------------------------------------------------------- | --------------- | ------------------------------------------------------------------ |
| 4.1  | Sign up for PubMatic publisher account at pubmatic.com                    | 1-5 days review | Requires minimum traffic metrics; may need to revisit after launch |
| 4.2  | Generate Prebid.js bundle with PubMatic + Index Exchange adapters         | 1 day           | At prebid.org/download                                             |
| 4.3  | Integrate OpenWrap (PubMatic's header bidding wrapper) with GAM           | 2-3 days        | OpenWrap generates GAM line items automatically                    |
| 4.4  | Add SSP ads.txt entries from PubMatic/Index Exchange portals              | 1 day           |                                                                    |
| 4.5  | QA: verify header bidding auctions firing, CPM competition visible in GAM | 2-3 days        |                                                                    |

**Note:** Some SSPs have minimum monthly pageview requirements (PubMatic: approx. 500K-1M/month for
direct relationships). For early-stage traffic, GAM + AdX alone is sufficient. Add Prebid/SSPs
once traffic meets thresholds.

### Phase 5: Direct-Sold Ad Capability (Milestone, not Day 1)

| Step | Action                                                                          |
| ---- | ------------------------------------------------------------------------------- |
| 5.1  | Create GAM Order and Line Item templates for direct-sold placements             |
| 5.2  | Build advertiser-facing self-serve interface (links to existing billing system) |
| 5.3  | Generate creatives in GAM; traffic against defined line items                   |
| 5.4  | Implement frequency capping and targeting keys                                  |

---

## 13. Day-One Minimum-Viable Compliant Rollout

### What "Day One Compliant" Means

Given that DPDP full enforcement begins May 2027 and Google's strict CMP requirement is EEA-only,
a day-one India launch can be compliant with a lightweight implementation. The guiding principle is:
**serve only contextual (non-personalized) ads until explicit consent is given.**

### Mandatory Day-One Components

| Component                                                | Required | Reason                                                        |
| -------------------------------------------------------- | -------- | ------------------------------------------------------------- |
| Privacy Policy (published, linked)                       | YES      | Google AdSense/GAM prerequisite; DPDP notice requirement      |
| Terms of Service                                         | YES      | Legal protection; AdSense prerequisite                        |
| Community Guidelines                                     | YES      | UGC moderation prerequisite for AdSense                       |
| Content reporting mechanism                              | YES      | UGC policy compliance                                         |
| Age attestation at registration                          | YES      | DPDP children rule; gates personalized ads                    |
| First-party consent banner                               | YES      | DPDP consent requirement (best practice even pre-enforcement) |
| Consent record storage (DB)                              | YES      | DPDP audit trail; 7-year retention standard                   |
| Google Consent Mode v2 default-deny                      | YES      | GPT consent signaling                                         |
| Non-personalized ads (NPA) as default                    | YES      | Before consent; DPDP spirit compliance                        |
| ads.txt file                                             | YES      | Google policy prerequisite                                    |
| GST registration + LUT (if revenue > threshold or OIDAR) | YES      | Tax compliance                                                |

### Optional Day-One (Can Follow in Week 2-4)

| Component                  | Why Deferrable                                                               |
| -------------------------- | ---------------------------------------------------------------------------- |
| Prebid.js / header bidding | Requires minimum traffic; SSP relationships take time                        |
| IAB TCF v2.2/v2.3 CMP      | Only required for EEA users; India-only launch can use Consent Mode v2 alone |
| Direct-sold ad UI          | Business development step; not a technical prerequisite                      |

### Day-One Ad Serving State Machine

```
User visits zari360 Connect
  |
  v
[Consent banner displayed: purposes (a)(b)(c)]
  |
  +-- User dismisses / denies all --> serve CONTEXTUAL ads only (NPA flag on GPT)
  |
  +-- User accepts analytics only --> serve CONTEXTUAL ads; fire analytics tags
  |
  +-- User accepts ad personalization AND age >= 18 verified
       --> serve PERSONALIZED ads (Consent Mode v2 granted)
  |
  +-- User is under 18 (age attestation)
       --> serve CONTEXTUAL ads ONLY (no personalization, ever, unless parental consent obtained)
```

### Approval Timeline Summary

| Milestone                                           | Realistic Duration                                |
| --------------------------------------------------- | ------------------------------------------------- |
| Legal pages, consent banner, moderation infra built | 1-2 weeks dev                                     |
| GAM account created, domain submitted               | Day 1                                             |
| GAM site review complete                            | 1-14 days (median ~5 days for professional sites) |
| AdSense linked to GAM                               | 1 day after GAM approval                          |
| First ads serving (contextual/NPA)                  | Day after GAM approval                            |
| AdX (programmatic exchange) provisioned             | 1-14 days after first traffic                     |
| Personalized ads live (consent granted users)       | Same day consent banner ships                     |
| Prebid.js / second SSP live                         | 3-6 weeks post-launch                             |
| GST LUT certificate                                 | 2-4 weeks from filing                             |

**Realistic earliest date to first ad impression: 2-3 weeks from starting this checklist.**

---

## 14. Compliance Checklist

### Pre-Launch Legal

- [ ] Privacy Policy published at `/privacy` and linked from footer on every page
- [ ] Privacy Policy discloses: ad serving, data categories collected, third-party ad partners named
      (Google LLC, and others), cross-border data transfer to Google's servers
- [ ] Terms of Service published at `/terms`
- [ ] Community Guidelines published at `/guidelines`
- [ ] Content reporting mechanism live on all UGC surfaces
- [ ] Admin moderation queue operational

### DPDP Consent

- [ ] Consent banner implemented with three purposes: Necessary / Analytics / Ad personalization
- [ ] None of the optional purposes are pre-ticked
- [ ] Withdrawal mechanism available from Settings page (not just banner)
- [ ] `consent_records` collection schema deployed with all fields per Section 9
- [ ] Consent notice version registry deployed
- [ ] Consent token stored in first-party cookie (not third-party) on the platform domain
- [ ] Age attestation (18+) collected at registration and stored on user profile
- [ ] Under-18 users excluded from ad personalization in all ad request code paths

### Google Consent Mode v2

- [ ] Default-deny snippet in `<head>` before any Google scripts
- [ ] `gtag('consent', 'update', ...)` called immediately when consent banner callback fires
- [ ] `ad_storage`, `ad_user_data`, `ad_personalization` all wired to consent record
- [ ] `wait_for_update: 500` set to prevent race condition on page load

### GPT / GAM Technical

- [ ] gpt.js loaded via Next.js `<Script strategy="afterInteractive">`
- [ ] All ad container divs have explicit `min-width` and `min-height` (CLS prevention)
- [ ] `AdSlot` component destroys slots on unmount and route change (SPA safety)
- [ ] `setRequestNonPersonalizedAds(1)` set when ad personalization consent is denied
- [ ] GAM Network Code matches ads.txt entries
- [ ] AdSense linked to GAM network

### ads.txt

- [ ] `ads.txt` file present at domain root (HTTPS)
- [ ] Google entries correct with actual Network Code
- [ ] All active SSPs listed
- [ ] ads.txt updated as part of offboarding checklist for any SSP change

### GST / Tax

- [ ] GST registration status determined with CA (check OIDAR applicability)
- [ ] LUT filed annually if exporting services
- [ ] Invoicing setup for direct-sold ads to Indian advertisers (18% GST on invoice)
- [ ] Income tax treatment documented

### Ongoing

- [ ] Quarterly review of consent notice version; re-consent required if third parties change
- [ ] Moderation queue reviewed daily (or automated with 24-hr SLA)
- [ ] GAM policy report reviewed monthly (flag page-level demonetization events)
- [ ] ads.txt validated monthly via Google Search Console or ads.txt validator

---

## 15. Sources

| Source                                                       | URL                                                                                                                                                                      | Confidence  |
| ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------- |
| Meta Audience Network official product page                  | https://www.facebook.com/audiencenetwork/                                                                                                                                | HIGH        |
| Meta Audience Network getting started                        | https://www.facebook.com/audiencenetwork/getting-started                                                                                                                 | HIGH        |
| Google: AdSense vs Ad Manager vs AdMob                       | https://support.google.com/admanager/answer/9234653                                                                                                                      | HIGH        |
| Google AdSense UGC policy overview                           | https://support.google.com/adsense/answer/1355699                                                                                                                        | HIGH        |
| Google AdSense eligibility requirements                      | https://support.google.com/adsense/answer/9724                                                                                                                           | HIGH        |
| Google AdSense program policies                              | https://support.google.com/adsense/answer/48182                                                                                                                          | HIGH        |
| India DPDP Act 2023 and DPDP Rules 2025 (CookieYes analysis) | https://www.cookieyes.com/blog/india-digital-personal-data-protection-act-dpdpa/                                                                                         | MEDIUM-HIGH |
| DPDP Rules 2025 - consent.in analysis                        | https://www.consent.in/blog/dpdp-rules                                                                                                                                   | MEDIUM-HIGH |
| DPDP cross-border transfer (DPDPA.com)                       | https://www.dpdpa.com/dpdparules/rule15.html                                                                                                                             | MEDIUM      |
| DPDP ad-tech implications (Exchange4media)                   | https://www.exchange4media.com/digital-news/dpdp-rules-2025-third-party-datafuelled-ad-tech-faces-a-tough-challenge-149507.html                                          | MEDIUM      |
| India DPDPA rules enforcement (Storyboard18)                 | https://www.storyboard18.com/advertising/dpdpa-rules-set-to-reshape-indias-digital-ads-short-term-pain-for-e-commerce-long-term-gains-for-high-quality-consent-84305.htm | MEDIUM      |
| IAB TCF v2.3 requirements (CookieYes)                        | https://www.cookieyes.com/blog/iab-tcf-v2-3-explained/                                                                                                                   | HIGH        |
| Google Consent Mode v2 (Termly)                              | https://termly.io/resources/articles/what-is-google-consent-mode-v2/                                                                                                     | MEDIUM      |
| GPT in Next.js 15 App Router (dev.to)                        | https://dev.to/muhammadazfaraslam/implementing-google-publisher-tag-ads-in-nextjs-15-single-page-application-2025-3kof                                                   | MEDIUM      |
| Next.js Script component Chrome DevRel                       | https://developer.chrome.com/blog/script-component                                                                                                                       | HIGH        |
| Next.js SEO third-party scripts docs                         | https://nextjs.org/learn-pages-router/seo/improve/third-party-scripts                                                                                                    | HIGH        |
| GST on AdSense revenue India                                 | https://getswipe.in/blog/article/gst-on-revenue-from-google-adsense-and-online-advertising                                                                               | MEDIUM      |
| GST export of services for AdSense                           | https://www.jurishour.in/columns/gst-income-google-adsense-youtube-blogging/                                                                                             | MEDIUM      |
| Best SSPs for publishers 2025                                | https://www.publisher-collective.com/blog/best-ssps-for-publishers                                                                                                       | MEDIUM      |
| PubMatic OpenWrap (SSP product page)                         | https://pubmatic.com/products/pubmatic-ssp-for-publishers/                                                                                                               | HIGH        |

---

_Document generated: 2026-05-26. Enforcement deadlines (especially DPDP May 2027) should be re-verified
against official Government of India gazette notifications before implementation._
