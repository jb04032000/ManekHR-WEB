# Ad / Monetization Product Strategy

## zari360 Connect - Market Research Findings

**Research date:** 2026-05-26
**Scope:** B2B professional-network ad product teardown + India-first synthesis for textile-SMB audience

---

## Table of Contents

1. [Platform Teardowns](#1-platform-teardowns)
   - 1.1 LinkedIn
   - 1.2 Meta (Boost Post)
   - 1.3 Apna
   - 1.4 IndiaMART / TradeIndia / Udaan
   - 1.5 JustDial
   - 1.6 PagarBook
2. [The Boost Post Pattern in Depth](#2-the-boost-post-pattern-in-depth)
3. [Rail / Sidebar Placements for B2B](#3-rail--sidebar-placements-for-b2b)
4. [Self-Serve Ad Billing in India](#4-self-serve-ad-billing-in-india)
5. [Recommended Ad-Product Catalog for zari360 Connect](#5-recommended-ad-product-catalog-for-zari360-connect)
6. [Build Priority Ranking](#6-build-priority-ranking)
7. [Sources](#7-sources)

---

## 1. Platform Teardowns

### 1.1 LinkedIn

LinkedIn is the reference architecture for B2B professional-network monetization. Its ad stack is the most complete in the category and forms the baseline for every decision in this document.

#### Ad Products

| Product                          | Format                                                               | Placement                  | Pricing Model       | Self-Serve? |
| -------------------------------- | -------------------------------------------------------------------- | -------------------------- | ------------------- | ----------- |
| Sponsored Content - Single Image | Static image + headline + CTA                                        | In-feed (desktop + mobile) | CPC or CPM          | Yes         |
| Sponsored Content - Video        | Autoplay 3-30 sec                                                    | In-feed                    | CPV or CPM          | Yes         |
| Sponsored Content - Carousel     | 2-10 swipeable cards                                                 | In-feed                    | CPC or CPM          | Yes         |
| Sponsored Content - Document     | Gated/ungated PDF/deck                                               | In-feed                    | CPM or CPC          | Yes         |
| Sponsored Content - Event        | Event card with RSVP                                                 | In-feed                    | CPM                 | Yes         |
| Thought Leader Ads               | Boost an employee's organic post                                     | In-feed                    | CPM                 | Yes         |
| Message Ads (InMail)             | 1-to-1 inbox message                                                 | LinkedIn inbox             | CPS (cost per send) | Yes         |
| Conversation Ads                 | Branching message tree                                               | LinkedIn inbox             | CPS                 | Yes         |
| Dynamic - Follower Ads           | Personalized "follow this company" card using viewer's profile photo | Right rail (desktop only)  | CPM or CPC          | Yes         |
| Dynamic - Spotlight Ads          | Personalized card linking to a landing page                          | Right rail (desktop only)  | CPC                 | Yes         |
| Text Ads                         | Small image + headline + description                                 | Right rail + top banner    | CPC or CPM          | Yes         |
| Lead Gen Forms                   | Native form attached to sponsored content or message ads             | In-feed or inbox           | CPL or CPC          | Yes         |

#### Pricing Benchmarks (2025-2026)

- Average CPC for sponsored content: USD 5-8
- Average CPM: USD 31 (median across sectors)
- Message Ads CPS: USD 0.50-1.00 per send; open rates 35-50%
- Lead Gen Forms: 10-15% conversion rate click-to-lead (vs 2-5% for external landing pages)
- Minimum daily budget: USD 10
- Minimum CPC/CPM bid: USD 2.00

#### Targeting Dimensions

- Job title, function, seniority, company name, company size, industry
- Skills, schools, groups, interests
- Matched audiences (email list upload, website retargeting, CRM sync)
- Lookalike audiences based on any matched audience

#### Self-Serve Infrastructure

All products run through LinkedIn Campaign Manager. Advertisers set objective (awareness / consideration / conversions), choose ad format, define audience, set bid strategy (max CPC, target CPC, max CPM, enhanced CPC), and pay via credit card or monthly invoicing (invoicing only unlocked above a spend threshold). No managed-service requirement for any format.

#### What LinkedIn Does Best

- Audience precision: job-function targeting is unmatched for B2B
- Lead Gen Forms: native pre-fill from profile data eliminates friction, drives 3x the conversion of landing pages
- Thought Leader Ads: lets a brand amplify an individual's organic post, lending authenticity
- Conversation Ads: interactive branching messages feel consultative, not broadcast

#### Gaps / Weaknesses

- Expensive relative to India market CPCs (USD 5-8 CPC is unusable for SMB budgets of INR 500-5,000/month)
- No marketplace-specific or listing-promotion product
- No direct integration between ad wallet and a credit-pool used for other platform services
- Reach-estimate UI is only shown after full campaign setup, not inline during audience builder

---

### 1.2 Meta (Boost Post / Facebook Ads)

Meta's Boost Post is the world's most widely adopted self-serve ad flow. It is the design reference for simplicity and conversion in a self-serve funnel.

#### Boost Post Flow (Step by Step)

1. **Entry point:** "Boost post" button appears directly under any organic post on a Page. Zero navigation required.
2. **Objective selection:** Goal is pre-inferred from post type (link post = traffic, photo post = engagement, video post = video views). User can override.
3. **Audience builder:** Three modes: (a) Advantage+ Audience (Meta AI picks automatically), (b) saved audience, (c) custom - location / age / gender / interests / behaviors. Audience size estimator updates live as filters change.
4. **Placement:** Auto-placements (Facebook feed, Instagram feed, Stories, Reels, Audience Network) pre-selected. User can restrict.
5. **Budget and duration:** Single slider for daily budget (minimum INR 65 / USD 1 per day in India). Duration picker: 1 day to 30 days. Total spend shown live.
6. **Payment:** Charged to the ad account's payment method (credit card, debit card, net banking, UPI in India, or prepaid balance). If balance exists, it is consumed first.
7. **Estimated reach / results:** Shown as a range (e.g., "Estimated 1,200 - 3,500 people per day") derived from audience size and budget.
8. **Preview:** Live preview of the boosted post across placements, switchable by device.
9. **Submit and go live:** Ad enters review (usually under 1 hour in India). Status updates shown on post card itself.
10. **Results:** Post card shows spend, reach, and clicks inline. Full breakdown in Meta Ads Manager.

#### What Meta Does Best

- Single-click entry from organic post - zero context switching
- Estimated-reach widget is live and inline; gives immediate feedback as you adjust budget/audience
- Minimum spend is genuinely low (INR 65/day), making it accessible to any SMB
- Prepaid balance is consumed first before charging the payment method - reduces friction for budget-conscious advertisers
- UPI support makes it frictionless for India-market advertisers

#### Gaps for B2B Context

- Audience targeting is consumer-grade (interest/demographic). No job-function or company-size filter without using full Ads Manager.
- No native lead-capture form built into Boost Post (requires upgrade to Ads Manager for Lead Ads)
- No B2B-specific ad products (promoted listings, sourcing leads, supplier highlights)

---

### 1.3 Apna

Apna is India's leading blue/grey-collar job platform (50M+ candidates, 1M+ employers), targeting the same Tier-2/3 India audience that zari360 serves. Its monetization is the most directly comparable to zari360 Connect's jobs and hiring surface.

#### Ad / Monetization Products

| Product                   | Description                                                                       | Pricing Model                                                                               |
| ------------------------- | --------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| Sponsored Job Listings    | Job cards marked "Sponsored" appear at top of search and feed results             | Flat per-job-post fee (not public; estimated INR 2,000-8,000 per posting based on category) |
| Highlighted Listings      | Visual differentiation (badge, colour, border) in search results                  | Add-on fee per listing                                                                      |
| Targeted Candidate Search | Employer-side filter to search verified candidates by skill, location, experience | Subscription-gated (per employer seat)                                                      |
| Recruiter Subscription    | Unlimited job posts + candidate access + analytics                                | Monthly/annual subscription                                                                 |
| Enterprise Contracts      | Custom SLAs, dedicated account manager, ATS integration                           | Managed sales                                                                               |

#### Key Observations

- Apna does not publish a self-serve ad manager. Promoted listings are sold either inline (one-click upgrade after posting a job) or via the sales team for enterprise.
- 40% YoY growth in paid customers in 2024, driven by enterprise; SMB monetization still under-developed.
- No in-feed sponsored content or awareness formats - purely transactional (promote a job, find a candidate).
- The platform's entry into content feed and community is nascent; there is no ad product for that surface yet.

---

### 1.4 IndiaMART / TradeIndia / Udaan

These are India's dominant B2B marketplaces. Their model is subscription-first + paid lead access, not auction-based CPM/CPC.

#### IndiaMART

| Product                    | Description                                                         | Pricing Model                                  |
| -------------------------- | ------------------------------------------------------------------- | ---------------------------------------------- |
| Mini Dynamic Catalog (MDC) | Basic supplier profile + product catalog listing                    | INR 3,000/month or INR 28,000/year flat        |
| Maximiser                  | 30 BuyLeads/week + 2 bonus/day + priority ranking                   | INR 60,000/year (flat annual subscription)     |
| TrustSEAL                  | Verified supplier badge + priority listing                          | INR 45,000/year flat                           |
| IM Leader                  | Add-on: "Leading Supplier" badge + expanded category-city combos    | Add-on fee to core plan                        |
| IM Star                    | Add-on: "Star Supplier" badge + highest priority                    | Add-on fee to core plan                        |
| Sponsored Listings         | Appear prominently in search results above organic                  | INR 20,000-2,00,000/year depending on category |
| Banner Ads                 | Display banners on category pages and homepage                      | Custom / managed                               |
| BuyLead Purchase           | Suppliers can buy individual buyer inquiry leads by product keyword | Per-lead fee (varies by category)              |
| Verified Exporter          | Export-focused profile with government-verified status              | INR 1,10,000-6,50,000/year                     |

#### Key Observations for IndiaMART

- The core model is flat annual subscription, not performance-based. This reduces risk for the advertiser but removes real-time optimization.
- BuyLeads are the primary value driver. Quality concerns are widely reported by subscribers (fake/duplicate leads). This is a significant gap that zari360 can address with verified-profile leads.
- No self-serve campaign manager. All upgrades are sold through a sales agent calling the supplier.
- No in-feed social content ad product. The marketplace is catalogue-first, not community-first.
- Sponsored Listings pricing (INR 20k-2L/year flat) is accessible to established SMBs but too expensive for karigars or small units.

#### TradeIndia

Model is near-identical to IndiaMART: flat annual subscription tiers, BuyLead access, verified-badge add-ons. No self-serve ad manager. Less market share, lower pricing.

#### Udaan

Udaan is a B2B e-commerce platform (FMCG, pharma, staples) with a different model: transaction-first. Revenue comes from GMV commission, logistics fees, embedded credit (BNPL), and premium supplier placement.

- Featured Listings / Promoted Supplier slots exist but are not publicly priced - sold managed.
- No social feed or content layer. No equivalent to a boost-post product.
- The platform's ad products are closer to retail media (Amazon-style sponsored products) than professional-network ads.

---

### 1.5 JustDial

JustDial is India's local business search and discovery platform. Its advertising model is highly relevant as a reference for SMB-facing placement pricing in India.

#### Ad Products

| Product           | Description                                                | Pricing Model                                                  |
| ----------------- | ---------------------------------------------------------- | -------------------------------------------------------------- |
| Premium Listing   | Appears above free listings in local search results        | INR 5,000-50,000/year flat depending on city tier and category |
| JD Verified Badge | Trust signal on listing                                    | Bundled with premium or add-on                                 |
| Banner Ads        | Display banners on search results pages and category pages | CPM-based or flat; custom pricing                              |
| JD Mart (B2B)     | Dedicated B2B supplier listing with lead generation        | Subscription flat                                              |
| Sponsored Search  | Top-of-results placement for targeted keywords             | CPC-based for some placements                                  |

#### Key Observations

- JustDial is the most India-native example of tiered local-search monetization. Its pricing is SMB-accessible (INR 5k-50k/year).
- The platform is moving toward a B2B marketplace model (JD Mart) that mimics IndiaMART with added local discovery.
- Self-serve is limited - most upgrades are sold by a call-center agent who follows up with any business that claims a listing.
- CPC model for sponsored search is present but not prominently self-serve.

---

### 1.6 PagarBook

PagarBook is an India-specific SMB HR and payroll tool (Sequoia-backed) targeting the same audience segment as zari360's ERP. Its monetization model is instructive because it serves the same factory-owner / small-business-owner persona.

#### Monetization Approach

- **Freemium SaaS subscription:** Core attendance and payroll free up to a team size; premium features (detailed reports, multi-location, compliance exports) behind a paid tier.
- **No ad products:** PagarBook does not run an ad marketplace or promote third-party advertisers.
- **Data-driven upsell:** Premium features are surfaced contextually when a free-tier user tries to access them.
- **No network / feed:** PagarBook is a utility, not a network. There is no content surface to monetize with ads.

#### Key Takeaway for zari360

PagarBook's model (freemium SaaS, no ads) confirms that the ERP layer of zari360 should not carry interruptive ads. Ad monetization belongs on the Connect (network/marketplace) layer, not in the core ERP modules. This is consistent with the existing architecture.

---

## 2. The Boost Post Pattern in Depth

### Ideal Self-Serve Boost Flow

The best boost-post flow in the market is Meta's. The second-best is LinkedIn's "Promote" button on organic posts (added in 2022). Here is the synthesis of what the ideal flow looks like for a B2B network:

#### Step 1: Inline Entry Point

A "Boost" or "Promote" button sits directly on every feed post card. It is visible to the post author (and their Page admin) only. No navigation to a separate campaign manager is required to initiate. This is Meta's primary UX advantage over LinkedIn, where Campaign Manager is still a separate context switch.

#### Step 2: Objective Selection (Simplified)

Offer three B2B-appropriate objectives only. Do not expose the full campaign-objective tree upfront.

- **Reach more people** (awareness/impressions)
- **Get profile visits** (consideration/traffic to the poster's profile or company page)
- **Get inquiries / leads** (conversion - attach a lead-capture form or direct the user to a contact action)

Pre-select the objective based on post content type (text post = reach, product-photo post = inquiries).

#### Step 3: Audience Builder (Inline, Live-Estimate)

Show an audience estimator that updates in real time as filters are adjusted. Filters for zari360 Connect should be B2B-appropriate:

- Location (state, district, city - India-first)
- Industry / sector (textile, garments, yarn, dyeing, weaving, etc.)
- Role type (owner, manager, karigar, buyer, supplier)
- Network depth (1st connections, 2nd connections, all users)

Display estimated reach as a range: "Estimated 800-2,400 people will see this post."

#### Step 4: Budget and Duration

- Single budget input (total budget for the boost, not daily vs lifetime split - simpler for SMBs).
- Duration picker: 3 / 7 / 14 / 30 days, with total cost shown live.
- Minimum boost: INR 99 total (maps to roughly 500-1,000 impressions at zari360 network scale in early growth).
- Show a "value label" next to each duration (e.g., "7 days - Best for new connections").

#### Step 5: Preview

- Inline preview of what the boosted post looks like in feed with a "Promoted" or "Sponsored" label.
- Toggle between mobile and desktop view.

#### Step 6: Payment from Wallet

- Show current platform credit balance prominently.
- If balance >= boost amount, one-tap confirm. No payment gateway redirect.
- If balance is insufficient, show a "Top up wallet" CTA that opens an inline modal (UPI / card / net banking). After top-up, return to the confirm screen automatically.
- GST (18%) shown as a line item on the confirmation screen with a note: "GST invoice will be issued to your registered business GSTIN."

#### Step 7: Live Status and Results

- Post card shows a small "Boosted" pill with spend and reach inline.
- Tapping the pill opens a results drawer: impressions, reach, profile visits, inquiry/lead count, spend to date, remaining budget, end date.
- No separate campaign manager required for basic results. A "View full analytics" link leads to a richer dashboard for power users.

### Who Does It Best

**Meta** is best for the entry-point UX and minimum-spend accessibility. The inline "Boost" button on the post card, the live reach estimator, and the UPI payment support are the three elements zari360 must replicate.

**LinkedIn's Thought Leader Ads** (boosting an individual's post rather than a company page post) is a pattern worth adopting for zari360: let any verified supplier or professional boost their own post, not just business pages.

**Where both fall short** for zari360's context: neither platform pre-populates the audience with industry-specific SMB taxonomy (textile, weaving, yarn). zari360 can do this natively because it has ERP-verified company profiles and occupation data already.

---

## 3. Rail / Sidebar Placements for B2B

### LinkedIn's Approach

LinkedIn's right rail (desktop only) hosts:

- **Text Ads:** 100x100px image + headline (25 chars) + description (75 chars). Very low CTR (0.02-0.05%) but cheap CPM. Used primarily for brand awareness and retargeting.
- **Dynamic Follower Ads:** Personalized card showing "Follow [Company]" with the viewer's own profile photo alongside the company logo. CTR is higher than text ads because personalization creates recognition. Best use: company page growth.
- **Dynamic Spotlight Ads:** Personalized "Learn more" card. Used for product/event promotion.
- **"People You May Know" / "Companies to Follow":** Organic algorithm-driven panels. LinkedIn sells Follower Ad placements into the "Companies you may know" panel specifically.

### What Works for B2B

1. **Promoted Company / Profile Slots** in the right rail "Who to follow" or "Companies to explore" panels are high-value because they are contextual, low-intrusion, and trust-positive (they look like a recommendation, not an ad).
2. **Native placements outperform banner placements** consistently in B2B contexts. A "Sponsored" tag on a recommendation card converts better than an image banner because it aligns with the user's intent (discovering new connections).
3. **Left rail** on LinkedIn is navigation-only (no ad placements). On B2B feed products, the left rail is best reserved for user context (profile mini-card, navigation) - ads placed there are low-attention.

### Recommended Rail Strategy for zari360 Connect

**Right rail (desktop, top slot):**

- "Promoted Suppliers" panel: 3-5 supplier/company cards with logo, name, category tag, and "View profile" CTA. Paid placement in a panel that looks like "Suggested suppliers in your network."
- Pricing: flat weekly/monthly slot fee per card position (position 1 > position 2 > position 3).
- This matches IndiaMART's promoted-listing logic but in a social-network context.

**Right rail (desktop, mid slot):**

- "Trending in Textile" panel: editorial/algorithm-curated, no paid placement initially. Build trust before monetizing.

**In-feed sponsored posts (positions 4-5 in feed):**

- Standard boosted posts (from the boost-post flow above) injected as the 4th or 5th item in the feed.
- Label: small "Promoted" tag in grey, below the author name.
- Position 4 is the global standard (Facebook, LinkedIn both inject the first sponsored item at position 3-5).

**Left rail:**

- No paid placements. Reserved for navigation and user context. Cluttering the left rail with ads degrades the product experience, especially on mobile where the rail collapses.

**Mobile (no persistent rails):**

- On mobile, rail content collapses. Sponsored content in-feed is the only reliable mobile ad placement.
- "Promoted Suppliers" panel can appear as a horizontal scroll card unit injected into the feed (not a sidebar).

### Native vs Banner

For a B2B textile-SMB audience that includes semi-literate karigars alongside factory owners, native placements (cards that look like content/profiles) significantly outperform banner display. Banner blindness is acute in this audience segment - banner CTR on India SMB platforms is typically 0.05-0.1%.

The recommendation is: no banner/display ads in the initial catalog. Every placement should be native (looks like a post, a profile recommendation, or a listing card). Banner inventory can be introduced as a managed-sales product for larger brands (yarn manufacturers, machinery suppliers) at a later phase.

---

## 4. Self-Serve Ad Billing in India

### Prepaid Wallet vs Postpaid

**Prepaid wallet is the correct model for India's SMB market**, for five reasons:

1. **Credit card penetration is low** among small textile units and karigars. UPI and prepaid balance are the dominant payment modalities.
2. **Budget control:** SMB owners are acutely sensitive to unexpected charges. A postpaid model (pay after spend) causes anxiety and churn. Prepaid removes the fear of overspend.
3. **Platform risk:** Postpaid requires credit underwriting or dispute resolution if the advertiser refuses to pay after spend. Prepaid eliminates this receivables risk entirely.
4. **Existing infrastructure:** zari360 already has a `PlatformCreditPool` + `PlatformCreditLedger` + admin pricing control. Ad spend can draw from the same credit wallet used for SMS/WhatsApp, eliminating a second billing relationship.
5. **Precedent:** Google Ads, Meta Ads, and Taboola all offer prepaid (manual payments) as the default for new Indian advertisers. The postpaid (automatic payments) threshold on Meta is INR 3,500 - only after a user has demonstrated reliable payment history.

### Minimum Spend

- **Minimum top-up:** INR 200 (keeps the wallet accessible to the smallest advertisers while covering payment gateway fees).
- **Minimum boost/campaign spend:** INR 99 (matches the psychological "under INR 100" threshold; lower than Meta's India minimum of INR 65/day, which can run up quickly over a week).
- **No minimum balance requirement** to maintain an account. Zero balance is fine; it simply prevents launching new boosts.

### GST Handling

Digital advertising services in India are taxed at **18% GST** (SAC code 998361, effective from September 2025 under the revised schedule). For zari360 Connect:

- GST at 18% is **collected on top of the ad spend amount** at the time of invoice generation.
- Two scenarios:
  - **B2B advertiser with GSTIN:** zari360 issues a B2B tax invoice. The advertiser can claim Input Tax Credit (ITC) on the 18% GST paid, making the effective cost lower. This is a selling point - highlight it in the billing UI.
  - **Advertiser without GSTIN (individual/unregistered):** zari360 issues a B2C receipt. GST is still collected and remitted by zari360, but no ITC is available to the advertiser.
- The cleanest implementation: collect the ad spend amount from the wallet (ex-GST), issue a GST invoice monthly/per-transaction, and maintain the wallet balance as ex-GST units. This matches how Google Ads India handles it (wallet balance is ex-tax; GST invoice generated separately).
- **TDS (Section 194C):** TDS applies at 2% if aggregate payments to zari360 by a single advertiser exceed INR 1,00,000 in a financial year. Only large advertisers will hit this threshold. The platform needs a mechanism for advertiser to declare their TAN and submit Form 16A at year-end - a back-office requirement, not a launch blocker.

### How the Prepaid Credit Wallet Maps to Ad Spend

zari360's existing `PlatformCreditPool` and `PlatformCreditLedger` architecture already supports this model. The mapping is:

- **Credit unit = 1 INR of ex-GST ad spend.** No exotic conversion rates or credit multipliers (they confuse SMB advertisers).
- When a boost is launched, the system **reserves** the full boost budget from the wallet (soft lock). This prevents overspend if multiple boosts are running simultaneously.
- As the boost serves impressions, the reserved amount is **drawn down in real time** (or in hourly batches for efficiency).
- When a boost ends or is paused, any **unspent reserved amount is released** back to the wallet immediately.
- The wallet ledger entry for ad spend carries `creditSource: 'advertiser_wallet'` and a `campaignId` reference, enabling per-campaign spend reporting.
- Top-up methods: UPI (recommended default for India), credit/debit card (Razorpay or Cashfree gateway), net banking. PhonePe and Paytm wallet as additional options if the payment gateway supports them.

---

## 5. Recommended Ad-Product Catalog for zari360 Connect

This section synthesizes the research into a concrete product catalog, distinguishing first-party self-serve, third-party network, and house/system promos.

### (a) First-Party Self-Serve Products

These are ad products that zari360 builds, sells, and delivers itself. Revenue is direct. Targeting uses zari360's own first-party data (ERP-verified company profiles, occupation, location, network graph).

---

**Product A1: Boost Post (Core Self-Serve)**

- **Description:** Any user or business page can boost an organic feed post to reach beyond their immediate connections.
- **Format:** Native in-feed sponsored post, identical to an organic post but with a "Promoted" label.
- **Targeting:** Location (state/district/city), role type (owner/manager/karigar/buyer/supplier), industry segment, network depth (1st/2nd/all).
- **Pricing:** Prepaid wallet. Minimum INR 99 total. Charged per 1,000 impressions (CPM) or per profile visit (CPC) - let the system auto-optimize (same as Meta's Advantage+).
- **Duration:** 3 / 7 / 14 / 30 days.
- **Self-serve UX:** Inline boost button on post card. 6-step flow as described in Section 2.
- **Priority:** P0. This is the foundational monetization primitive. Everything else builds on top of it.

---

**Product A2: Promoted Supplier / Profile Slot**

- **Description:** A business profile or individual professional profile appears in the "Suggested Suppliers" or "People in Textile You Should Know" right-rail / in-feed discovery panel.
- **Format:** Profile card (logo/photo, name, category, 1-line description, "View Profile" CTA). Native look matching organic discovery panels.
- **Targeting:** Shown to users in matching industry segment or geography.
- **Pricing:** Flat weekly slot fee. Example tiers: INR 499/week (position 3-5), INR 999/week (position 1-2). Prices should be set to match IndiaMART's effective weekly cost of promoted listings (IndiaMART Maximiser at INR 60k/year = INR 1,154/week for top-tier).
- **Self-serve UX:** "Promote your profile" button in the profile editor or via a "Grow your network" section. Simple slot-picker showing available positions and pricing.
- **Priority:** P1. High revenue density (flat fee = predictable revenue) and high perceived value for suppliers wanting visibility.

---

**Product A3: Sponsored Job Listing**

- **Description:** A job posting appears at the top of the jobs feed / search results with a "Sponsored" label.
- **Format:** Standard job card with promotion badge.
- **Pricing:** Flat per-posting fee (INR 299-999 per 30-day posting depending on reach tier). Or CPL (cost per applicant): charge only when a qualified applicant applies (requires defining "qualified" - e.g., verified profile in the right role category).
- **Recommendation:** Start with flat fee (simpler to operate). Add CPL as a premium option for enterprise employers after platform reaches sufficient traffic.
- **Self-serve UX:** "Boost this job" button on the job post card. Single-step: pick reach tier (local / regional / national), see estimated applicants, pay from wallet.
- **Priority:** P1. Jobs is a committed phase of the Connect roadmap. Ad revenue from jobs is the fastest path to SMB advertiser acquisition because employers already have budget intent.

---

**Product A4: Promoted Marketplace Listing**

- **Description:** A product or service listing in the Connect marketplace appears at the top of category search results.
- **Format:** Listing card with "Sponsored" label. Matches organic listing card format.
- **Pricing:** Flat weekly/monthly fee per listing slot. INR 299-999/week depending on category competitiveness. Or CPC (cost per click-through to listing).
- **Recommendation:** Flat fee first (matches IndiaMART model that the target audience is already familiar with). Add CPC once sufficient volume exists to make auction mechanics meaningful.
- **Self-serve UX:** "Promote this listing" button on the marketplace listing card.
- **Priority:** P2. Depends on marketplace feature being live.

---

**Product A5: Lead Gen Form (Inquiry Ad)**

- **Description:** An in-feed sponsored post with an attached native inquiry form. Pre-filled from the viewer's zari360 profile. Submitted inquiries go to the advertiser's inbox / CRM.
- **Format:** Sponsored content card with a "Send Inquiry" or "Request Sample" CTA that opens a native form overlay (name, mobile, business name, message - all pre-filled from profile).
- **Pricing:** CPL. Charge only when the form is submitted. CPL price: INR 50-500 depending on category/audience. (Comparable to LinkedIn Lead Gen Form CPL, but India-priced at 10-15x cheaper.)
- **Why it matters:** This is the product that replaces IndiaMART's BuyLeads. The critical differentiator is that leads come from verified zari360 profiles (ERP-linked), so lead quality is far higher than IndiaMART's self-reported buyer data.
- **Self-serve UX:** Available as an add-on when launching a Boost Post (step 2: "What do you want people to do? > Send an inquiry").
- **Priority:** P2. Requires the network to have enough demand-side users (buyers/brands) to make CPL campaigns viable. Target launch when Connect reaches 5,000 active users.

---

**Product A6: Notification / InMail-style Sponsored Message**

- **Description:** A sponsored message delivered to a targeted user's Connect inbox or notification center.
- **Format:** Message card in inbox, visually distinct with "Sponsored" label.
- **Pricing:** CPS (cost per send). INR 1-3 per message. (LinkedIn's USD 0.50-1.00 = INR 40-80 per send is 20-40x too expensive for India SMBs; price accordingly.)
- **Targeting:** Role type, location, industry.
- **Guardrails:** Maximum 1 sponsored message per user per week (anti-spam). User can opt out.
- **Priority:** P3. Inbox spam is a trust-destroying risk. Launch only after organic engagement is healthy and the platform has strong anti-spam enforcement.

---

### (b) Where Third-Party Network Ads Fit

Third-party ad networks (Google AdSense, Meta Audience Network, InMobi, Taboola, mCanvas) can fill unsold inventory and provide incremental revenue, but carry significant downsides for a B2B professional network:

**Arguments for third-party ads:**

- Immediate revenue from day one without a self-serve advertiser base
- No sales effort required
- Useful for monetizing low-intent surfaces (e.g., the "Explore" tab before personalization kicks in)

**Arguments against (stronger for zari360 Connect):**

- Third-party ads are almost always consumer-grade (D2C brands, gaming, finance apps). They are irrelevant and jarring in a textile-SMB B2B context.
- They undermine the "professional network" positioning. LinkedIn does not carry third-party network ads.
- Revenue per user is low (India CPMs on AdSense / InMobi for B2B audiences are INR 15-40 CPM). The self-serve products above can generate 10-50x more revenue per impression from the same user.
- They create a dependency on a third-party network and introduce latency, tracking, and privacy complications.

**Recommendation:** Do not launch third-party ad network inventory. If there is unsold inventory in the early months, fill it with House Promos (see section c below) rather than third-party ads. Revisit at scale (100,000+ MAU) if a specific low-intent surface has persistent unsold inventory.

---

### (c) House / System Promos

House promos are first-party promotions that fill unsold ad inventory and also serve product goals (user activation, feature discovery, subscription upsell). They cost nothing to run (no payment), and because they occupy slots that would otherwise be empty, they have no revenue cost if properly managed.

**House Promo Types:**

1. **Feature Discovery Cards:** Promoted-style cards in the feed or rail that introduce a new Connect feature ("Have you tried zari360 Connect Marketplace? Post your first listing today."). Link to onboarding flow.
2. **Subscription Upsell Cards:** Targeted to free-tier users hitting a limit. "Upgrade to Connect Pro to see who viewed your profile."
3. **Network Growth Nudges:** "3 buyers in your district joined this week. Connect with them." Drives organic engagement which increases ad inventory quality.
4. **ERP Cross-Sell:** "Manage your payroll alongside your network. Try zari360 ERP free for 30 days." Cross-sells the ERP subscription to Connect-only users.
5. **Verified Badge Prompts:** "Get your business verified. Verified suppliers get 3x more inquiries." Drives profile completion which improves ad targeting precision.

**Inventory Management Rule:** House promos should fill any slot where no paid advertiser has purchased. The system should never show two consecutive house promos in the feed (cap at 1 house promo per 10 organic posts), and should deprioritize house promos for users who have already seen the same promo 3+ times.

---

## 6. Build Priority Ranking

| Priority | Product                           | Revenue Model        | Dependency              | Rationale                                                                                               |
| -------- | --------------------------------- | -------------------- | ----------------------- | ------------------------------------------------------------------------------------------------------- |
| P0       | Boost Post (A1)                   | CPM/CPC from wallet  | Feed + wallet           | Core primitive. Lowest build complexity. Highest SMB advertiser accessibility. Launch with the feed.    |
| P0       | Credit Wallet for Ads             | Prepaid INR wallet   | Existing credit pool    | Already 80% built (PlatformCreditPool). Extend with ad-spend ledger entries and GST invoice generation. |
| P1       | Promoted Supplier Slot (A2)       | Flat weekly fee      | Profile + right rail    | High revenue density. Maps to IndiaMART's familiar promoted-listing UX. Zero auction complexity.        |
| P1       | Sponsored Job Listing (A3)        | Flat per-posting fee | Jobs module             | Employers already have budget intent. Fast path to first paid advertisers.                              |
| P2       | Lead Gen Form / Inquiry Ad (A5)   | CPL                  | Network scale (5k+ MAU) | Highest value product. Wait for demand-side density before launching.                                   |
| P2       | Promoted Marketplace Listing (A4) | Flat weekly fee      | Marketplace module      | Dependent on marketplace phase being live.                                                              |
| P2       | House Promo System (c)            | None (fills unsold)  | Boost Post infra        | Reuses ad slot infrastructure. No payment path needed. Drive activation and subscriptions.              |
| P3       | Sponsored Message / InMail (A6)   | CPS                  | Inbox + trust baseline  | High abuse risk. Requires anti-spam infrastructure and healthy engagement before launch.                |
| Defer    | Third-party ad network            | CPM revenue share    | N/A                     | Not recommended. Degrades product, low yield, misaligned audience. Revisit at 100k MAU.                 |

---

## 7. Sources

- [LinkedIn Ad Types Guide (LinkedIn Business)](https://www.linkedin.com/business/marketing/blog/linkedin-ads/a-b2b-marketers-guide-to-every-linkedin-ad-type)
- [LinkedIn Ads Cost and Budget Guide 2026 - Stackmatix](https://www.stackmatix.com/blog/linkedin-ads-cost-budget-guide-2026)
- [LinkedIn Ads Cost - Carvertise](https://carvertise.com/linkedin-advertising-costs/)
- [LinkedIn Ads Benchmarks 2026 - Meet Lea](https://meet-lea.com/en/blog/linkedin-advertising-costs-roi-benchmarks)
- [LinkedIn Lead Gen Forms Best Practices - OktoPost](https://www.oktopost.com/blog/linkedin-lead-gen-forms-9-best-practices/)
- [LinkedIn Lead Gen Forms vs Landing Pages - Flow20](https://www.flow20.com/blog/linkedin-lead-gen-forms-vs-landing-pages-which-converts-best-for-b2b/)
- [LinkedIn Lead Generation Statistics 2025 - Sopro](https://sopro.io/resources/blog/linkedin-lead-generation-statistics/)
- [Boost a Post from Your Facebook Page - Meta Help Center](https://www.facebook.com/business/help/347839548598012)
- [Facebook Boosted Posts Guide 2024 - Hootsuite](https://blog.hootsuite.com/how-does-facebook-boost-posts-work/)
- [Facebook Boost Post Cost 2026 - AdMetrics](https://www.admetrics.io/en/post/facebook-boost-post-cost-dtc-ecommerce-48576)
- [How to Boost a Facebook Post - Bir.ch](https://bir.ch/blog/promote-facebook-post)
- [Apna Employer Platform](https://employer.apna.co/)
- [How Does Apna Work - Canvas Business Model](https://canvasbusinessmodel.com/blogs/how-it-works/apna-how-it-works)
- [IndiaMART Packages Overview - Refrens](https://www.refrens.com/grow/detailed-overview-and-analysis-of-all-indiamart-packages/)
- [IndiaMART Business Model - The Business Scroll](https://www.thebusinessscroll.com/indiamart-business-model/)
- [IndiaMART Annual Report FY 2024-25](https://investor.indiamart.com/files/IndiaMART_Annual_Report_FY_2024-25.pdf)
- [Udaan Platform Overview - Commerce Tech](https://commercetech.io/p/udaan)
- [JustDial Advertise Program](https://www.justdial.com/Advertise)
- [JustDial Q1 FY2024 Revenue - Business Today](https://www.businesstoday.in/latest/corporate/story/justdial-achieves-record-user-traffic-and-247-crore-operating-revenue-growth-in-q1-fy-2024-392756-2023-08-04)
- [PagarBook Product Market Fit - India Quotient](https://medium.com/@IndiaQuotient/dont-chase-vanity-metrics-pagarbook-s-winning-product-market-fit-strategy-5645f5cef9f5)
- [GST on Google and Facebook Ads India - RMPS](https://rmpsco.com/understanding-gst-on-google-and-facebook-advertisements-in-india/)
- [GST on Digital Marketing Services 2026 - Busy.in](https://busy.in/gst-rates/digital-marketing-services/)
- [GST on Advertising Services - CaptainBiz](https://www.captainbiz.com/blogs/gst-on-advertising-services-and-advertisement/)
- [Google Adwords Payments India - Digital Deepak](https://digitaldeepak.com/google-adwords-payments-in-india/)
- [B2B Sponsored Content Types for LinkedIn 2026 - Kawaak](https://kawaak.com/blog/en/b2b-sponsored-content-types-linkedin-2026/)
- [LinkedIn Ads for B2B Ultimate Guide - Uptick Marketing](https://uptickmarketing.com/learning-center/linkedin-ads-for-b2b-the-ultimate-guide/)
- [One Third of Nifty 100 Hire on Apna - Business Standard](https://www.business-standard.com/content/press-releases-ani/one-third-of-nifty-100-companies-hire-thousands-of-young-talent-on-apna-co-124080800399_1.html)
