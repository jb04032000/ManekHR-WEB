/**
 * Guide / knowledge content for the marketing `/guides` section.
 *
 * These are long-form, genuinely useful articles (not keyword landing pages) that
 * target informational + AI-answer-engine (AEO/GEO) queries the textile trade
 * searches. Content is ENGLISH-only on purpose: these are definitional/how-to
 * queries searched in English, and English is where the AEO value is. The page
 * CHROME (navbar/footer) still localizes; only the article body is English data.
 *
 * Each guide renders via app/(marketing)/guides/[slug]/page.tsx with Article +
 * FAQPage + Breadcrumb JSON-LD. Keep facts honest and non-promotional; price
 * ranges are indicative and flagged as such (they move with the market).
 */

export interface GuideSection {
  heading: string;
  /** Paragraphs. Rendered as plain <p> blocks. */
  body: string[];
}

export interface GuideFaq {
  q: string;
  a: string;
}

export interface Guide {
  slug: string;
  badge: string;
  title: string;
  metaTitle: string;
  description: string;
  /** ISO date used for Article dateModified. */
  updated: string;
  intro: string;
  sections: GuideSection[];
  faq: GuideFaq[];
  /** A relevant in-app/landing link shown as the article CTA. */
  cta: { label: string; href: string };
}

export const GUIDES: Guide[] = [
  {
    slug: 'embroidery-machine-buying-guide',
    badge: 'Embroidery machines',
    title: 'Embroidery machine buying guide for India',
    metaTitle: 'Embroidery machine buying guide for India (2026) — ManekHR',
    description:
      'How to choose a computerized embroidery machine in India: single-head vs multi-head, how many heads you need, the specs that matter, top brands, new vs pre-owned, and indicative price ranges.',
    updated: '2026-06-29',
    intro:
      'A computerized embroidery machine is the biggest single investment most embroidery units make. This guide explains the choices in plain terms — machine type, heads, the specs that actually matter, the main brands sold in India, and how to think about new versus pre-owned — so you can buy the right machine for your work, not the most expensive one.',
    sections: [
      {
        heading: 'Single-head vs multi-head',
        body: [
          'A single-head machine stitches one design at a time and suits sampling, small custom orders, caps, and low-volume job-work. A multi-head machine has several embroidery heads running the same design in parallel, so a 15-head machine effectively produces 15 pieces at once — the workhorse of bulk saree and dress-material job-work in Surat.',
          'If your business is bulk per-metre or per-piece job-work, multi-head is the only economical choice. If you do bridal sampling, monogramming, or short premium runs, a single-head (or a smaller multi-head) is more flexible.',
        ],
      },
      {
        heading: 'How many heads do you need',
        body: [
          'More heads mean more output but higher cost, more floor space, more power, and more operators to keep them fed. A common starting point for a new bulk unit is a 9-head or 12-head machine; established units run 15-head and higher, often several machines.',
          'Match heads to your committed order book, not your ambition. An idle 24-head machine loses money faster than a busy 9-head one. Many units start smaller and add machines as steady orders grow.',
        ],
      },
      {
        heading: 'The specs that actually matter',
        body: [
          'Number of needles per head (commonly 9, 12, or 15) decides how many thread colours you can run without manual changes — important for dense, multi-colour zari and sequin work.',
          'Embroidery area (field size) limits the largest single design per hoop; saree pallu and lehenga panels need a generous area. Maximum speed (stitches per minute) affects throughput but real-world speed drops on dense designs.',
          'Attachments matter for this trade: a sequin device (single or twin), cording/taping for dabka-style work, and a boring/cutwork device expand what you can take on. Confirm which are included versus extra.',
        ],
      },
      {
        heading: 'Top brands sold in India',
        body: [
          'Tajima (Japan) and Barudan (Japan) are the premium, long-life machines most large units aspire to; strong resale value and service networks. ZSK (Germany) is premium and known for technical/special applications.',
          'Ricoma, Happy (Japan) and SWF (Korea) sit in the mid-range and are popular with newer and mid-size units for a lower entry price. Several Chinese makers (e.g. Feiya, Maya) compete on price at the entry level.',
          'Brand matters less than the dealer behind it: local installation, operator training, fast service, and genuine spares keep a machine earning. A cheaper machine with no nearby support can cost more over its life.',
        ],
      },
      {
        heading: 'New vs certified pre-owned',
        body: [
          'A new machine brings warranty, the latest features, and predictable uptime — the right call if financing works and you need reliability for committed orders.',
          'A certified pre-owned Tajima or Barudan — serviced, tested, and installed by a reputable dealer — is a sensible entry for a new unit, often at a large discount to new. The risks are hidden wear and weak after-sales; buy only from a dealer who services it and stands behind it.',
        ],
      },
      {
        heading: 'Running costs and support',
        body: [
          'Budget beyond the purchase price: an annual maintenance contract (AMC), genuine spares (hooks, rotary trimmers, needles, tension assemblies), skilled operators, a digitizer/punching designer, thread and backing, and reliable power. A machine is only as productive as the team and supply chain around it.',
          'Before buying, ask the dealer about call-out time, AMC terms, spare availability, and operator training. In peak festive season, fast service is the difference between meeting orders and missing them.',
        ],
      },
      {
        heading: 'Indicative price ranges',
        body: [
          'Prices move with model, heads, needles, attachments, brand, condition, currency, and duty, so treat any figure as indicative and get current quotes. As a rough guide in India: entry-level single-head machines start in the low lakhs; mid-range multi-head machines run several lakhs to low tens of lakhs; premium high-head Tajima/Barudan machines reach much higher. Certified pre-owned premium machines typically sell at a meaningful discount to new.',
          'Always compare landed, installed, trained, and AMC-inclusive prices — not just the sticker — and confirm financing terms.',
        ],
      },
    ],
    faq: [
      {
        q: 'How much does a multi-head embroidery machine cost in India?',
        a: 'It varies widely with heads, needles, brand, attachments and condition, so treat any number as indicative and get current quotes. Mid-range multi-head machines generally run from several lakhs to low tens of lakhs; premium high-head Tajima or Barudan machines cost more, and certified pre-owned machines sell at a discount to new.',
      },
      {
        q: 'Which is better, Tajima or Barudan?',
        a: 'Both are premium Japanese machines with long life and strong resale value, and either is an excellent choice. The bigger decision is the dealer and service behind the machine — installation, operator training, fast call-out, and genuine spares matter more day to day than the brand name.',
      },
      {
        q: 'How many heads should a new unit start with?',
        a: 'Match heads to your committed orders. Many new bulk units start with a 9-head or 12-head machine and add capacity as steady orders grow, rather than buying a large machine that may sit idle.',
      },
      {
        q: 'Should I buy a used embroidery machine?',
        a: 'A certified pre-owned machine from a reputable dealer — serviced, tested, installed and supported — can be a smart, lower-cost entry. Avoid private sales with no service backing; hidden wear and weak after-sales can erase the saving.',
      },
    ],
    cta: { label: 'Find machine dealers and embroidery units', href: '/zari-manufacturers' },
  },
  {
    slug: 'embroidery-terms-glossary',
    badge: 'Glossary',
    title: 'Embroidery terms glossary: zari, cutdana, sitara and more',
    metaTitle: 'Embroidery terms glossary — zari, cutdana, sitara & more | ManekHR',
    description:
      'Plain-English meanings of common Surat and Indian embroidery terms: zari, kasab, cutdana, moti, sitara, sequins, aari, zardozi, dabka, gota patti, mukaish, schiffli, punching and more.',
    updated: '2026-06-29',
    intro:
      'The textile and embroidery trade has its own vocabulary, mixing Gujarati, Hindi and English. Here are the terms buyers, karigars and units use most, explained simply — the materials and components, the hand and machine techniques, and the trade roles.',
    sections: [
      {
        heading: 'Zari',
        body: [
          'Metallic thread — traditionally real gold or silver, today mostly imitation (metallised polyester) — used for shimmering embroidery and borders. Surat is a major centre for zari.',
        ],
      },
      {
        heading: 'Kasab (kalabattu)',
        body: [
          'The metallic zari wire or thread twisted onto a silk or cotton core. "Kasab" and "kalabattu" are commonly used for zari thread sold to embroidery units.',
        ],
      },
      {
        heading: 'Cutdana',
        body: [
          'Small cut beads (often glass or metallic) used in hand and machine embroidery to add texture and sparkle, frequently combined with moti and sitara on bridal pieces.',
        ],
      },
      {
        heading: 'Moti',
        body: ['Beads or pearls used in embroidery — "moti work" refers to bead embellishment.'],
      },
      {
        heading: 'Sitara',
        body: [
          'A small, usually star-shaped metal or plastic sequin that catches light; widely used in floral and festive designs.',
        ],
      },
      {
        heading: 'Sequins',
        body: [
          'Flat shiny discs applied by hand or by a sequin device on a machine. Machine sequin work uses a sequin attachment fed in sequence with the embroidery.',
        ],
      },
      {
        heading: 'Aari',
        body: [
          'A hooked-needle hand-embroidery technique that pulls thread up through the fabric in fast chain stitches. When worked with gold/silver thread, beads and stones it shades into zardozi.',
        ],
      },
      {
        heading: 'Zardozi',
        body: [
          'Rich metallic hand embroidery using zari, dabka, beads and stones — among the most premium and time-intensive techniques, used on bridal and occasion wear.',
        ],
      },
      {
        heading: 'Dabka',
        body: [
          'A fine, springy coiled metallic wire couched onto fabric for outlines and raised effects in zardozi and aari work.',
        ],
      },
      {
        heading: 'Gota / gota patti',
        body: [
          'Flat gold or silver ribbon/lace appliquéd onto fabric. Gota patti, associated with Rajasthan, stitches small gota shapes into floral patterns.',
        ],
      },
      {
        heading: 'Mukaish',
        body: ['Fine metallic dot-work where tiny metal pieces are twisted into the fabric.'],
      },
      {
        heading: 'Sheesha (mirror work)',
        body: [
          'Small mirrors stitched into the fabric — bright, traditional Gujarati/Kutch embellishment.',
        ],
      },
      {
        heading: 'Adda',
        body: [
          'The wooden frame on which fabric is stretched for hand embroidery; "adda work" means frame-based hand embroidery (zardozi, dabka, moti), often done by a group of karigars.',
        ],
      },
      {
        heading: 'Schiffli',
        body: [
          'A type of multi-needle embroidery machine and the dense all-over embroidery it produces, common on dress material.',
        ],
      },
      {
        heading: 'Multi-head machine',
        body: [
          'A computerized embroidery machine with several heads stitching the same design in parallel for bulk output — the backbone of Surat job-work.',
        ],
      },
      {
        heading: 'Punching (digitizing)',
        body: [
          'Converting artwork into a machine-readable embroidery file (stitches, sequence, colours) using software such as Wilcom. The person who does this is a punching designer or digitizer.',
        ],
      },
      {
        heading: 'Job-work',
        body: [
          'Doing embroidery (or another process) on a customer’s fabric for a per-metre or per-piece rate, rather than selling a finished product. The dominant model in Surat embroidery.',
        ],
      },
      {
        heading: 'Karigar',
        body: [
          'A skilled worker/artisan — e.g. an embroidery karigar, machine operator, or hand-work specialist.',
        ],
      },
      {
        heading: 'Thekedar',
        body: [
          'A job-work contractor who takes bulk work and runs it through karigar groups, and/or supplies trained karigars to units.',
        ],
      },
      {
        heading: 'Falls and pico',
        body: [
          'Finishing services on a saree: "falls" is a fabric strip stitched to the lower border for weight and protection; "pico" is a fine rolled-edge finish.',
        ],
      },
    ],
    faq: [
      {
        q: 'What is the difference between zari and kasab?',
        a: 'Zari is the metallic thread itself (gold, silver or imitation). Kasab (kalabattu) refers to that metallic wire/thread twisted onto a silk or cotton core — in the trade the terms are often used interchangeably for zari thread.',
      },
      {
        q: 'What is the difference between aari and zardozi?',
        a: 'Aari is a hooked-needle chain-stitch technique. When aari (or hand) work is built up with gold/silver thread, dabka, beads and stones, it becomes zardozi — the richer, more metallic, more time-intensive style.',
      },
      {
        q: 'What is cutdana?',
        a: 'Cutdana are small cut beads used in embroidery to add texture and sparkle, often combined with moti (beads/pearls) and sitara (sequins) on bridal and festive pieces.',
      },
    ],
    cta: { label: 'Browse embroidery and zari work', href: '/embroidery-job-work' },
  },
  {
    slug: 'saree-fabric-guide',
    badge: 'Fabric guides',
    title: 'Saree fabric guide: georgette, organza, chiffon and GSM',
    metaTitle: 'Saree fabric guide — georgette, organza, chiffon & GSM | ManekHR',
    description:
      'A buyer’s guide to common saree and dress-material fabrics — georgette, organza, chiffon, crepe, satin and silk — plus what GSM means and how to pick fabric for embroidery.',
    updated: '2026-06-29',
    intro:
      'Choosing the right base fabric decides how a saree drapes, how embroidery sits on it, and how it sells. Here is a plain guide to the fabrics the trade uses most, what GSM means, and how to match fabric to the work.',
    sections: [
      {
        heading: 'Georgette',
        body: [
          'A lightweight, slightly crinkled fabric with a soft, flowing drape and a matte finish. Georgette is the workhorse of the festive saree trade — it takes embroidery well, hides minor flaws, and travels light. It is the default base for much Surat embroidery and dress material.',
        ],
      },
      {
        heading: 'Organza',
        body: [
          'A sheer, crisp, lightweight fabric with a subtle shine and structure that holds its shape. Organza is on-trend for lighter festive and bridal looks; thread, sequin and cutwork sit beautifully on it, but it shows stitching, so clean work matters.',
        ],
      },
      {
        heading: 'Chiffon',
        body: [
          'Very light, sheer and floaty with a soft drape. Chiffon suits flowing, elegant sarees and lighter embellishment; being delicate, it needs careful handling during embroidery and finishing.',
        ],
      },
      {
        heading: 'Crepe',
        body: [
          'A fabric with a slightly grainy texture and good, fluid drape that does not crease easily. Crepe is popular for both printed and embroidered sarees and for dress material.',
        ],
      },
      {
        heading: 'Satin',
        body: [
          'A smooth fabric with a glossy face and matte back, giving a rich sheen. Used where a luxurious, reflective look is wanted; heavier satins suit structured pieces.',
        ],
      },
      {
        heading: 'Silk and blends',
        body: [
          'Pure silk gives a premium hand and natural sheen at a higher price; art silk and silk blends mimic the look more affordably. Blends (e.g. silk-georgette) aim to balance drape, shine and cost.',
        ],
      },
      {
        heading: 'What is GSM?',
        body: [
          'GSM (grams per square metre) measures fabric weight: higher GSM is heavier/denser, lower GSM is lighter/sheerer. Lightweight festive sarees use low-GSM georgette and organza; structured or winter pieces use higher GSM. GSM is a quick way to compare two lots of the "same" fabric — ask for it when sourcing.',
        ],
      },
      {
        heading: 'Choosing fabric for embroidery',
        body: [
          'Match the base to the work: dense zari, cutdana and sequin work needs a fabric that can carry weight without sagging (georgette, crepe, structured organza). Very sheer fabrics (chiffon, soft organza) suit lighter thread and sequin work. Always run a small sample before a bulk order to check how the design sits, how the fabric handles the hoop, and how it finishes.',
        ],
      },
    ],
    faq: [
      {
        q: 'Which fabric is best for embroidery work?',
        a: 'Georgette is the most popular all-round base — it takes embroidery well and drapes nicely. For heavier zari and bead work, choose a fabric that carries weight (georgette, crepe, structured organza); for light, sheer looks, chiffon and soft organza suit lighter work. Always sample first.',
      },
      {
        q: 'What does GSM mean in fabric?',
        a: 'GSM is grams per square metre — a measure of fabric weight. Higher GSM is heavier and denser; lower GSM is lighter and more sheer. It is a quick way to compare two lots of the same fabric type.',
      },
      {
        q: 'What is the difference between georgette and organza?',
        a: 'Georgette is soft, matte and flowing with a crinkled texture; organza is crisp, sheer and slightly shiny with structure that holds its shape. Georgette hides stitching better, while organza shows clean work and gives a lighter, more structured look.',
      },
    ],
    cta: { label: 'Find fabric suppliers', href: '/fabric-suppliers' },
  },
  {
    slug: 'how-to-start-embroidery-business',
    badge: 'Business',
    title: 'How to start an embroidery business in Surat',
    metaTitle: 'How to start an embroidery business in Surat (2026) — ManekHR',
    description:
      'A practical guide to starting a computerized embroidery unit in Surat: choosing your model, machine and space, the team you need, costs to plan for, and how to get your first job-work orders.',
    updated: '2026-06-29',
    intro:
      'Surat has the suppliers, machines, karigars and buyers to start an embroidery unit faster than almost anywhere. This guide walks through the real decisions — what to make, the machine and space, the team, the costs, and how to win your first orders.',
    sections: [
      {
        heading: 'Decide your model first',
        body: [
          'Most Surat units do job-work: embroidery on a customer’s fabric for a per-metre or per-piece rate. It needs less working capital than buying fabric and selling finished sarees, and orders come from traders and thekedars. Selling your own finished products earns more per piece but needs design, fabric, stock and a way to sell.',
          'Pick one to start. Job-work is the lower-risk entry for a new unit; you can add finished products later once you have cash flow and buyers.',
        ],
      },
      {
        heading: 'Machine and space',
        body: [
          'The machine is your biggest decision and cost — see our embroidery machine buying guide for heads, needles, brands and new-vs-pre-owned. A bulk job-work unit usually starts with a 9-head or 12-head multi-head machine.',
          'Plan for space (machines, fabric, finished goods), three-phase power and a stable supply, good light, and room for loading. A cramped floor slows output and damages goods.',
        ],
      },
      {
        heading: 'The team you need',
        body: [
          'A working unit needs trained machine operators, a punching designer (digitizer) — in-house or freelance — to prepare files, helpers to load and assist, and a checking/finishing person so returns stay low. Hiring is the constant challenge; recruiters and thekedars in Surat help fill seats, especially before festive season.',
        ],
      },
      {
        heading: 'Costs to plan for',
        body: [
          'Beyond the machine: installation and training, an AMC and genuine spares, thread and backing, rent, power, salaries, and working capital to run before payments come in. Many new owners underestimate working capital — orders pay after delivery, but wages and power do not wait.',
          'Get current, all-inclusive quotes (landed, installed, trained, AMC) before committing, and confirm financing terms.',
        ],
      },
      {
        heading: 'Getting your first orders',
        body: [
          'Early orders come from traders, thekedars and other units that overflow work, plus sampling for buyers who want to test you. Keep a clean WhatsApp catalogue of your work, deliver a sample run before bulk, and be reliable on time and finishing — that reputation is what brings repeat orders.',
          'Listing your unit and work where buyers and traders already look — a verified profile, storefront and the marketplace — makes you discoverable beyond your existing contacts.',
        ],
      },
      {
        heading: 'Compliance basics',
        body: [
          'Get your billing and GST set up early — correct HSN codes, timely returns, and e-way bills for moving fabric (including job-work fabric). Clean compliance keeps your buyers’ input-tax-credit flowing and avoids festive-season penalties. See our GST guide, and consider a CA for setup.',
        ],
      },
    ],
    faq: [
      {
        q: 'How much does it cost to start an embroidery unit?',
        a: 'The machine is the largest cost and varies widely with heads, brand and condition, so get current quotes. On top of that, budget for installation, an AMC and spares, thread and backing, rent, power, salaries and working capital to run before payments arrive. Many units start smaller and grow.',
      },
      {
        q: 'Is job-work or selling own products better to start?',
        a: 'Job-work — embroidery on a customer’s fabric for a per-metre or per-piece rate — usually needs less working capital and is the lower-risk entry for a new unit. Selling finished products earns more per piece but needs design, fabric, stock and a sales channel.',
      },
      {
        q: 'How do I get embroidery job-work orders?',
        a: 'Early orders come from traders, thekedars and units overflowing work, plus sampling for new buyers. Keep a clean WhatsApp catalogue, deliver a sample before bulk, be reliable on time and finishing, and list your unit where buyers already look so you are discoverable.',
      },
    ],
    cta: { label: 'Find work and buyers on ManekHR', href: '/textile-marketplace' },
  },
  {
    slug: 'gst-on-sarees-textiles',
    badge: 'GST & compliance',
    title: 'GST on sarees and textiles: rates, HSN codes and e-way bills',
    metaTitle: 'GST on sarees & textiles — rates, HSN codes, e-way bill | ManekHR',
    description:
      'A plain guide to GST for the textile trade: how saree GST rates and HSN codes work by fabric, and when you need an e-way bill or e-invoice. General information — confirm current rules with a CA.',
    updated: '2026-06-29',
    intro:
      'GST on textiles confuses many small units and traders. This is a plain-English overview of how rates and HSN codes work, and when e-way bills and e-invoices apply. It is general information, not tax advice — rates and thresholds change, so confirm the current position with a qualified CA or the official GST portal.',
    sections: [
      {
        heading: 'How GST on sarees works',
        body: [
          'There is no single GST rate or HSN code for "sarees" — the law treats them by the fabric they are made of. Broadly, most everyday cotton, silk and man-made sarees fall in the lower 5% slab, while some premium or higher-value pieces can attract 18%. Rates have changed before and can change again, so always check the current notification.',
        ],
      },
      {
        heading: 'HSN codes by fabric',
        body: [
          'HSN codes follow the fabric and how the cloth is made: silk sarees fall under chapter 50 (e.g. 5007), cotton sarees under chapter 52 (e.g. 5208), and man-made or synthetic-fibre sarees under chapters 54–55. Pick the code that matches your actual fabric — using the wrong HSN can cause mismatches and block your buyer’s input-tax-credit.',
        ],
      },
      {
        heading: 'E-way bill',
        body: [
          'An e-way bill is required for moving goods above a notified value, and it applies to job-work fabric going out for embroidery too, not just finished-goods sales. Generate it before the vehicle moves — most penalties are timing mistakes, not tax. Keep the document with the consignment.',
        ],
      },
      {
        heading: 'E-invoice (IRN and QR)',
        body: [
          'E-invoicing is mandatory once your turnover crosses the notified threshold. Your billing software must generate a valid Invoice Reference Number (IRN) and QR code through the official portal, or your buyers can lose their credit. Set this up before a festive billing peak, not during it.',
        ],
      },
      {
        heading: 'Keep your ITC clean',
        body: [
          'File returns on time, use the correct HSN, and raise e-way bills properly. Late filing, wrong codes or missing e-way bills are the common reasons a buyer’s input-tax-credit gets stuck — and that is what loses you repeat business. A CA or GST consultant can set up clean billing once so the festive rush stays smooth.',
        ],
      },
    ],
    faq: [
      {
        q: 'What is the GST rate on sarees?',
        a: 'It depends on the fabric and value. Most everyday cotton, silk and man-made sarees fall in the 5% slab, while some premium or higher-value pieces can attract 18%. Rates change over time, so confirm the current notification with a CA or the official GST portal.',
      },
      {
        q: 'What is the HSN code for sarees?',
        a: 'There is no single code. HSN follows the fabric: silk sarees under chapter 50 (e.g. 5007), cotton under chapter 52 (e.g. 5208), and man-made/synthetic under chapters 54–55. Use the code that matches your actual fabric.',
      },
      {
        q: 'When is an e-way bill required?',
        a: 'When moving goods above the notified value — including job-work fabric sent out for embroidery, not just finished-goods sales. Generate it before the vehicle moves and keep it with the consignment.',
      },
    ],
    cta: { label: 'Find a CA or GST consultant', href: '/textile-services' },
  },
  {
    slug: 'embroidery-digitizing-punching',
    badge: 'Embroidery',
    title: 'Embroidery digitizing (punching) basics',
    metaTitle: 'Embroidery digitizing (punching) basics — Wilcom & stitch types | ManekHR',
    description:
      'What embroidery digitizing or "punching" is, the main stitch types (run, satin, fill, underlay), why stitch sequencing matters, the software used (Wilcom), and how to work with a punching designer.',
    updated: '2026-06-29',
    intro:
      'Every machine embroidery design starts as a digitized file. "Digitizing" — still called "punching" in the trade — turns artwork into the stitches, sequence and colours a machine follows. Good punching saves real production time and money; poor punching causes thread breaks, puckering and slow runs.',
    sections: [
      {
        heading: 'What is digitizing (punching)?',
        body: [
          'Digitizing is converting an image or sketch into a machine-readable embroidery file that tells the machine where to stitch, in what order, and in which colours. The word "punching" comes from the old days when designs were punched into paper tape that fed the machine; today it is done in software.',
        ],
      },
      {
        heading: 'The main stitch types',
        body: [
          'Run stitches are single lines for fine details and outlines. Satin stitches give smooth, raised borders and lettering. Fill stitches cover large solid areas. Underlay stitches go down first to stabilise the fabric and stop distortion. A good design uses the right stitch for each part.',
        ],
      },
      {
        heading: 'Why sequencing matters',
        body: [
          'The order of stitching and colour changes decides quality and speed. Outlining before filling, minimising jumps, and planning colour and sequin sequence so the machine runs without stopping for thread changes all cut production time and give cleaner fills. On bulk job-work, a well-sequenced file run across many heads saves hours.',
        ],
      },
      {
        heading: 'The software',
        body: [
          'Wilcom is the industry-standard embroidery digitizing software, with manual and automatic tools to set stitch types, directions, densities and underlay. Other tools exist, but Wilcom is what most Surat punching designers use.',
        ],
      },
      {
        heading: 'Working with a punching designer',
        body: [
          'Give the digitizer clear artwork, the fabric type, and the exact size and placement. Always run a sample before bulk to check density, pull and finish on your actual fabric. A small fee for good punching pays back many times over in faster, cleaner production.',
        ],
      },
    ],
    faq: [
      {
        q: 'What is punching in embroidery?',
        a: 'Punching is the trade term for digitizing — converting artwork into a machine-readable embroidery file that defines the stitches, their sequence and the colours. The name comes from the old paper-tape machines.',
      },
      {
        q: 'What software is used for embroidery digitizing?',
        a: 'Wilcom is the industry-standard software most professional and Surat punching designers use, with tools to set stitch types, directions, densities and underlay. Other digitizing tools exist but Wilcom is the most common.',
      },
      {
        q: 'Why does good digitizing matter?',
        a: 'A well-digitized file uses the right stitch types, underlay and sequence, so the machine runs faster with fewer thread breaks and cleaner fills. Poor digitizing causes puckering, breaks and slow runs — costly on bulk job-work.',
      },
    ],
    cta: { label: 'Find a punching designer', href: '/embroidery-job-work' },
  },
  {
    slug: 'aari-vs-zardozi',
    badge: 'Techniques',
    title: 'Aari vs zardozi embroidery: what is the difference?',
    metaTitle: 'Aari vs zardozi embroidery — the difference explained | ManekHR',
    description:
      'Aari and zardozi explained simply: aari is a hooked-needle chain-stitch technique; zardozi is rich metallic thread work. How they relate, which is more premium, and when each is used.',
    updated: '2026-06-29',
    intro:
      'Buyers often ask whether aari and zardozi are the same thing. They are related but not identical: aari describes how the work is done, while zardozi describes the rich metallic material. Here is the difference in plain terms.',
    sections: [
      {
        heading: 'Aari work',
        body: [
          'Aari is a technique. The fabric is stretched on a frame and worked with a long hooked needle (the aari) that pulls thread up from below in fast, fine chain stitches. It is quick and versatile, and beads, sequins and stones are often added as the work goes.',
        ],
      },
      {
        heading: 'Zardozi work',
        body: [
          'Zardozi is metallic thread embroidery — gold and silver thread (today usually metallic substitutes), with dabka, beads and stones built up into rich, raised patterns. It is among the most premium and time-intensive styles, used on bridal and occasion wear.',
        ],
      },
      {
        heading: 'How they relate',
        body: [
          'Zardozi refers to the metallic embellishment; aari is the method of stitching. In practice, aari work frequently includes zardozi elements — dabka, moti, sitara — so a single bridal piece can be both "aari work" (technique) and "zardozi" (the metallic richness).',
        ],
      },
      {
        heading: 'Which to choose',
        body: [
          'Choose aari for fast, fine chain work and bead embellishment. Choose zardozi for premium metallic richness and raised, heirloom-quality detail. Bridal pieces often combine both — aari filling with zardozi borders.',
        ],
      },
    ],
    faq: [
      {
        q: 'Is aari the same as zardozi?',
        a: 'No. Aari is a technique — hooked-needle chain stitching on a frame. Zardozi is rich metallic thread work using gold/silver thread, dabka, beads and stones. They overlap, because aari work often includes zardozi elements.',
      },
      {
        q: 'Which is more expensive, aari or zardozi?',
        a: 'Zardozi is generally more expensive because of the metallic materials and the time-intensive, raised hand work. Plain aari chain work is faster and usually costs less.',
      },
      {
        q: 'What is aari work used for?',
        a: 'Aari is used for fine chain-stitch outlines and fills, and for fast bead, sequin and stone embellishment on blouses, lehengas, dupattas and festive wear.',
      },
    ],
    cta: { label: 'Find aari and zardozi karigars', href: '/embroidery-job-work' },
  },
  {
    slug: 'types-of-embroidery-india',
    badge: 'Techniques',
    title: 'Types of embroidery in India: a quick guide',
    metaTitle: 'Types of embroidery in India — aari, zardozi, gota & more | ManekHR',
    description:
      'A quick guide to popular Indian embroidery styles — aari, zardozi, gota patti, chikankari, kantha, kutch mirror work, phulkari, and machine/schiffli embroidery — and what each is known for.',
    updated: '2026-06-29',
    intro:
      'India has dozens of embroidery traditions, each with its own materials, tools and look. Here are the styles you will meet most in the saree and festive-wear trade, in brief.',
    sections: [
      {
        heading: 'Aari',
        body: ['Fast hooked-needle chain stitch on a frame, often with beads and sequins added.'],
      },
      {
        heading: 'Zardozi',
        body: [
          'Rich metallic gold/silver thread work with dabka, beads and stones — premium bridal and occasion wear.',
        ],
      },
      {
        heading: 'Gota patti',
        body: [
          'Flat gold/silver ribbon appliquéd into floral patterns, associated with Rajasthan.',
        ],
      },
      {
        heading: 'Chikankari',
        body: [
          'Delicate white-on-white (and coloured) hand embroidery from Lucknow, known for its fine, airy look.',
        ],
      },
      {
        heading: 'Kantha',
        body: [
          'Running-stitch embroidery from Bengal, traditionally on layered cloth, with simple flowing motifs.',
        ],
      },
      {
        heading: 'Kutch and mirror work',
        body: [
          'Bright Gujarati/Kutch embroidery with bold colours and small mirrors (sheesha) stitched in.',
        ],
      },
      {
        heading: 'Phulkari',
        body: ['Vivid floral thread work from Punjab, traditionally on dupattas and shawls.'],
      },
      {
        heading: 'Machine and schiffli embroidery',
        body: [
          'Computerized multi-head and schiffli machines produce dense, repeatable embroidery at scale — the backbone of bulk saree and dress-material work.',
        ],
      },
    ],
    faq: [
      {
        q: 'What are the main types of embroidery in India?',
        a: 'Popular styles include aari, zardozi, gota patti, chikankari, kantha, kutch mirror work, phulkari, and machine/schiffli embroidery — each with its own region, materials and look.',
      },
      {
        q: 'What is the most expensive embroidery?',
        a: 'Zardozi is generally the most expensive because of its metallic materials and time-intensive hand work; dense gota patti also ranks high. Machine embroidery is the most economical at scale.',
      },
      {
        q: 'What is machine embroidery?',
        a: 'Machine embroidery uses computerized multi-head or schiffli machines to stitch a digitized design repeatably at scale — the basis of bulk saree and dress-material job-work.',
      },
    ],
    cta: { label: 'Browse embroidery work', href: '/embroidery-job-work' },
  },
  {
    slug: 'types-of-sarees',
    badge: 'Sarees',
    title: 'Types of sarees: a quick buyer’s guide',
    metaTitle: 'Types of sarees — a quick buyer’s guide | ManekHR',
    description:
      'A quick guide to popular saree types by fabric and region — georgette, organza, silk, Banarasi, Kanjivaram, Bandhani, cotton and designer embroidered sarees — and what each suits.',
    updated: '2026-06-29',
    intro:
      'Sarees are described both by fabric and by regional weave. Here is a quick orientation to the types you will see most in the wholesale and festive trade, and what each is good for.',
    sections: [
      {
        heading: 'Georgette and organza',
        body: [
          'Lightweight, on-trend festive bases that take embroidery well — georgette is soft and flowing, organza is crisp and sheer.',
        ],
      },
      {
        heading: 'Silk sarees',
        body: [
          'Premium natural sheen and hand; art-silk and blends offer a similar look at lower cost.',
        ],
      },
      {
        heading: 'Banarasi',
        body: [
          'Varanasi silk sarees with intricate gold/silver zari brocade — classic bridal and festive wear.',
        ],
      },
      {
        heading: 'Kanjivaram',
        body: [
          'Heavy South Indian silk sarees from Tamil Nadu with rich zari borders — durable, ceremonial.',
        ],
      },
      {
        heading: 'Bandhani',
        body: [
          'Tie-and-dye sarees from Gujarat and Rajasthan, recognised by their dotted patterns.',
        ],
      },
      {
        heading: 'Cotton and linen',
        body: [
          'Breathable, everyday and summer sarees — increasingly popular for comfort and a natural look.',
        ],
      },
      {
        heading: 'Designer and embroidered',
        body: [
          'Georgette, organza and silk bases worked with zari, sequin, cutdana and thread embroidery for festive and bridal ranges — the heart of the Surat trade.',
        ],
      },
    ],
    faq: [
      {
        q: 'What are the most popular saree types?',
        a: 'By fabric, georgette, organza, silk, cotton and crepe are most common; by regional weave, Banarasi, Kanjivaram and Bandhani are well known. Designer embroidered sarees on georgette and organza dominate the festive trade.',
      },
      {
        q: 'Which saree is best for weddings?',
        a: 'Bridal choices are usually heavy silks and richly embroidered pieces — Banarasi, Kanjivaram, and designer georgette/organza sarees with zardozi, cutdana and zari work.',
      },
      {
        q: 'What is the difference between Banarasi and Kanjivaram?',
        a: 'Banarasi sarees are woven in Varanasi (north India) with fine silk and intricate zari brocade; Kanjivaram sarees are woven in Tamil Nadu (south India) with heavier silk and bold zari borders. Both are classic bridal silks.',
      },
    ],
    cta: { label: 'Find saree wholesalers', href: '/saree-wholesalers' },
  },
];

export function getGuide(slug: string): Guide | undefined {
  return GUIDES.find((g) => g.slug === slug);
}
