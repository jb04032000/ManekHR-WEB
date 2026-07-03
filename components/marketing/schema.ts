/**
 * JSON-LD structured-data builders for the marketing site.
 *
 * Address carries country only — no locality/region, per the no-region
 * requirement. Schema content is always English (never localized): search +
 * answer engines read the default-locale render, and the visible FAQ text
 * matches these strings for the `en` build.
 */
import { env } from '@/lib/env';

const BASE = env.appUrl;

/**
 * Topical keyword signal for search + answer/generative engines, attached to the
 * site's schema entities (Organization, WebSite, SoftwareApplication, pricing).
 * INVISIBLE to visitors and locale-independent (schema is always English), so it
 * adds keyword context on every page without any change to on-page content.
 *
 * Covers four groups: the platform/product, India's major textile HUBS paired
 * with the specialty each is known for (researched 2026-06-27, sourced from
 * textile-cluster references), the PRODUCTS, and the MATERIALS/processes the
 * trade searches for. Each entry is a real B2B search phrase — kept relevant and
 * honest (the platform genuinely serves the whole India textile trade), not
 * stuffed. Extend here only with terms that match what ManekHR actually does.
 */
export const SITE_KEYWORDS = [
  // Platform / product
  'textile software India',
  'textile B2B marketplace',
  'textile ERP',
  'attendance and payroll software',
  'GST billing software',
  'factory and production management',
  'textile jobs',
  'karigar hiring',
  // Major Indian textile hubs + the specialty each is known for
  'Surat textile',
  'Surat saree manufacturer',
  'Ahmedabad denim',
  'Mumbai garments',
  'Delhi NCR apparel',
  'Tiruppur knitwear',
  'Coimbatore spinning mills',
  'Ludhiana hosiery and woollens',
  'Panipat home furnishing',
  'Bhilwara suiting',
  'Ichalkaranji powerloom',
  'Bhiwandi powerloom',
  'Erode cotton fabric',
  'Karur home textiles',
  'Varanasi Banarasi silk',
  'Kanchipuram silk saree',
  'Jaipur block printing',
  'Kolkata silk',
  // Products
  'saree',
  'kurti',
  'suiting',
  'shirting',
  'denim',
  'knitwear',
  'hosiery',
  'dress material',
  'readymade garments',
  'home furnishing',
  // Materials / fabrics
  'cotton fabric',
  'silk',
  'polyester',
  'viscose',
  'rayon',
  'georgette',
  'chiffon',
  'yarn',
  // Processes / services
  'embroidery',
  'zari work',
  'dyeing and printing',
  'powerloom',
  'handloom',
  'weaving',
  'job work',
  // Embroidery ecosystem (Surat's large computerized-embroidery + saree job-work
  // trade). Category terms for the trade; specific MACHINE-MAKER brand names live
  // in their own group below (owner decision: these makers/dealers are a target
  // segment for Connect, and buyers search by brand). Design-SOFTWARE brands
  // (Wilcom, EmCAD, ...) are intentionally NOT added — the category term
  // "embroidery digitizing" already covers their users.
  'computerized embroidery',
  'multi-head embroidery',
  'machine embroidery',
  'embroidery design',
  'embroidery digitizing',
  'embroidery job work',
  'embroidery machine manufacturer',
  'embroidery machine dealer',
  'zardozi',
  'aari work',
  // Trade roles the Connect jobs board hires for
  'textile designer',
  'fashion designer',
  'saree designer',
  'sketch designer',
  'CAD designer',
  'embroidery designer',
  'dyeing master',
  'cutting master',
  'tailor',
  'labour contractor',
  // Ecosystem segments / suppliers that use the network
  'dyeing unit',
  'screen printing',
  'digital printing',
  'fabric wholesaler',
  'grey fabric trader',
  'saree wholesaler',
  'yarn supplier',
  'garment exporter',
  'textile machinery dealer',
  // Sewing-machine trade (large local segment: every garment + tailoring unit
  // runs on these, plus a big dealer/repair market). Category terms; the maker
  // brands sit in the brand group below.
  'sewing machine',
  'industrial sewing machine',
  'sewing machine dealer',
  'sewing machine manufacturer',
  'sewing machine spare parts',
  'sewing machine mechanic',
  // Machine-maker BRANDS (added per owner decision — these makers/dealers are a
  // target segment, and buyers search by brand). Real top brands sold in India,
  // each paired with the machine type so it reads as a genuine search phrase.
  'Tajima embroidery machine',
  'Barudan embroidery machine',
  'ZSK embroidery machine',
  'Happy embroidery machine',
  'Ricoma embroidery machine',
  'Brother embroidery machine',
  'SWF embroidery machine',
  'Feiya embroidery machine',
  'Maya embroidery machine',
  'Juki sewing machine',
  'Jack sewing machine',
  'Usha sewing machine',
  'Singer sewing machine',
  'Siruba sewing machine',
  'Pegasus sewing machine',
  'Yamato sewing machine',
  'Typical sewing machine',
  'Zoje sewing machine',
  // Machine TYPES / features — buyers also search by type, not just brand.
  // Embroidery machine types
  'single-head embroidery machine',
  'multi-needle embroidery machine',
  'cap embroidery machine',
  'sequin embroidery machine',
  'chenille embroidery machine',
  'schiffli embroidery machine',
  'chain stitch embroidery machine',
  // Sewing machine types
  'single needle lockstitch machine',
  'double needle sewing machine',
  'overlock machine',
  'flatlock machine',
  'interlock machine',
  'bartack machine',
  'buttonhole machine',
  'button stitch machine',
  'feed off the arm machine',
  'zigzag sewing machine',
  'saree pico machine',
  // Local trade vernacular (romanized Gujarati/Hindi the trade actually searches)
  'karigar',
  'bharatkaam embroidery',
  'dalal broker',
  'vepari trader',
  'darji tailor',
  'thekedar labour contractor',
  // Gujarat/Hindi tailoring + embroidery vernacular (romanized; the trade's words)
  'silai machine',
  'silai work',
  'katai cutting',
  'kaaj buttonhole',
  'astar lining',
  'rafu darning',
  'istri pressing',
  'kapda cloth',
  'kadhai embroidery',
  'kutch work',
  // Other-state flagship vernacular (kept to the widely-searched ones)
  'thaiyal tailor',
  'shimpi tailor',
  'selai sewing',
  'taant handloom',
  'kantha embroidery',
  'phulkari',
  'bunai weaving',
  // Embellishment / hand-work types (incl. the most-typed spelling "sequence")
  'sequence work',
  'sequins work',
  'moti bead work',
  'cutdana',
  'kundan work',
  'stone work',
  'mirror work',
  'dabka work',
  'gota patti',
  'mukaish',
  'maggam work',
  // khatli = Gujarati frame-based hand embroidery (same craft family as adda work
  // above); owner-supplied 2026-07-02, verified as a live saree/blouse search term.
  'khatli work',
  'chikankari',
  'bandhani',
  'applique work',
  // Thread / yarn / material types
  'sewing thread',
  'embroidery thread',
  'cotton thread',
  'polyester thread',
  'metallic thread',
  'zari thread',
  'silai dhaga',
  'resham silk thread',
  'cotton yarn',
  'polyester yarn',
  'lace border',
  'kinari trim',
  // Embellishment RAW MATERIALS / trims (what a material/trim supplier sells —
  // distinct from the "...work" service terms above)
  'beads',
  'moti',
  'tikki',
  'sitara',
  'kundan',
  'pearls',
  'sheesha mirror',
  'badla',
  'latkan tassel',
  'buttons',
  'zip',
  'cutdana beads',
  // Whole value-chain coverage (from the full trade sweep; the COMPLETE taxonomy
  // lives in docs/textile-trade-taxonomy.md, which should drive the app's job /
  // service / product categories — this keeps only the highest-value terms).
  // Machines across spinning, weaving, knitting, processing, printing, garment.
  'rapier loom',
  'air-jet loom',
  'water-jet loom',
  'jacquard machine',
  'circular knitting machine',
  'flat knitting machine',
  'ring spinning machine',
  'TFO twisting machine',
  'draw texturing machine',
  'warping machine',
  'sizing machine',
  'jet dyeing machine',
  'stenter machine',
  'rotary screen printing machine',
  'digital textile printer',
  'fabric cutting machine',
  'fusing machine',
  'hot press machine',
  'steam press',
  // Yarn / fabric / dyes / chemicals
  'POY yarn',
  'DTY yarn',
  'FDY yarn',
  'lycra spandex',
  'grey fabric',
  'disperse dyes',
  'reactive dyes',
  'pigment paste',
  'caustic soda',
  'soda ash',
  // Trims / packaging
  'interlining',
  'saree hooks',
  'zari border',
  'hot-fix stones',
  'woven labels',
  'hang tags',
  'saree packing cover',
  'master carton',
  // Roles across the chain
  'merchandiser',
  'production manager',
  'quality inspector',
  'pattern master',
  'presser ironman',
  'weaver',
  'loom fixer',
  'screen maker',
  'yarn merchant',
  // Services / trade vocabulary
  'job work dyeing house',
  'fabric testing lab',
  'angadia service',
  'textile transporter',
  'godown keeper',
  'grey cloth',
  'thaan fabric roll',
  // Ethnic-wear PRODUCTS — high-volume buyer searches the marketplace lists, not
  // yet covered by the product group above (which skewed to fabric-class terms).
  'lehenga',
  'lehenga choli',
  'blouse',
  'dupatta',
  'salwar suit',
  'ethnic wear',
  'bridal wear',
  'pre-draped saree',
  // ── MENSWEAR + its manufacturing ecosystem (researched 2026-07-02; the list
  // above skewed women's-wear — men's ethnic, western basics, and uniforms are
  // large wholesale segments with their own manufacturer searches).
  'sherwani',
  'kurta pajama',
  'men kurta',
  'nehru jacket',
  'jodhpuri suit',
  'bandhgala',
  'indo western',
  'dhoti',
  'men ethnic wear',
  'men ethnic wear wholesale',
  'sherwani manufacturer',
  'shirt manufacturer',
  't-shirt manufacturer',
  'jeans manufacturer',
  'school uniform manufacturer',
  'corporate uniform supplier',
  'innerwear manufacturer',
  // FABRICS the trade deals in (complements the materials group). 2026 demand is
  // shifting to lighter fabrics — organza, chanderi, muslin, linen (researched
  // 2026-06-28) — alongside the standing crepe / satin / net / velvet trade.
  'organza',
  'organza saree',
  'crepe',
  'satin',
  'net fabric',
  'velvet',
  'chanderi',
  'muslin',
  'linen',
  // Regional / specialty fabrics + saree types from local trader vocabulary
  // (owner-supplied 2026-07-02, each verified as a real wholesale search term:
  // IndiaMART/Justdial/TextileInfomedia carry active categories for all of them).
  // "butti"/"buti" and "chicken"/"chikan" both kept — the trade types both spellings
  // (same precedent as "sequence work" above).
  'chanderi butti fabric',
  'chanderi buti',
  'chanderi cotton fabric',
  'pure silk saree',
  'semi silk saree',
  'dola silk',
  'dharmavaram silk saree',
  'tissue silk',
  'kanjivaram silk saree',
  'chikan buti fabric',
  'chicken buti fabric',
  'patola saree',
  'Jamnagar patola',
  'darbari saree',
  'darbari georgette saree',
  'georgette fabric',
  'silk georgette',
  // Surat wholesale-catalogue fabric names (verified 2026-07-02 on Surat wholesaler
  // sites: Wholetex/Pratham/Ethnic Export all list these as catalogue categories).
  'gaji silk',
  'vichitra silk',
  'chinnon fabric',
  'rangoli silk',
  'banglori silk',
  'banglori satin',
  'kota doria',
  'tussar silk',
  'raw silk',
  'art silk',
  // Widely-searched regional saree weaves not yet covered above
  'banarasi saree',
  'paithani saree',
  // ── GUJARAT regional craft + hub terms (researched 2026-07-02). The home state
  // of the platform's core trade; each is a named craft/hub with an active
  // wholesale market (Jamnagar/Jetpur/Kutch bandhani-printing belt, Saurashtra
  // embroidery communities). Complements the existing bandhani/kutch work entries.
  'gharchola saree',
  'panetar saree',
  'bandhej saree',
  'Jamnagar bandhani',
  'Kutch bandhani',
  'Jetpur cotton printing',
  'ajrakh print',
  'ajrakh fabric',
  'mashru fabric',
  'gamthi print',
  'rabari embroidery',
  'ahir embroidery',
  'soof embroidery',
  'Rajkot saree market',
  // ── State-wise weave/print terms beyond Gujarat (researched 2026-07-02; every
  // entry is a named GI-tag or hub craft with an active wholesale trade). Grouped
  // by region: Rajasthan prints, South silks/ikat, East handloom belt.
  // Rajasthan (Sanganer/Bagru print belt, leheriya towns, Kota)
  'sanganeri print',
  'bagru print',
  'dabu print',
  'leheriya saree',
  'jaipuri print fabric',
  // South (Telangana/Andhra/Karnataka/Tamil Nadu weaving hubs)
  'pochampally ikat',
  'ikat fabric',
  'kalamkari fabric',
  'gadwal saree',
  'uppada silk',
  'mangalagiri cotton',
  'venkatagiri saree',
  'narayanpet cotton',
  'mysore silk',
  'ilkal saree',
  'sungudi saree',
  'Arni silk',
  // East (Bengal/Odisha/Bihar handloom belt)
  'tant saree',
  'jamdani saree',
  'baluchari saree',
  'sambalpuri saree',
  'bomkai saree',
  'bhagalpuri silk',
  'shantipur handloom',
  // ── FESTIVAL / occasion demand (researched 2026-07-02): the trade's biggest
  // seasonal search spikes. Real wholesale-catalogue category names (Surat
  // Navratri chaniya-choli trade, rakhi/diwali/karwa-chauth/eid festive drops,
  // wedding-season bridal). Extend per season only with terms buyers type.
  'navratri chaniya choli',
  'chaniya choli wholesale',
  'garba dress',
  'dandiya dress',
  'navratri collection',
  'rakshabandhan special dress',
  'rakhi special saree',
  'diwali saree collection',
  'diwali collection',
  'karwa chauth saree',
  'eid collection',
  'eid special suit',
  'wedding season saree',
  'bridal lehenga',
  'wedding lehenga wholesale',
  'festive wear wholesale',
  'party wear saree',
  // Hand-work + component terms the trade types but not yet listed above
  'hand embroidery',
  'thread work',
  'kasab zari',
  'adda work',
  // Connect service segments now in the marketplace (chain-expansion suppliers):
  // machine service, catalogue photography, stitching + finishing services.
  'embroidery machine repair',
  'embroidery machine service',
  'saree catalogue photography',
  'blouse stitching',
  'saree falls and pico',
  // Discovery / verified-supplier intent — Connect's network + trust differentiator
  'verified textile suppliers',
  'textile suppliers directory',
  // ── ECOSYSTEM personas who build a Connect page/portfolio (researched
  // 2026-07-02, mirrors the category set B2B directories like TextileInfomedia/
  // IndiaMART list). "X manufacturer" is how buyers find them; the portfolio/
  // studio terms are how designers + boutiques present themselves.
  'textile manufacturer',
  'garment manufacturer',
  'ethnic wear manufacturer',
  'saree manufacturer',
  'kurti manufacturer',
  'lehenga manufacturer',
  'dress material manufacturer',
  'garment factory',
  'textile mill',
  'embroidery unit',
  'tailoring shop',
  'boutique',
  'designer boutique',
  'fashion designer portfolio',
  'textile designer portfolio',
  'freelance fashion designer',
  'textile design studio',
  'textile business networking',
  'saree job work',
  'karigar required',
  // ── How LOCALS actually search (researched 2026-06-28): voice + "near me" is
  // ~46% local-intent and Hindi voice queries are up 400% since 2020, so the trade
  // searches in longer, Hinglish, location- and catalogue-led phrases. Kept
  // ROMANIZED (the schema's "always English" rule) — native-script variants would
  // need that rule relaxed first. Each is a real, high-volume trade query.
  // Surat-hub long-tails (the hub for this trade)
  'Surat embroidery job work',
  'Surat dress material wholesale',
  'Surat saree wholesale market',
  'Surat catalogue manufacturer',
  // Catalogue / wholesale B2B vocabulary (how buyers ask for bulk ranges)
  'saree catalogue wholesale',
  'salwar suit catalogue',
  'dress material wholesale',
  'kurti wholesale',
  'catalogue manufacturer',
  // Worker / role searches the way the trade types them
  'silai karigar',
  'embroidery karigar',
  'silai job work',
  'stitching job work',
  'karigar chahiye',
  // Voice + "near me" local intent
  'embroidery work near me',
  'saree wholesaler near me',
  'textile market near me',
  'tailor near me',
  // Surat market names buyers search by (Ring Road wholesale belt; researched
  // 2026-07-02 — these market-name queries drive the "where to buy in Surat" traffic)
  'Bombay Market Surat',
  'Millennium Textile Market Surat',
  'Ring Road Surat textile market',
  // Price / rate intent (the highest-volume commercial queries in this trade)
  'saree wholesale price list',
  'Surat saree wholesale price',
  'catalogue saree price',
  'fabric price per meter',
  // Business-starter intent (huge how-to search volume: home resellers +
  // first-time traders are exactly who joins Connect)
  'saree business from home',
  'online saree business',
  'saree reselling business',
  'how to start textile business',
  'textile business app',
  // ── JOBS / designations across the textile value chain — the jobs board's core
  // demand, and a high-volume search surface (Naukri/Indeed/WorkIndia/KarigarZone).
  // Researched 2026-06-28; real, distinct designations the trade hires + searches
  // for. The role group above was thin (~25); this fills the major gaps by stage.
  // Embroidery-unit jobs
  'embroidery machine operator',
  'multi-needle operator',
  'embroidery helper',
  'embroidery supervisor',
  'punching designer',
  'embroidery puncher',
  'thread cutting karigar',
  'aari karigar',
  'zardozi karigar',
  'adda karigar',
  'hand embroidery worker',
  // Sewing / garment-floor jobs
  'sewing machine operator',
  'single needle operator',
  'overlock operator',
  'flatlock operator',
  'interlock operator',
  'kaaj button operator',
  'sampling tailor',
  'master tailor',
  'fabric cutter',
  'marker master',
  'line supervisor',
  'finishing operator',
  'garment checker',
  'packing helper',
  // Spinning / weaving / knitting mill jobs
  'spinning master',
  'ring frame operator',
  'doffer',
  'autoconer operator',
  'winder operator',
  'warping master',
  'sizing master',
  'loom operator',
  'weaving master',
  'jobber supervisor',
  'knitting master',
  'circular knitting operator',
  // Processing / dyeing / printing jobs
  'colour matching master',
  'lab technician',
  'stenter operator',
  'jigger operator',
  'printing master',
  'screen printing operator',
  'rotary printing operator',
  'table printer',
  // Production / QC / merchandising jobs
  'production supervisor',
  'floor incharge',
  'quality controller',
  'fabric inspector',
  'sampling master',
  'industrial engineer',
  // Sales / support / office jobs textile firms hire for
  'counter salesman',
  'sales executive',
  'store keeper',
  'accountant',
  'packing master',
  // Surat worker vernacular (employment classifieds)
  'pagardar',
  'helper karigar',
  'job worker',
].join(', ');

const ORGANIZATION = {
  '@type': 'Organization',
  '@id': `${BASE}/#organization`,
  name: 'ManekHR',
  url: BASE,
  logo: `${BASE}/icon-512.png`,
  description:
    "ManekHR is a free B2B network, marketplace, and jobs platform for India's textile trade, with ERP tools (attendance, payroll, GST billing, production) underneath.",
  keywords: SITE_KEYWORDS,
  address: { '@type': 'PostalAddress', addressCountry: 'IN' },
  // contactPoint completes the brand entity for the SERP knowledge panel. Email is
  // the single support mailbox (lib/env.supportEmail, same source as content.ts
  // CONTACT_EMAIL); areaServed IN matches the India-only address above. Keep the
  // email in sync with content.ts.
  contactPoint: {
    '@type': 'ContactPoint',
    email: env.supportEmail,
    contactType: 'customer support',
    areaServed: 'IN',
    availableLanguage: ['en', 'gu', 'hi'],
  },
  // sameAs ties this entity to its official profiles so search + answer engines
  // resolve "ManekHR" to one knowledge-graph node. Only real, owned profiles —
  // the WhatsApp link is a placeholder number, so it is deliberately excluded.
  // The Instagram handle MUST match the real account in content.ts SOCIAL_LINKS
  // (manekhrapp); a wrong handle here points at a non-existent profile and splits
  // the brand entity, which is a direct cause of AI engines citing Instagram over
  // the site. Keep both handles in sync with content.ts.
  sameAs: [
    'https://www.linkedin.com/company/manekhr',
    'https://www.instagram.com/manekhrapp',
    // Wikidata entity (Q140377775) - the authoritative node Google's Knowledge
    // Graph + AI engines resolve "ManekHR" against; keep in sync with the
    // official-website (P856) statement on the Wikidata item (must point back here).
    'https://www.wikidata.org/wiki/Q140377775',
    // Crunchbase profile - a trusted source AI engines sample for company info.
    'https://www.crunchbase.com/organization/manekhr',
  ],
};

/** Home page graph: Organization + WebSite + SoftwareApplication. */
export function homeJsonLd() {
  return {
    '@context': 'https://schema.org',
    '@graph': [
      ORGANIZATION,
      {
        '@type': 'WebSite',
        '@id': `${BASE}/#website`,
        name: 'ManekHR',
        url: BASE,
        keywords: SITE_KEYWORDS,
        publisher: { '@id': `${BASE}/#organization` },
        // SearchAction makes the site eligible for a Google sitelinks search box.
        // Target is the real Connect federated-search route (q= param, see
        // features/connect/search/url-params.ts). Keep the path + param in sync if
        // search ever moves.
        potentialAction: {
          '@type': 'SearchAction',
          target: {
            '@type': 'EntryPoint',
            urlTemplate: `${BASE}/connect/search?q={search_term_string}`,
          },
          'query-input': 'required name=search_term_string',
        },
      },
      {
        '@type': 'SoftwareApplication',
        name: 'ManekHR',
        applicationCategory: 'BusinessApplication',
        operatingSystem: 'Web, iOS, Android',
        url: BASE,
        offers: { '@type': 'Offer', price: '0', priceCurrency: 'INR' },
        publisher: { '@id': `${BASE}/#organization` },
      },
    ],
  };
}

/**
 * SoftwareApplication for a specific product page (e.g. /connect). We use
 * SoftwareApplication (not Product) deliberately: Connect is a free web/mobile
 * application — a network + marketplace tool — not a single priced SKU. The free
 * tier is modelled with a 0 INR Offer.
 */
export function softwareAppJsonLd(opts: { name: string; path: string; description: string }) {
  return {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: opts.name,
    applicationCategory: 'BusinessApplication',
    operatingSystem: 'Web, iOS, Android',
    url: `${BASE}${opts.path}`,
    description: opts.description,
    keywords: SITE_KEYWORDS,
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'INR' },
    publisher: { '@id': `${BASE}/#organization` },
  };
}

/**
 * Pricing structured data for /pricing: ManekHR ERP modelled as a
 * SoftwareApplication whose `offers` is an AggregateOffer carrying the REAL plan
 * prices (one nested Offer per plan). This is what lets search + answer/generative
 * engines read and quote the actual prices ("Starter is ₹999/month") instead of
 * guessing. Built from the SAME live plans the cards render, so it never drifts.
 *
 * `monthlyPrice` is the per-month figure shown on the card (rupees; 0 = Free).
 * Returns null when no plans are available (DB hiccup) so we never publish empty
 * or fake pricing. Plan names are English (the schema is never localized).
 */
export function erpPricingJsonLd(plans: { name: string; monthlyPrice: number }[]) {
  if (plans.length === 0) return null;
  const prices = plans.map((p) => p.monthlyPrice);
  return {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: 'ManekHR ERP',
    applicationCategory: 'BusinessApplication',
    operatingSystem: 'Web, iOS, Android',
    url: `${BASE}/pricing`,
    description:
      'Attendance, payroll, machines, and production for textile factories and shops. GST-ready, free to start.',
    keywords: SITE_KEYWORDS,
    publisher: { '@id': `${BASE}/#organization` },
    offers: {
      '@type': 'AggregateOffer',
      priceCurrency: 'INR',
      lowPrice: Math.min(...prices),
      highPrice: Math.max(...prices),
      offerCount: plans.length,
      offers: plans.map((p) => ({
        '@type': 'Offer',
        name: `${p.name} plan`,
        url: `${BASE}/pricing`,
        // UnitPriceSpecification makes the per-MONTH unit explicit (the plan is a
        // 1-year term billed in monthly parts), so engines say "₹X/month".
        priceSpecification: {
          '@type': 'UnitPriceSpecification',
          price: p.monthlyPrice,
          priceCurrency: 'INR',
          unitCode: 'MON',
        },
      })),
    },
  };
}

/**
 * FAQPage built from the page's VISIBLE questions/answers (pass English copy).
 * The answers should be self-contained statements an answer engine can quote.
 */
export function faqPageJsonLd(items: { q: string; a: string }[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: items.map((item) => ({
      '@type': 'Question',
      name: item.q,
      acceptedAnswer: { '@type': 'Answer', text: item.a },
    })),
  };
}

/**
 * CollectionPage + ItemList for a directory landing page (textile services /
 * marketplace / jobs). Emits the page's VISIBLE category labels as an ordered
 * schema.org ItemList so search + answer/generative engines read the directory's
 * taxonomy (each entry a positioned ListItem). Pass the already-translated names
 * the page renders so the schema matches what users see; mirrors the
 * faqPageJsonLd contract (caller resolves the i18n, this builder is pure).
 *
 * Cross-module links: wired into app/(marketing)/textile-services,
 * /textile-marketplace, /textile-jobs alongside their breadcrumb + FAQ JSON-LD.
 * Keep one ItemList per page (do not also emit a second list builder there).
 */
export function itemListJsonLd(opts: { name: string; path: string; items: string[] }) {
  return {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    url: `${BASE}${opts.path}`,
    name: opts.name,
    mainEntity: {
      '@type': 'ItemList',
      name: opts.name,
      numberOfItems: opts.items.length,
      itemListElement: opts.items.map((name, index) => ({
        '@type': 'ListItem',
        position: index + 1,
        name,
      })),
    },
  };
}

/** Breadcrumb trail for a marketing sub-page. */
export function breadcrumbJsonLd(items: { name: string; path: string }[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: `${BASE}${item.path}`,
    })),
  };
}
