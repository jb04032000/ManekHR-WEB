# Landing + Connect page redesign plan

**Date:** 2026-06-14
**Scope:** `/` (home) and `/connect` public marketing pages.
**Goal:** Stop the page reading as an online shop. Make it read, in 3 seconds, as the textile trade's **network + marketplace + hiring** platform. Add the hooks, curiosity, trust and engagement a best-in-class B2B landing page needs.
**Source of truth for copy:** `docs/marketing/connect/connect-positioning-and-messaging.md` (already verified). This plan does **not** change positioning, it fixes how the pages express it.

---

## 1. Diagnosis - why it currently looks like an ecommerce site

The single biggest cause is the **hero illustration**, which is shared by both `/` and `/connect` (`HeroMock` in `components/marketing/mockups.tsx`):

- It is one shop storefront with a 3-product grid, hard prices (`₹1,450`, `₹85/m`, `₹240/roll`), "Min. order 1 piece · ships in 4 days", and a "Contact seller" button.
- Product grid + price tags + a buy-style button is the universal visual language of an **online store**. It is the first and largest thing the eye lands on, so the brain files the whole product as "a shop", regardless of the headline.

Secondary causes:

1. **No "three jobs" signal up top.** The strategy is network + marketplace + hiring, but the hero shows only the marketplace-as-shop slice. A first-time visitor never sees that this is also a feed/network and a hiring platform until they scroll.
2. **Same hero on both pages.** `/` (whole platform incl. ERP) and `/connect` (the network product) lead with the identical shop card, so neither has its own identity.
3. **The sharpest hook is missing from the fold.** The positioning's strongest wedge - "real, verified textile businesses, not a wall of fake leads" - appears nowhere near the top. The current headline is a category label ("network and marketplace"), not a hook.
4. **No honest trust signal above the fold.** Research is clear that B2B pages convert on trust shown early. We are early-stage so we cannot fake logos or user counts, but we are showing none of the honest signals we do have (Verified, ERP-backed, free, multilingual).
5. **Module framing is flat.** The home "modules" section is a 5-icon grid titled "Everything a textile business needs to be found" - useful, but it presents five tools before it has established the three jobs they ladder up to.

What is already good (keep): the `/connect` module deep-dive sections already use correct per-feature mockups (feed, storefront, quotes, jobs, chat); copy is on-brand and follows the terminology rules; motion, mobile sticky CTA, FAQ, i18n across four locales, and JSON-LD are all in place.

---

## 2. Research basis (B2B network/marketplace landing pages, 2025-2026)

- **Hero must demonstrate the product's value in 3-5 seconds with a story-driven visual**, not a static tag. Leading B2B pages (Linear/Notion-style) show the actual product workflow, not a generic image.
- **Lead with outcome/problem, not a category label.** Short headline (ideally under ~8 words), value-driven CTA.
- **Trust shown above the fold lifts conversion materially** (logos +69%, titled testimonials +18.7% in cited studies). For us, that means honest trust chips and the "verified" wedge, not invented numbers.
- **Social proof must be real.** Our own rule (mockups.tsx) already bans fabricated engagement metrics and fake people. The plan respects this: no invented counts, no fake logos. We use trust _mechanics_ (Verified on Zari360, ERP-backed, ratings only after a real deal, free, multilingual) as the proof, plus "starting from Surat" as honest framing.

Sources: Instapage B2B landing best practices 2026; VentureHarbour; Flockler/Fomo/WiserNotify on above-the-fold social proof. (Links in the chat summary.)

---

## 3. The fix - hero (the 80/20)

### 3a. New hero visual (replaces the storefront card)

Build a **"three-in-one" composite** that telegraphs all three jobs at a glance, leading with **people and activity, not price tags**:

- A small **feed/network card** (a verified business posting work) as the hero anchor - signals "network", not "store".
- A **verified business / enquiry** chip (marketplace) - emphasise "Verified" and "enquiry/chat", de-emphasise hard prices.
- A **job card** (hiring) - "Skill match", apply-by-voice.

Concretely: compose from the mocks that already exist (`FeedMock`, `StorefrontMock`/`RfqMock`, `JobsMock`) into a layered/stacked or triptych arrangement, OR build one new `NetworkHeroMock`. Remove the price-list framing from the lead tile. Keep the single allowed looping highlight.

### 3b. New hero copy

Lead with the three jobs + the "stop juggling" problem hook (this is the direction the owner flagged as right):

- **Eyebrow:** BUILT FOR THE TEXTILE TRADE
- **Headline:** "Where the textile trade connects, sells, and hires."
- **Sub:** "One place for the whole textile industry. Find suppliers and buyers, hire skilled people, and run your business - instead of juggling WhatsApp groups, paper, and scattered apps."
- **Trust line under the CTAs:** "Real, verified businesses, not a wall of fake leads." + chips: Verified on Zari360 · Free to start · Gujarati, Hindi, English.
- **CTAs:** primary "Join free", secondary "See how it works".

### 3c. Differentiate the two pages

- **`/` (home):** the whole Zari360. Connect (network+marketplace+hiring) is the hero; ERP stays the companion band lower down. Headline as 3b.
- **`/connect`:** the Connect product specifically. Same anti-ecommerce visual, but headline stays product-focused ("Be found. Sell your work. Hire your people.") and the page keeps its deeper module dive. Give it its own hero mock variant so the two pages are not identical.

---

## 4. The fix - page structure

### Home (`/`) - proposed order

1. **Hero** (new visual + copy, section 3).
2. **"Three things, one place"** - NEW framing section: Network / Marketplace / Hiring as three clear pillars, each one line + its mock. This sets the mental model before the 5-tool grid. (Pulls the three-layer story straight from the positioning doc.)
3. **How it works** (keep 3 steps).
4. **The tools** (current ModuleShowcase, reframed as "the five tools inside" so it ladders under the three pillars).
5. **Who it's for** (keep audience strip).
6. **Trust wedge** - NEW or elevated: "Talk to real, verified businesses" with the honest trust mechanics (Verified on Zari360, ERP-backed, ratings only after a real deal, direct/no-commission). This is the curiosity + differentiation hook.
7. **Pricing story** (keep - free, pay only for reach).
8. **ERP companion** (keep, secondary).
9. **FAQ → Final CTA → mobile sticky CTA** (keep).

### Connect (`/connect`) - proposed order

Mostly keep; two changes: new anti-ecommerce hero (3c), and pull the **trust wedge higher** (currently `ConnectTrust` sits below boosts; move it above so trust lands before monetization talk). Everything else (ConnectSteps, ConnectModules deep-dive, CtaBands, BoostExplainer, ConnectBuiltFor, FAQ) stays.

---

## 5. Engagement / hooks / UX checklist

- Replace category-label headline with outcome + problem hook (done in 3b).
- Surface the verified-leads wedge above the fold and as a dedicated section.
- Lead visuals with feed/people/verification; strip hard price tags from the hero.
- Honest trust signals only (no fake logos/counts).
- Keep value-driven CTAs; keep the existing motion/reveal and mobile sticky CTA.
- Differentiate `/` vs `/connect` so each has its own identity.
- Maintain WCAG AA, all four locales (en/gu/gu-en/hi-en), empty/loading states, keyboard nav.

## 6. Explicitly NOT doing

- No change to positioning or the copy bank (already verified).
- No fabricated social proof, numbers, logos, or testimonials.
- No `/connect/companies` surface (owner decision: not user-facing).
- No "Buy now"/cart/checkout language anywhere (already banned).

## 7. Build order (once direction is approved)

1. New hero copy in all four `app/messages/*.json` (home + connect namespaces).
2. New `NetworkHeroMock` (and a `/connect` variant) in `mockups.tsx`; swap into `Hero.tsx` and `ConnectHero.tsx`.
3. Add "Three things, one place" pillars section + i18n.
4. Add/elevate the trust-wedge section on home; reorder `ConnectTrust` above boosts on `/connect`.
5. Reframe ModuleShowcase title as "the five tools".
6. QA: four locales, mobile + desktop, Lighthouse/LCP (hero stays no-entrance-animation), axe accessibility pass, visual diff of both pages.
