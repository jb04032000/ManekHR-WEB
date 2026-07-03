# Zari360 Connect - Public Marketing Rebuild (Phase 1)

**Date:** 2026-06-01
**Status:** Approved design, ready for implementation
**Scope:** Public, logged-out marketing pages only. Reframe the shared landing page to the textile trade and rebuild the `/connect` product page into the full Connect story. No changes to the in-app product or to the ERP product page beyond keeping it coherent on the shared landing.

> Companion docs (read together):
>
> - `docs/marketing/connect/connect-positioning-and-messaging.md` - brand voice, the messaging spine, the verified research synthesis, and the terminology do/don't list.
> - `docs/marketing/connect/connect-launch-campaign.md` - the go-to-market launch plan.

---

## 1. Why we are doing this

The marketing site already exists and is polished, but its Connect story is thin and out of date. Today `/connect` describes Connect as four pillars (Marketplace, Jobs, Network, Feed). The shipped product is far richer: profiles, network, a feed, a lead-generation marketplace, jobs and hiring, company pages, storefronts, quote requests, and a unified inbox. The whole site is also framed tightly around "embroidery" and role words like "karigar" and "owner".

Two decisions from the owner reset the framing:

1. **Position for the whole textile trade**, not only embroidery. Embroidery and zari are our home turf and our credibility, not the ceiling. This matches the real marketplace categories: weaving, dyeing, printing, embroidery and zari, job work, raw material, machinery, finished goods.
2. **Use trade-role-neutral language.** Manufacturers, workshops, processing units, suppliers, wholesalers, buyers, designers, and professionals - not "karigar" or "owner" as the headline frame. "Karigar" may appear sparingly only where local trust helps.

## 2. What Connect is (the one-line and the three layers)

Connect is the textile trade's own network, marketplace, and hiring hub. It rests on the three jobs-to-be-done validated by research:

1. **Network and presence** - be seen by the whole trade. Profile, company page, storefront, feed.
2. **Marketplace** - find suppliers and buyers, deal directly, no middleman, no checkout. Enquiries and quote requests (RFQ).
3. **Jobs and hiring** - hire skilled people or find your next job, with verified employers.

## 3. The differentiators (what makes the copy land)

- **The wedge: genuine, verified connections, not a wall of fake leads.** Research confirmed the category leader (IndiaMART) is widely distrusted for spraying one inquiry to 10-15 sellers and for fake enquiries. Connect promises real, relevant, verified businesses. This is our strongest single message.
- **The moat: "Verified on Zari360".** Many businesses on Connect also run their daily operations on Zari360 ERP, so they are real, active, and accountable. No competitor can copy operational truth. We surface it as a visible trust signal.
- **The close: WhatsApp.** Every enquiry and conversation can continue on WhatsApp in one tap, because that is how the Surat trade already does business.
- **The reassurance:** free to start, works in Gujarati, Hindi, and English, on phone and laptop.

## 4. Audience model (trade-role-neutral)

Replaces the old Karigar / Owner / Seller / Designer / Buyer set:

| id              | Label (en)                  | Who                                                          |
| --------------- | --------------------------- | ------------------------------------------------------------ |
| `manufacturers` | Manufacturers and workshops | Weaving, power-loom, garment units                           |
| `processing`    | Processing units            | Dyeing, printing, embroidery, and zari work                  |
| `suppliers`     | Suppliers and wholesalers   | Fabric, yarn, machinery, raw material, accessories           |
| `buyers`        | Buyers and sourcing         | Anyone sourcing material, capacity, or finished goods        |
| `professionals` | Designers and professionals | Designers, managers, and skilled workers (secondary segment) |

Note: research flagged "designer" as a weaker Surat segment, so it is intentionally last and framed as "designers and professionals", not a standalone hero audience.

## 5. Page architecture

### 5.1 Landing page (`/`) - reframed, dual-product

Keeps both products visible. Each links to its dedicated page.

1. **Hero** - textile-trade headline, primary "Get started free", the two product chips (Connect indigo, ERP gold) retained.
2. **Audiences** (`RolesSection`) - the trade-role-neutral segments above.
3. **Connect section** - the network + marketplace + jobs trinity, links to `/connect`.
4. **ERP section** - operations (team, finance, machines, roles), links to `/erp`. Keeps real embroidery/zari operational depth.
5. **Why Zari360** - six value props reframed to the textile trade.
6. **FAQ** - reframed.
7. **Final CTA.**

### 5.2 `/connect` page - the full convince-to-register story

1. **Hero** - Connect badge, category-leadership headline, the wedge in the sub-line. Primary "Get started free", secondary "Explore Zari360 ERP". Footnote: free, three languages, WhatsApp.
2. **The trinity** (new `ConnectTrinity` section) - three large cards: Network, Marketplace, Jobs. Each with a one-line outcome and three sub-points.
3. **Marketplace deep block** (`FeatureBlock` grid) - verified sellers, enquiries and quote requests, no middleman, WhatsApp handoff, the eight real categories.
4. **Jobs and hiring deep block** - post jobs, apply with a work-sample profile, verified employers, daily-wage / piece-rate / monthly all supported.
5. **Network and presence deep block** - profile, company pages, storefronts, feed, connect and follow, showcase work.
6. **Trust and verification** (new `TrustSection`, dark band) - the moat. Verified on Zari360, GST and Udyam badges, reviews only after a real deal, real operating businesses.
7. **Built for how the trade works** (new `BuiltForSection`) - WhatsApp-first, three languages, mobile and web, visual-first, free to start.
8. **How it works** (new `HowItWorks`) - 3 steps: create your profile or page, list or search, connect and close on WhatsApp.
9. **Audiences** - the trade-role-neutral cards reused from the landing audience set (Connect-relevant subset).
10. **FAQ** - Connect-specific questions.
11. **Final CTA.**

## 6. Components

Reuse: `PageHero`, `Container`, `SectionHeading`, `FeatureBlock`, `FeatureList`, `FinalCta`, `MarketingButton`, `ProductBadge`, `Eyebrow`, `RoleCard`, `icons`.

New (small, in the existing visual language):

- `ConnectTrinity` - three outcome cards (network / marketplace / jobs).
- `TrustSection` - dark band, verification and trust points, the "Verified on Zari360" hero point.
- `BuiltForSection` - "built for how the trade works" point grid.
- `HowItWorks` - three numbered steps with connectors.
- New stroke icons as needed: `network`, `store`, `briefcase`, `shield`/`verified`, `chat`, `layers`, `search`. Added to `icons.tsx` and the `ICONS` map.

`content.ts` gains: new `AUDIENCES` (replaces `ROLES`), `CONNECT_TRINITY`, `CONNECT_MARKETPLACE`/`CONNECT_JOBS`/`CONNECT_NETWORK` block ids, `TRUST_ITEMS`, `BUILT_FOR_ITEMS`, `HOW_IT_WORKS_STEPS`, `CONNECT_FAQ_ITEMS`. Existing `CONNECT_PILLARS` is superseded by the trinity + deep blocks.

## 7. Copy and i18n

- All user-visible strings live under the `marketing` namespace in `app/messages/{en,gu,gu-en,hi-en}.json`. No hardcoded copy in components.
- Ship all four locales. English is authored first and is the source of truth; gu / gu-en / hi-en are translated to match the exact key structure. Native review is recommended before launch (consistent with prior Connect i18n practice).
- India English: "Enquire for pricing" not "Request a quote", "PIN code" not ZIP. No em-dashes anywhere (banned project-wide).
- Voice rules live in the messaging doc and bind all copy.

## 8. Accessibility and quality bar

- WCAG AA: every new section uses semantic headings, the dark bands carry `.mkt-on-dark`, icons are `aria-hidden`, interactive elements are keyboard reachable, focus states preserved.
- Responsive: mobile-first, matches the existing `clamp()` type scale and section rhythm.
- No new design language, no new fonts, no new color tokens. Cohesion with the existing marketing system is a hard requirement.

## 9. Out of scope (Phase 2 and beyond)

- Public marketing sub-pages `/connect/marketplace` and `/connect/jobs` for deeper SEO. Deferred.
- In-app first-run onboarding (post-login). Deferred.
- Any change to the in-app product, the backend, or ERP functionality.
- Legal pages (`/legal/*`) still 404, unchanged.

## 10. Verification

- TypeScript: `nest build`-style or `tsc` on changed web files must be clean (use the project's lint/build, respecting the BE-test resource caution which does not apply to web).
- i18n parity: all four locale files carry the same new keys (a key-parity check).
- Manual: render `/` and `/connect` at mobile and desktop widths; confirm both product paths, all sections, and the language toggle.
- Owner stages and commits (assistant runs no git operations).
