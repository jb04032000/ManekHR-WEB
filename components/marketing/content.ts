/**
 * Static, non-translatable data for the marketing site.
 *
 * Holds only structure - i18n message-key ids, hrefs, icon names, ordinals.
 * Every user-visible string lives in `app/messages/*.json` under the
 * `marketing` namespace and is resolved by the section components.
 *
 * Cross-module links: the section components under `components/marketing/`
 * map these arrays to translation keys; `lib/locales.ts` owns the locale list.
 */
import { env } from '@/lib/env';

/**
 * Auth entry points for the marketing CTAs. Two query params do two different,
 * independent jobs:
 *   - `redirect=` is the POST-auth destination (where an existing user lands
 *     after signing in).
 *   - `for=` is the SIGNUP product intent read by `app/auth/AuthClient.tsx`
 *     (`urlIntent`). When present it pins the product so SignupMode skips the
 *     IntentPicker; when absent the picker asks a new user to choose.
 *
 * `getStarted` (neutral): carries only `redirect=/dashboard`, no `for=`. Used
 * by genuinely product-neutral surfaces (home `/`, navbar, about, guides,
 * pricing) so a new user lands straight in the staff+salary workspace.
 *
 * `getStartedConnect`: legacy alias retained only so no stale link 404s; not
 * used by any current page (ManekHR ships a single product).
 *
 * `getStartedErp`: pins ERP intent (`for=erp`). Deliberately NO `redirect=` so
 * existing workspace users land in `/dashboard` and new users go to workspace
 * setup, per existing auth behaviour. Used by the dedicated ERP page. Watch: do
 * NOT add `redirect=/connect` here or ERP joiners get sent to Connect.
 */
export const AUTH = {
  getStarted: '/auth?redirect=/dashboard',
  // Connect product removed (2026-07-04): kept as an alias of the neutral CTA so
  // any straggler consumer still routes somewhere sane (never a deleted route).
  getStartedConnect: '/auth?redirect=/dashboard',
  getStartedErp: '/auth?for=erp',
} as const;

/** Contact email shown across the marketing footer / contact page. Single source:
 *  the one support mailbox (lib/env `supportEmail`) so it changes in one place. */
export const CONTACT_EMAIL = env.supportEmail;

/**
 * Social profiles. NOTE: placeholder handles — the owner should replace
 * these with the real ManekHR social URLs before launch. The contact page
 * still uses this full list; the footer uses FOOTER_SOCIAL (below).
 */
export const SOCIAL_LINKS = [
  { id: 'linkedin', icon: 'linkedin', href: 'https://www.linkedin.com/company/manekhr' },
  { id: 'instagram', icon: 'instagram', href: 'https://www.instagram.com/manekhrapp/' },
  // WhatsApp contact number is dynamic — set NEXT_PUBLIC_SUPPORT_PHONE (digits only,
  // wa.me format). Empty -> blank href; the contact page then hides this option.
  {
    id: 'whatsapp',
    icon: 'whatsapp',
    href: env.supportPhone ? `https://wa.me/${env.supportPhone}` : '',
  },
] as const;

/**
 * Footer social list — Instagram only (owner decision 2026-06-21: LinkedIn and
 * WhatsApp are not shown in the footer). The contact page keeps the full list.
 */
export const FOOTER_SOCIAL = SOCIAL_LINKS.filter((social) => social.id === 'instagram');

/**
 * Navbar product links. ManekHR ships a single product (staff + salary), so the
 * Connect / ERP product switcher is intentionally EMPTY — the navbar renders only
 * the site links. Restore the two entries if the multi-product marketing returns.
 */
export const NAV_PRODUCT_LINKS: readonly { id: string; href: string; dot: 'indigo' | 'gold' }[] =
  [];

export const NAV_SITE_LINKS = [
  { id: 'pricing', href: '/pricing' },
  { id: 'about', href: '/about' },
  { id: 'contact', href: '/contact' },
] as const;

/* ─────────────────────────── Landing (/) ─────────────────────────── */

/**
 * Landing industry-context stat strip - a few conservative, honest figures
 * framed as the MARKET ManekHR serves (Surat's diamond-polishing units), never
 * ManekHR's own metrics: we publish no user counts. Each id maps to a stat +
 * label under marketing.industry.items.{id}.{stat,label}. `value`/`label` copy
 * is localized; the figures stay approximate and honest. Rendered by the
 * IndustryStrip section on the home page only. Keep figures conservative if ever
 * updated; do not present these as platform usage.
 */
export const LANDING_INDUSTRY_STATS = ['workforce', 'value', 'hubs'] as const;

/** Landing "how it works" — three steps. */
export const LANDING_STEPS = ['create', 'post', 'deal'] as const;

/**
 * Landing "three things, one place" pillars — the core jobs ManekHR does for a
 * diamond-polishing unit: staff records, attendance, and salary. NOTE: this
 * const is currently unused by the live home page (ThreePillars.tsx, its only
 * consumer, is not imported by app/(marketing)/page.tsx — ProductTour replaced
 * it) but is kept in sync in case that component is reinstated. `mock` is a
 * dead field (no current consumer reads it); `icon` keys the ICONS lookup;
 * copy under marketing.pillars.
 */
export const LANDING_PILLARS = [
  { id: 'staff', icon: 'users', mock: 'feed' },
  { id: 'attendance', icon: 'layers', mock: 'storefront' },
  { id: 'salary', icon: 'briefcase', mock: 'jobs' },
] as const;

/**
 * Landing trust-wedge mechanics — the honest differentiation hook (accurate
 * salary math, clear audit trail, role-based access). Each is a real product
 * feature, never an invented number or logo. Copy under marketing.trust.
 */
export const LANDING_TRUST_ITEMS = [
  { id: 'verified', icon: 'shield' },
  { id: 'erpBacked', icon: 'building' },
  { id: 'accuracy', icon: 'spark' },
  { id: 'direct', icon: 'users' },
  // Fifth trust card: role-based access control (who can see/edit what). The
  // fifth card centres in the last row (see TrustWedge.tsx last-card centering).
  { id: 'roles', icon: 'shield' },
] as const;

/** Landing module showcase — benefit-first, one line each per ManekHR module. */
export const LANDING_MODULES = [
  { id: 'team', icon: 'users' },
  { id: 'attendance', icon: 'layers' },
  { id: 'salary', icon: 'briefcase' },
  { id: 'roles', icon: 'shield' },
] as const;

/**
 * Landing audience strip: one sentence to each real ManekHR user (unit owner,
 * karigars/staff, supervisors, and accountants/HR admins). Personas render
 * 3-up in AudienceStrip.tsx (the lone last card is centred there); `icon`
 * keys ICONS.
 */
export const AUDIENCE_STRIP = [
  { id: 'owner', icon: 'building' },
  { id: 'karigar', icon: 'pencil' },
  { id: 'supervisor', icon: 'users' },
  { id: 'accountant', icon: 'briefcase' },
] as const;

/** Landing pricing story — three reassurance points about ManekHR's simple,
 * transparent subscription pricing. */
export const LANDING_PRICING_POINTS = ['free', 'noCard', 'cancel'] as const;

/** Landing ERP companion band — secondary product chips (matches the ERP
 * page's team/attendance/salary/roles pillars). */
export const ERP_CHIPS = [
  { id: 'team', icon: 'users' },
  { id: 'attendance', icon: 'layers' },
  { id: 'salary', icon: 'tag' },
  { id: 'roles', icon: 'shield' },
] as const;

/**
 * Landing FAQ: staff+salary questions (answer-engine surface). Each also
 * extends the home FAQPage JSON-LD via faqPageJsonLd in
 * app/(marketing)/page.tsx.
 */
export const LANDING_FAQ_ITEMS = [
  'free',
  'setup',
  'pricing',
  'attendance',
  'payroll',
  'languages',
  'compliance',
  'roles',
  'data',
  'support',
  'switch',
] as const;

/**
 * `/pricing` FAQ ids. Drives the unified pricing page's FaqBlock + its FAQPage
 * JSON-LD (app/(marketing)/pricing/page.tsx). Copy lives under
 * marketing.pages.pricing.faq.items.{id}.{q,a} in every locale.
 */
export const PRICING_FAQ_ITEMS = ['trial', 'whichPlan', 'billing', 'gst', 'switch', 'cancel'] as const;

/* ───────────── /about (the "What is ManekHR?" entity page) ───────────── */

/**
 * `/about` "who it is for" persona cards. The /about page is the canonical
 * brand-entity answer page (the page Google + AI engines should cite for "What
 * is ManekHR?"), so these mirror the real users ManekHR serves. `icon` keys
 * ICONS; copy under marketing.pages.about.audience.items.{id}. Keep this list
 * in sync with AUDIENCE_STRIP (the home strip) so the brand story is
 * consistent across surfaces.
 */
export const ABOUT_AUDIENCE = [
  { id: 'owner', icon: 'building' },
  { id: 'karigar', icon: 'pencil' },
  { id: 'supervisor', icon: 'users' },
  { id: 'accountant', icon: 'briefcase' },
] as const;

/**
 * `/about` "what you can do" cards - the jobs ManekHR does for a diamond-
 * polishing unit (staff records, attendance, salary, role-based access).
 * `icon` keys ICONS; copy under marketing.pages.about.doItems.items.{id}.
 */
export const ABOUT_DO_ITEMS = [
  { id: 'team', icon: 'users' },
  { id: 'attendance', icon: 'layers' },
  { id: 'salary', icon: 'tag' },
  { id: 'roles', icon: 'shield' },
] as const;

/**
 * `/about` visible FAQ ids - the brand-entity questions an answer engine should
 * be able to quote (each answer is self-contained). The SAME English copy is
 * wired into FAQPage JSON-LD in app/(marketing)/about/page.tsx. Copy under
 * marketing.pages.about.faq.items.{id}.{q,a}.
 */
export const ABOUT_FAQ_ITEMS = ['what', 'who', 'free', 'do', 'languages'] as const;

/**
 * Footer link columns. ManekHR ships a single product (staff + salary), so the
 * footer carries only the ERP feature anchors (on `app/(marketing)/erp/page.tsx`)
 * and the company links. Legal links live in the footer bottom bar (Privacy /
 * Terms / Community Guidelines / Grievance), hard-coded in `Footer.tsx` rather
 * than as a column here, so the Privacy Policy is reachable site-wide (AdSense +
 * DPDP requirement). Keep those in sync with the `marketing.footer.legal` keys
 * in every locale.
 */
export const FOOTER_COLUMNS = [
  {
    id: 'erp',
    links: [
      { id: 'erpOverview', href: '/erp' },
      { id: 'erpTeam', href: '/erp#team' },
      { id: 'erpSalary', href: '/erp#salary' },
      { id: 'erpRoles', href: '/erp#roles' },
    ],
  },
  {
    id: 'company',
    links: [
      { id: 'about', href: '/about' },
      { id: 'guides', href: '/guides' },
      { id: 'pricing', href: '/pricing' },
      { id: 'contact', href: '/contact' },
    ],
  },
] as const;
