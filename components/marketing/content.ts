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
 * `getStarted` (neutral): carries only `redirect=/connect`, no `for=`. Used
 * ONLY by genuinely product-neutral surfaces (home `/`, navbar, about, guides,
 * pricing) so a NEW user still sees the product picker, while an existing
 * ERP-workspace user who joins from a Connect surface still lands in Connect
 * (`/connect/feed`), not the ERP `/dashboard` (auth special-cases
 * `redirect=/connect` -> `safeRedirect`).
 *
 * `getStartedConnect`: pins Connect intent (`for=connect`) AND keeps the
 * Connect destination. Used by the dedicated Connect page AND every
 * Connect-flavored SEO page (textile-jobs, textile-marketplace,
 * textile-network, textile-services, saree-wholesalers, fabric-suppliers,
 * dress-material-wholesalers, zari-manufacturers, embroidery-job-work) so
 * their visitors skip the picker; the entry page already expressed intent and
 * re-asking was a measured confusion point. Their FinalCta passes
 * `signupIntent="connect"` (analytics `page` slug stays untouched).
 *
 * `getStartedErp`: pins ERP intent (`for=erp`). Deliberately NO `redirect=` so
 * existing workspace users land in `/dashboard` and new users go to workspace
 * setup, per existing auth behaviour. Used by the dedicated ERP page. Watch: do
 * NOT add `redirect=/connect` here or ERP joiners get sent to Connect.
 */
export const AUTH = {
  getStarted: '/auth?redirect=/dashboard',
  getStartedConnect: '/auth?for=connect&redirect=/connect',
  getStartedErp: '/auth?for=erp',
} as const;

/**
 * Marketing routes whose AUDIENCE is Connect-specific even though their
 * analytics `page` slug is neutral. Shared chrome (Navbar) pins the signup CTA
 * to `getStartedConnect` on these paths so a visitor is never re-asked the
 * product question their entry page already answered. Keep in sync with the
 * per-page Hero/FinalCta pinning inside each of these page files.
 */
export const CONNECT_INTENT_PATHS: readonly string[] = [
  '/textile-jobs',
  '/textile-marketplace',
  '/textile-network',
  '/textile-services',
  '/saree-wholesalers',
  '/fabric-suppliers',
  '/dress-material-wholesalers',
  '/zari-manufacturers',
  '/embroidery-job-work',
];

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
 * Landing industry-context stat strip - a few conservative, widely-cited India
 * textile-industry figures framed as the MARKET ManekHR serves (never ManekHR's
 * own metrics: we publish no user counts). Each id maps to a stat + label under
 * marketing.industry.items.{id}.{stat,label}. `value`/`label` copy is localized;
 * the figures stay approximate ("crore", "lakh+") and honest. Rendered by the
 * IndustryStrip section on the home page only. Keep figures conservative if ever
 * updated; do not present these as platform usage.
 */
export const LANDING_INDUSTRY_STATS = ['workforce', 'value', 'hubs'] as const;

/** Landing "how it works" — three steps. */
export const LANDING_STEPS = ['create', 'post', 'deal'] as const;

/**
 * Landing "three things, one place" pillars — the three jobs (network /
 * marketplace / hiring), each shown with its real module mock. Sets the mental
 * model BEFORE the five-tool grid. `mock` keys MODULE_MOCKS in mockups.tsx;
 * `icon` keys the ICONS lookup; copy under marketing.pillars.
 */
export const LANDING_PILLARS = [
  { id: 'network', icon: 'network', mock: 'feed' },
  { id: 'marketplace', icon: 'store', mock: 'storefront' },
  { id: 'hiring', icon: 'briefcase', mock: 'jobs' },
] as const;

/**
 * Landing trust-wedge mechanics — the honest differentiation hook ("real,
 * verified businesses, not a wall of fake leads"). Each is a real product
 * feature, never an invented number or logo. Copy under marketing.trust.
 */
export const LANDING_TRUST_ITEMS = [
  { id: 'verified', icon: 'shield' },
  { id: 'erpBacked', icon: 'building' },
  { id: 'ratings', icon: 'spark' },
  { id: 'direct', icon: 'users' },
  // Broker / dalal network-trust differentiator: a broker introduces a buyer and
  // a seller, both confirm, and a verified track record builds up. Reviews are
  // private and shown as initials only. `handshake` icon in icons.tsx; copy under
  // marketing.trust.items.broker. The fifth card centres in the last row (see
  // TrustWedge.tsx last-card centering).
  { id: 'broker', icon: 'handshake' },
] as const;

/** Landing Connect module showcase — benefit-first, one line each. */
export const LANDING_MODULES = [
  { id: 'feed', icon: 'spark' },
  { id: 'storefront', icon: 'store' },
  { id: 'rfq', icon: 'tag' },
  { id: 'jobs', icon: 'briefcase' },
  { id: 'chat', icon: 'chat' },
] as const;

/**
 * Landing audience strip: one sentence to each trade persona. `institute` and
 * `student` cover the now-live Connect Institutes feature (institute pages +
 * courses, and the institute-confirmed "Trained at" student credential).
 * `serviceProvider` is the honest, true-today persona for textile service
 * trades (consultants, machine maintenance, dyeing/printing, transport): they
 * list the services they offer + rates on their public profile and get hired -
 * NOT a browsable services directory (that is a separate near-future build).
 * Seven personas render 3-up in AudienceStrip.tsx (the lone last card is
 * centred there); `icon` keys ICONS.
 */
export const AUDIENCE_STRIP = [
  { id: 'karigar', icon: 'pencil' },
  { id: 'trader', icon: 'bag' },
  { id: 'mill', icon: 'building' },
  { id: 'jobseeker', icon: 'search' },
  { id: 'institute', icon: 'graduationCap' },
  { id: 'student', icon: 'award' },
  { id: 'serviceProvider', icon: 'wrench' },
] as const;

/** Landing free-pricing story — three reassurance points. */
export const LANDING_PRICING_POINTS = ['free', 'boost', 'commission'] as const;

/** Landing ERP companion band — secondary product chips. */
export const ERP_CHIPS = [
  { id: 'team', icon: 'users' },
  { id: 'billing', icon: 'tag' },
  { id: 'machines', icon: 'layers' },
  { id: 'roles', icon: 'shield' },
] as const;

/**
 * Landing FAQ: buyer + seller questions (answer-engine surface). `institutes`
 * answers the now-live Connect Institutes feature (courses); `services` answers
 * the services/experts directory and `broker` the dalal introductions feature.
 * Each also extends the home FAQPage JSON-LD via faqPageJsonLd in
 * app/(marketing)/page.tsx.
 */
export const LANDING_FAQ_ITEMS = [
  'free',
  'sell',
  'commission',
  'enquiries',
  'quotes',
  'languages',
  'gst',
  'work',
  'institutes',
  'services',
  'broker',
] as const;

/* ─────────────────────────── /connect ─────────────────────────── */

/** Connect page "how it works" — three steps. */
export const CONNECT_HOW_STEPS = ['profile', 'post', 'deal'] as const;

/**
 * Connect per-module deep sections. `icon` keys the ICONS lookup; the
 * component alternates the mockup side using the index.
 */
export const CONNECT_MODULES = [
  { id: 'feed', icon: 'spark' },
  { id: 'storefront', icon: 'store' },
  { id: 'rfq', icon: 'tag' },
  { id: 'jobs', icon: 'briefcase' },
  { id: 'chat', icon: 'chat' },
] as const;

/** Connect mid-page CTA bands (between module sections). */
export const CONNECT_CTA_BANDS = ['shop', 'hire'] as const;

/** Connect trust / safety points (dark band). `broker` is the dalal network-trust
 * differentiator: introductions both sides confirm, building a verified track
 * record, with private initials-only reviews. The fifth card centres in the last
 * row (see ConnectTrust.tsx last-card centering). `handshake` icon in icons.tsx. */
export const CONNECT_TRUST_ITEMS = [
  { id: 'erpLinked', icon: 'building' },
  { id: 'ratings', icon: 'spark' },
  { id: 'direct', icon: 'users' },
  { id: 'safety', icon: 'shield' },
  { id: 'broker', icon: 'handshake' },
] as const;

/**
 * Connect "built for the trade" point grid. The old `services` point was lifted
 * out into the dedicated ConnectServices section (CONNECT_SERVICES below) so the
 * services/experts directory gets a full band instead of one cramped card; this
 * grid now holds the five core "how the trade works" points and renders 3-up
 * (the lone trailing card centres in ConnectBuiltFor.tsx).
 */
export const CONNECT_BUILT_FOR = [
  { id: 'whatsapp', icon: 'whatsapp' },
  { id: 'languages', icon: 'globe' },
  { id: 'mobile', icon: 'arrowUpRight' },
  { id: 'visual', icon: 'spark' },
  { id: 'free', icon: 'tag' },
] as const;

/**
 * Connect services / experts directory band - the now-live feature where members
 * list the services they offer (consulting, maintenance, machine repair, testing,
 * installation, transport, logistics, contractor, dyeing, printing, job-work,
 * embroidery) and buyers/suppliers browse by type + location. Honest framing: the
 * browse is in-app at /connect/services; the public per-service pages live at
 * /products/[id]. Mirrors CONNECT_INSTITUTES (icon-card grid). `icon` keys ICONS;
 * copy under marketing.pages.connect.services. Four cards render 3-up (the lone
 * trailing card centres in ConnectServices.tsx).
 */
export const CONNECT_SERVICES = [
  { id: 'list', icon: 'wrench' },
  { id: 'found', icon: 'search' },
  { id: 'browse', icon: 'globe' },
  { id: 'track', icon: 'spark' },
] as const;

/**
 * Connect institutes + students band — the now-live Institutes feature on the
 * deep product page (the home audience strip carries only the short persona
 * version). `icon` keys ICONS; copy under marketing.pages.connect.institutes.
 */
export const CONNECT_INSTITUTES = [
  { id: 'courses', icon: 'graduationCap' },
  { id: 'placement', icon: 'briefcase' },
  { id: 'credential', icon: 'award' },
] as const;

/**
 * Connect-specific FAQ. `trainedAt` explains the now-live institute-confirmed
 * "Trained at" student credential; `services` covers the services/experts
 * directory and `broker` the dalal introductions. Each also extends the /connect
 * FAQPage JSON-LD via faqPageJsonLd in app/(marketing)/connect/page.tsx.
 */
export const CONNECT_FAQ_ITEMS = [
  'free',
  'boost',
  'commission',
  'storefront',
  'rfq',
  'voice',
  'languages',
  'safety',
  'trainedAt',
  'services',
  'broker',
] as const;

/**
 * `/pricing` FAQ ids. Drives the unified pricing page's FaqBlock + its FAQPage
 * JSON-LD (app/(marketing)/pricing/page.tsx). Copy lives under
 * marketing.pages.pricing.faq.items.{id}.{q,a} in every locale.
 */
export const PRICING_FAQ_ITEMS = [
  'trial',
  'whichPlan',
  'billing',
  'gst',
  'switch',
  'connectFree',
  'cancel',
] as const;

/* ───────────── /about (the "What is ManekHR?" entity page) ───────────── */

/**
 * `/about` "who it is for" persona cards. The /about page is the canonical
 * brand-entity answer page (the page Google + AI engines should cite for "What
 * is ManekHR?"), so these mirror the real trade personas ManekHR serves. `icon`
 * keys ICONS; copy under marketing.pages.about.audience.items.{id}. Keep this
 * list in sync with AUDIENCE_STRIP (the home strip) so the brand story is
 * consistent across surfaces.
 */
export const ABOUT_AUDIENCE = [
  { id: 'trader', icon: 'bag' },
  { id: 'karigar', icon: 'pencil' },
  { id: 'dalal', icon: 'handshake' },
  { id: 'mill', icon: 'building' },
  { id: 'institute', icon: 'graduationCap' },
  { id: 'serviceProvider', icon: 'wrench' },
] as const;

/**
 * `/about` "what you can do" cards - the four jobs ManekHR does (network /
 * marketplace / jobs / ERP). `icon` keys ICONS; copy under
 * marketing.pages.about.doItems.items.{id}.
 */
export const ABOUT_DO_ITEMS = [
  { id: 'network', icon: 'network' },
  { id: 'marketplace', icon: 'store' },
  { id: 'jobs', icon: 'briefcase' },
  { id: 'erp', icon: 'building' },
] as const;

/**
 * `/about` visible FAQ ids - the brand-entity questions an answer engine should
 * be able to quote (each answer is self-contained). The SAME English copy is
 * wired into FAQPage JSON-LD in app/(marketing)/about/page.tsx. Copy under
 * marketing.pages.about.faq.items.{id}.{q,a}.
 */
export const ABOUT_FAQ_ITEMS = ['what', 'who', 'free', 'do', 'languages'] as const;

/* ───────────── /textile-network ("textile network" SEO landing) ───────────── */

/**
 * `/textile-network` "who the network connects" list - the roles the textile
 * network links. Doubles as the source for the page's ItemList JSON-LD. `icon`
 * keys ICONS; copy under marketing.pages.network.connects.items.{id}.
 */
export const NETWORK_CONNECTS = [
  { id: 'traders', icon: 'bag' },
  { id: 'karigars', icon: 'pencil' },
  { id: 'dalals', icon: 'handshake' },
  { id: 'mills', icon: 'building' },
  { id: 'institutes', icon: 'graduationCap' },
  { id: 'serviceProviders', icon: 'wrench' },
] as const;

/**
 * `/textile-network` "what you can do" cards. `icon` keys ICONS; copy under
 * marketing.pages.network.features.items.{id}.
 */
export const NETWORK_FEATURES = [
  { id: 'connect', icon: 'network' },
  { id: 'discover', icon: 'search' },
  { id: 'deal', icon: 'chat' },
] as const;

/**
 * `/textile-network` FAQ ids, wired into faqPageJsonLd in
 * app/(marketing)/textile-network/page.tsx. Copy under
 * marketing.pages.network.faq.items.{id}.{q,a}.
 */
export const NETWORK_FAQ_ITEMS = ['how', 'free', 'who'] as const;

/* ───────────── Deep-dive pages (kept from before) ───────────── */

/** `/textile-marketplace` - what you can do (FeatureBlock grid). */
export const MARKETPLACE_FEATURES = [
  'discover',
  'list',
  'enquire',
  'rfq',
  'storefront',
  'whatsapp',
] as const;

/** `/textile-marketplace` - category chips (the real trade categories). */
export const MARKETPLACE_CATEGORIES = [
  'weaving',
  'dyeing',
  'printing',
  'embroidery',
  'jobwork',
  'rawmaterial',
  'machinery',
  'finished',
] as const;

/** `/textile-marketplace` - marketplace FAQ. */
export const MARKETPLACE_FAQ_ITEMS = ['cost', 'genuine', 'payment', 'categories'] as const;

/**
 * `/textile-services` - what you can do (FeatureBlock grid). Mirrors the
 * MARKETPLACE_FEATURES shape. Honest framing: each service is a real listing
 * with a service category; the public per-service pages are `/products/[id]`
 * (they emit schema.org Service), and the in-app browse is `/connect/services`.
 */
export const SERVICES_FEATURES = ['list', 'discover', 'browse', 'track'] as const;

/**
 * `/textile-services` - the 12 service-type chips. Mirror of the codebase
 * SERVICE_CATEGORIES (features/connect/marketplace/marketplace.types.ts); the
 * `embroidery` id here labels the `embroidery-zari` listing category. Keep in
 * sync with that source list if service types change.
 */
export const SERVICES_CATEGORIES = [
  'consulting',
  'maintenance',
  'machine-repair',
  'testing',
  'installation',
  'transport',
  'logistics',
  'contractor',
  'dyeing',
  'printing',
  'job-work',
  'embroidery',
] as const;

/** `/textile-services` - services FAQ. Mirrors MARKETPLACE_FAQ_ITEMS shape. */
export const SERVICES_FAQ_ITEMS = ['cost', 'find', 'payment', 'types'] as const;

/** `/textile-jobs` - what you can do (FeatureBlock grid). */
export const JOBS_FEATURES = ['post', 'apply', 'verified', 'inbox', 'alerts', 'whatsapp'] as const;

/** `/textile-jobs` - employment-type chips. */
export const JOBS_TYPES = [
  'fulltime',
  'parttime',
  'piecerate',
  'dailywage',
  'apprenticeship',
] as const;

/** `/textile-jobs` - jobs FAQ. */
export const JOBS_FAQ_ITEMS = ['cost', 'verified', 'types', 'apply'] as const;

/**
 * Footer link columns. All hrefs resolve to real routes: the Connect column
 * points at the Connect overview + the two marketing deep-dives; the ERP column
 * points at the ERP overview + its on-page feature sections (the `#team` /
 * `#finance` / `#machines` / `#roles` anchors live on
 * `app/(marketing)/erp/page.tsx`). Legal links live in the footer bottom bar
 * (Privacy / Terms / Community Guidelines / Grievance), hard-coded in
 * `Footer.tsx` rather than as a column here, so the Privacy Policy is reachable
 * site-wide (AdSense + DPDP requirement). Keep those in sync with the
 * `marketing.footer.legal` keys in every locale.
 */
export const FOOTER_COLUMNS = [
  {
    id: 'connect',
    links: [
      { id: 'connectOverview', href: '/connect' },
      // `network` -> the /textile-network SEO landing (targets the "textile
      // network / surat textile networking" search intent). Page lives at
      // app/(marketing)/textile-network/page.tsx; copy under
      // marketing.footer.links.network in every locale.
      { id: 'network', href: '/textile-network' },
      { id: 'marketplace', href: '/textile-marketplace' },
      { id: 'services', href: '/textile-services' },
      { id: 'jobs', href: '/textile-jobs' },
    ],
  },
  {
    id: 'erp',
    links: [
      { id: 'erpOverview', href: '/erp' },
      { id: 'erpTeam', href: '/erp#team' },
      { id: 'erpFinance', href: '/erp#finance' },
      { id: 'erpMachines', href: '/erp#machines' },
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
