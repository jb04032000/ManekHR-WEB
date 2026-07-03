# Connect segments: embroidery institutes + adjacent users

**Date:** 2026-06-14
**Status:** Strategy + feature plan for owner review. No code yet. The feature additions here are logical changes (new entity type, course object, credential verification) and need explicit owner approval before any build, per `ENGINEERING-STANDARDS.md` #13.
**Grounding:** `IDENTITY-MODEL.md` (primitives), `source/zari360_connect_features.md` (feature inventory), live code (`features/connect/*`), and a research pass on Surat embroidery/digitizing institutes (IDT Vesu, Wilcom computerized-embroidery courses, aari/zardosi schools and franchises).

---

## 1. Why institutes matter (the strategic case)

An embroidery institute / academy is not just another customer. It sits on **both sides of our market at once**:

- **Supply:** its students are tomorrow's karigars, machine operators, designers, and digitizers - exactly the candidates businesses hire.
- **Demand:** its owner already has a network of workshops, designers, and boutiques (placement contacts, guest faculty, material suppliers) - exactly the businesses that hire and buy.

So a single institute partnership can seed dozens of businesses and hundreds of trained workers. For a young marketplace, that is the cleanest answer to the cold-start problem: **seed the supply side through institutions, and the demand network rides in with them.** Placement marketplaces (and Naukri's campus model) win this way.

Their incentive to join is strong and self-reinforcing:

- **Placement rate is the #1 thing an institute sells to students.** A live hiring network raises it directly.
- **Free course marketing** to the whole trade (enrolment lead-gen).
- **A verified alumni network** that keeps the institute visible and sticky.

## 2. Who else can become a user (segment map)

Core (already served today): embroidery factories / workshop owners, machine owners, wholesalers, traders, shop owners, and the candidates (karigar / operator / designer / helper) who want those jobs.

Adjacent, high-fit (mostly served by existing primitives, just need positioning + a category):

| Segment                                          | What they do here                                                               | Primitive they map to                  |
| ------------------------------------------------ | ------------------------------------------------------------------------------- | -------------------------------------- |
| **Institutes / academies**                       | Showcase student work, market courses, place graduates, post apprenticeships    | Company Page (new "Institute" type)    |
| **Students / trainees**                          | Build a portfolio, get a "trained at" credential, find first job/apprenticeship | Person profile                         |
| **Digitizers / DST studios**                     | Sell a digitizing service, take job-work, hire                                  | Profile + Storefront (service listing) |
| **Design sellers**                               | Sell paper designs / design files                                               | Storefront listing                     |
| **Machine dealers + service technicians**        | Sell/AMC machines, offer and seek service jobs                                  | Company Page + Storefront + Jobs       |
| **Thread / yarn / zari / consumable suppliers**  | List materials, take enquiries                                                  | Storefront                             |
| **Job-work units (dyeing, printing, stitching)** | Offer capacity, take orders, hire                                               | Company Page + Jobs                    |
| **Boutiques / retailers**                        | Source product, hire designers                                                  | Profile / Company Page (buyer side)    |
| **Industry associations / market bodies**        | Amplify, co-onboard members                                                     | Company Page (partner)                 |

## 3. Do we already have the structure? (reuse audit)

Connect is built around a **person (`User`)** and the **entities they own** (`CompanyPage` = an identity that posts and hires; `Storefront` = a catalog that sells). Institutes and students slot straight into this. Roughly **70% is reusable today**:

| Institute need                                                                                 | Already in Connect?                                                                                                                              | Source                          |
| ---------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------- |
| Institute public identity, posts, hires, has a URL                                             | **Yes** - `CompanyPage` (has a `type` field, specialization, followers, Posts/Jobs/People tabs)                                                  | features doc §F; IDENTITY-MODEL |
| Showcase student/course work in the feed                                                       | **Yes** - photo/video/document posts                                                                                                             | features doc §C                 |
| Students' profiles with embroidery skills + portfolio + "open to work"                         | **Yes** - profile skill taxonomy already lists aari/zardozi/designing/computerized; portfolio; `openTo.work`; daily-wage/piece-rate; voice apply | features doc §A                 |
| "Education / training / apprenticeship" and "Certifications (embroidery courses)" on a profile | **Anticipated** - listed as planned profile fields, not yet first-class                                                                          | features doc §A                 |
| Link a profile entry to a company/institute page                                               | **Near** - experience entries already support an optional `companyPageId` link                                                                   | `profile-edit-schema`           |
| Recommendation from an institute to a student                                                  | **Yes** - recommendations concept exists                                                                                                         | features doc §A                 |
| Post apprenticeships / entry roles; students apply                                             | **Yes** - Jobs has an **Apprenticeship** employment type; voice-note apply                                                                       | features doc §E                 |
| Institute browses/refers its students to employers                                             | **Yes (reusable)** - recruiter candidate search, shortlist, Nvites                                                                               | features doc §E                 |
| Boost a course/post for reach (optional paid)                                                  | **Yes** - Boost wallet + ad engine already shipped                                                                                               | `features/connect/ads/*`        |

So nothing here needs an architectural rewrite. The gaps are **additive**.

## 4. The additive features (to make institutes first-class)

Five additions, each building on an existing primitive:

1. **"Institute / Academy" page type + discoverable category.** So institutes are found as _training providers_, not mistaken for manufacturers. Small: extend the `CompanyPage` type enum + the existing tag/category taxonomy (`ConnectTag`). Add a few institute fields (courses offered, languages, batch cadence) to the page's industry panel.

2. **Course listings with "enquire to enrol."** A course is close to a marketplace listing. Reuse the listing + inquiry/lead flow, add course fields: duration, batch start, mode (online/offline), fee range, seats, certificate (y/n), skills taught. CTA is "Enquire to enrol" (not "Get quotation"). Medium.

3. **Institute -> student credential link ("Trained at / Certified by [Institute]").** The student adds an education/certification entry linked to the institute's page; the institute can **confirm** it (two-sided, like LinkedIn company-confirmed roles), which lights a "Certified by [Institute]" marker on the student profile. Builds on the planned education field + the `companyPageId` link + recommendations. Medium. The confirm step is the new bit.

4. **Talent pool / alumni surface.** An institute page gets an "alumni open to work" tab: students who linked the institute and toggled `openTo.work`. Hiring businesses browse an institute's talent directly. Reuses candidate search + the credential link. Medium.

5. **Partner bulk onboarding + referral attribution.** An institute invites its whole batch + its business contacts in one flow, with attribution back to the institute. Extends the existing invite/claim plumbing (`linkedUserId` claim, consolidated invite endpoints). Medium. **This is the acquisition engine.**

## 5. Collaboration / partnership models

- **Placement partner (flagship):** institute brings a batch (supply) + business contacts (demand); co-branded onboarding; "Placement powered by Zari360"; referral attribution. Highest leverage for us.
- **Verified Institute badge:** institute verifies (GST/Udyam or manual review) -> trust badge, in exchange for keeping its credentialing honest. Reuses the verification module.
- **Course lead-gen + optional boosts:** institutes list courses free, get enrolment enquiries, and can pay to boost reach (reuses the Boost wallet - no new billing rails). A clean, honest revenue line.
- **Alumni proof:** the institute's page shows alumni and (opt-in) where they were placed - the institute's own marketing proof, and a retention hook for us.

## 5A. Why an institute will push students to join (their interest, not ours)

An institute only recruits its students onto the platform if **the institute itself gains**. Every hook below serves the institute's own reputation and enrolments; the student sign-ups are the by-product that grows our supply side. Ranked by pull:

1. **"Where our students work" placement wall.** Each student who gets hired surfaces on the institute's page. This is the institute's single strongest sales pitch to the next batch, so they actively want students on the platform feeding it. (Builds on the alumni/talent-pool surface + the credential link.)
2. **Certificate badge as free advertising.** Every student carries a "Certified by [Institute]" marker on a public profile seen across the whole trade. The institute's name travels everywhere its students appear - brand reach at zero cost. (Builds on the institute -> student credential link.)
3. **Student work auto-showcases on the institute page.** Students post their designs/work; it surfaces on the institute's wall as a living, self-updating portfolio that markets the institute. (Reuses feed + page Posts tab.)
4. **Hiring leads land in the institute's inbox.** Businesses looking for trained karigars/operators can contact the institute, making it look like a placement desk and strengthening its course pitch. (Reuses the inbox + Nvites/candidate flow.)

Note on reviews: the owner raised student reviews of the institute. Student-written public reviews are double-edged (a few bad ones hurt the institute and kill their incentive to join). Prefer **opt-in student success stories / recommendations the institute can showcase** - same trust signal, upside only. Two-sided reviews stay reserved for buyer-seller deals (ratings only after a confirmed deal), as already locked.

**Dependency:** all four hooks need students actually using the platform - which is exactly the pull that makes the institute recruit them for us. Feature-wise they layer on the deferred items (alumni/placement wall, credential confirm), so they belong in the same later phase, not Phase 1.

### Empty-state CTA (turn the cold start into recruitment)

Until an institute has students on the platform, the placement wall / alumni tab / showcase are **empty**. An empty wall reads as failure and kills interest. So in every one of these institute surfaces, the empty state must NOT be blank - it must be an **invite-your-students CTA** that does the recruiting for us. Concretely:

- Placement wall (empty): "No placements yet. Invite your students to Zari360 - when they get hired, it shows up here." + a one-tap "Invite students" action (share link / WhatsApp).
- Alumni / talent tab (empty): "Add your students so employers can find them." + "Invite students".
- Showcase (empty): "Ask your students to post their work - it appears on your page." + "Invite students".

This makes the institute's self-interest (a full, impressive page) the thing that pushes students to join. The invite action reuses the bulk-onboarding/invite plumbing, so it ships in the same phase as these surfaces (Phase 2), not Phase 1. This empty-state-as-CTA pattern is the acquisition mechanic, not a cosmetic nicety - flag it as a required part of those features, never an afterthought.

## 6. Honest constraints / guardrails

- These are **logical changes** -> this plan is the approval artifact; build only after sign-off.
- **Real credentials only.** "Certified by [Institute]" must come from the institute's confirm action, never fabricated. Same honesty rule as ratings-after-a-real-deal.
- **Verified-institute mechanics must not over-claim** (a page badge means verified identity, not a quality guarantee).
- **DPDP-safe:** student data stays minimal; no Aadhaar (locked decision); placement/where-hired is opt-in.
- Same bar as the rest of Connect: multilingual (en/gu/gu-en/hi-en), mobile-first, voice paths, WCAG AA.

## 7. Phasing (updated to current decisions)

- **Phase 0 - now, no build:** add Institutes + Students to the marketing audience/positioning; line up 2-3 Surat institutes (e.g. computerized-embroidery + aari/zardosi schools) as launch partners.
- **Phase 1 - build now (owner decision):** "Institute" page type + discoverable category + institute fields; **course listings with "enquire to enrol"** (reuse the marketplace listing + inquiry flow); student **"Trained at [Institute]"** credential entry linking the institute page. Students use existing profiles. These are the parts an institute/student can see and use immediately, so they support the marketing goal.
- **Phase 2 - later, build when the trigger fires:** the reputation hooks from section 5A - "where our students work" placement wall, institute-confirmed "Certified by" badge, alumni/talent-pool tab, hiring-leads-to-inbox - each shipping **with its empty-state "Invite your students" CTA** (section 5A). Also: bulk student onboarding + referral attribution.
- **Phase 3 - growth:** featured-course boosts; a placement dashboard for institutes; verified-institute badge.

### When do we plan Phase 2?

Phase 2 is **signal-triggered, not date-triggered.** Plan it once Phase 1 is live and we see real early usage from at least a couple of partner institutes - e.g. an institute page set up, a handful of student profiles with the "Trained at" link, and at least one hire happening. Before that signal, the placement wall and alumni tab would only render empty states, so building them earlier is premature. Concretely: review the signal ~4-6 weeks after Phase 1 ships (or sooner if a launch-partner institute asks for these surfaces), then write the Phase 2 implementation plan.

## 8. Open decisions for the owner (not domain, genuinely business)

1. **Revenue stance on institutes:** keep course listings free + only paid boosts (consistent with the rest of Connect), or introduce a paid "placement partner" tier later? (Pricing call, not a domain one.)
2. **Credential trust bar:** is institute-confirmed enough for the badge, or do we also want the institute itself verified (GST/Udyam) before its confirmations carry the badge? (Trust/brand call.)
3. **Launch partners:** which 2-3 institutes to approach first (Surat-first).
