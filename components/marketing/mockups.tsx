import type { ReactNode } from 'react';

/**
 * Real fabric-texture photos (P3) used by the swatch tiles across the mocks.
 * Source: Pexels (free for commercial use, no attribution, no identifiable
 * people); single-colour satin crops live in public/marketing/fabrics. Keyed by
 * jewel tone so each mock picks a fabric close to its old gradient colour.
 */
export const FABRIC = {
  magenta: '/marketing/fabrics/fabric-magenta.jpg',
  maroon: '/marketing/fabrics/fabric-maroon.jpg',
  pink: '/marketing/fabrics/fabric-pink.jpg',
  purple: '/marketing/fabrics/fabric-purple.jpg',
  blue: '/marketing/fabrics/fabric-blue.jpg',
  green: '/marketing/fabrics/fabric-green.jpg',
  gold: '/marketing/fabrics/fabric-gold.jpg',
} as const;

/**
 * Real textile PRODUCT photos (owner-supplied, free-to-use) used where a mock
 * carries a literal product label so the tile shows the actual thing, not an
 * abstract swatch. Keyed by product, not colour. Consumed by StorefrontMock
 * (silk saree / cotton lot / zari roll / dress material tiles), MarketplaceHeroMock
 * (Surat Silk House -> saree, Cotton Fabrics Co. -> cotton) and FeedMock (the
 * "Embroidery Unit" post shows its machines). Live in public/marketing/products.
 * Layered OVER the same gradient fallback via <Swatch src>, so a missing file
 * still paints the gradient beneath. Keep filenames in sync with that folder.
 */
export const PRODUCT = {
  saree: '/marketing/products/saree.jpg',
  cotton: '/marketing/products/cotton-lot.jpg',
  zari: '/marketing/products/zari-roll.jpg',
  dressMaterial: '/marketing/products/dress-material.jpg',
  // Owner-supplied embroidery-unit photos. Used by FeedMock (units 1 + 3) and
  // NetworkHeroMock's Embroidery Unit post (units 1, 5, 4).
  embroideryUnit1: '/marketing/products/embroidery-unit-1.jpg',
  embroideryUnit3: '/marketing/products/embroidery-unit-3.jpg',
  embroideryUnit4: '/marketing/products/embroidery-unit-4.jpg',
  embroideryUnit5: '/marketing/products/embroidery-unit-5.jpg',
} as const;

/**
 * Stylized product-UI mockups for the marketing pages. Frames are built from the
 * brand tokens with deliberately generic textile content (shop names, job
 * titles) — never fake real-looking people, never fabricated engagement metrics
 * (views, sales). The fabric swatch tiles now carry real fabric photos (FABRIC
 * above) over a gradient placeholder.
 *
 * All mockups are decorative (aria-hidden). Cross-module links: colours come
 * from the locked --cr-* tokens; the single allowed looping highlight uses the
 * `.mkt-pulse` class (one per page, paused by prefers-reduced-motion).
 */

/**
 * Fabric swatch — a jewel-tone gradient with a subtle textile texture layered
 * over it (pure CSS, no image assets) so a tile reads as cloth, not a flat
 * colour block. `motif` picks the weave: plain weave, zari thread, or an
 * embroidered dot motif. Kept lightweight (GPU-composited gradients, no SVG ids
 * so it stays a server component).
 */
type Motif = 'weave' | 'zari' | 'embroidery';

const MOTIF_BG: Record<Motif, (from: string, to: string) => string> = {
  weave: (from, to) =>
    'repeating-linear-gradient(45deg, rgba(255,255,255,0.10) 0 1px, transparent 1px 5px),' +
    'repeating-linear-gradient(135deg, rgba(0,0,0,0.07) 0 1px, transparent 1px 5px),' +
    `linear-gradient(135deg, ${from}, ${to})`,
  zari: (from, to) =>
    'repeating-linear-gradient(45deg, rgba(255,243,206,0.30) 0 1.5px, transparent 1.5px 6px),' +
    'repeating-linear-gradient(135deg, rgba(0,0,0,0.05) 0 1px, transparent 1px 6px),' +
    `linear-gradient(135deg, ${from}, ${to})`,
  embroidery: (from, to) =>
    'radial-gradient(rgba(255,255,255,0.18) 1px, transparent 1.6px) 0 0 / 9px 9px,' +
    'repeating-linear-gradient(45deg, rgba(255,255,255,0.08) 0 1px, transparent 1px 5px),' +
    `linear-gradient(135deg, ${from}, ${to})`,
};

export function Swatch({
  from,
  to,
  className = '',
  motif = 'weave',
  src,
}: {
  from: string;
  to: string;
  className?: string;
  motif?: Motif;
  src?: string;
}) {
  // The real fabric photo is layered OVER the gradient as a CSS background, so the
  // gradient is a GUARANTEED fallback: if the photo is missing or fails to load,
  // the browser simply paints the gradient beneath (no broken-image icon, and it
  // works with no JS). Decorative — the whole mock is aria-hidden.
  const gradient = MOTIF_BG[motif](from, to);
  return (
    <div
      className={`overflow-hidden rounded-[10px] ${className}`}
      style={{ background: src ? `url("${src}") center / cover no-repeat, ${gradient}` : gradient }}
    />
  );
}

/** Browser/app chrome frame so the mock reads as a real product surface. */
export function Frame({ children, label }: { children: ReactNode; label: string }) {
  return (
    <div
      aria-hidden="true"
      className="overflow-hidden rounded-[20px] border border-[var(--cr-neutral-200)] bg-white shadow-[0_30px_60px_-30px_rgba(14,24,68,0.35)]"
    >
      <div className="flex items-center gap-2 border-b border-[var(--cr-neutral-200)] bg-[var(--cr-cream)] px-4 py-2.5">
        <span className="h-2.5 w-2.5 rounded-full bg-[var(--cr-neutral-300)]" />
        <span className="h-2.5 w-2.5 rounded-full bg-[var(--cr-neutral-300)]" />
        <span className="h-2.5 w-2.5 rounded-full bg-[var(--cr-neutral-300)]" />
        <span className="mkt-mono ml-2 truncate text-[0.66rem] tracking-[0.04em] text-[var(--cr-neutral-500)]">
          {label}
        </span>
      </div>
      <div className="p-4 sm:p-5">{children}</div>
    </div>
  );
}

/** Small reusable verified pill (a real Connect feature, no number attached). */
export function VerifiedPill() {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-[var(--cr-indigo-50)] px-2 py-0.5 text-[0.62rem] font-semibold text-[var(--cr-indigo-700)]">
      <svg viewBox="0 0 16 16" className="h-3 w-3" aria-hidden="true">
        <path
          d="M8 1.5 9.8 3l2.3-.2.6 2.2 1.8 1.4-1 2 1 2-1.8 1.4-.6 2.2L9.8 13 8 14.5 6.2 13l-2.3.2-.6-2.2L1.5 9.6l1-2-1-2 1.8-1.4.6-2.2L6.2 3z"
          fill="var(--cr-indigo-600)"
        />
        <path
          d="M5.6 8.2 7.2 9.8l3.2-3.4"
          fill="none"
          stroke="white"
          strokeWidth="1.3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      Verified
    </span>
  );
}

/** A small chat-bubble glyph for the "enquiry / reply" affordance. */
export function ChatBubble({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" className={className} aria-hidden="true">
      <path
        d="M2.5 4.5h11v6h-7l-2.5 2.5v-2.5h-1.5z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** A short voice-note waveform (decorative bars), reused by the hero tiles. */
export function Waveform({ tone = 'indigo' }: { tone?: 'indigo' | 'white' }) {
  const bar = tone === 'white' ? 'bg-white/70' : 'bg-[var(--cr-indigo-400)]';
  return (
    <span className="flex flex-1 items-center gap-0.5">
      {[5, 9, 14, 8, 11, 6, 13, 7, 10, 6].map((h, index) => (
        <span key={index} className={`w-[3px] rounded-full ${bar}`} style={{ height: `${h}px` }} />
      ))}
    </span>
  );
}

/** Filled heart (liked state). */
function HeartFilled({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" className={className} aria-hidden="true">
      <path
        d="M8 14 2.7 8.5a3.1 3.1 0 1 1 4.4-4.4L8 5l.9-.9a3.1 3.1 0 1 1 4.4 4.4z"
        fill="currentColor"
      />
    </svg>
  );
}

/**
 * Feed post mock — a realistic liked post: avatar, timestamp, two embroidered
 * fabric tiles, a small engagement summary, and an active "Liked" action row.
 * Counts are illustrative and clearly part of the stylized mock.
 */
export function FeedMock() {
  return (
    <Frame label="manekhr.in / feed">
      <div className="flex items-center gap-2.5">
        <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[var(--cr-gold-100)] text-[0.72rem] font-bold text-[var(--cr-gold-700)]">
          EU
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[0.82rem] font-semibold text-[var(--cr-charcoal)]">Embroidery Unit</p>
          <p className="mkt-mono text-[0.6rem] text-[var(--cr-neutral-500)]">
            Surat · 2h · in your trade
          </p>
        </div>
        <span className="text-[1rem] leading-none text-[var(--cr-neutral-400)]" aria-hidden="true">
          ···
        </span>
      </div>
      <p className="pt-2.5 text-[0.78rem] leading-relaxed text-[var(--cr-neutral-600)]">
        New aari-work design on georgette. Taking job-work orders this week.
      </p>
      <div className="mt-2.5 grid grid-cols-2 gap-2">
        <Swatch
          from="#5b2a86"
          to="#9b6dd6"
          motif="embroidery"
          src={PRODUCT.embroideryUnit1}
          className="aspect-[4/3] w-full"
        />
        <Swatch
          from="#1f5f5b"
          to="#52b3a4"
          motif="embroidery"
          src={PRODUCT.embroideryUnit3}
          className="aspect-[4/3] w-full"
        />
      </div>
      <div className="mt-2.5 flex items-center justify-between text-[0.64rem] text-[var(--cr-neutral-500)]">
        <span className="inline-flex items-center gap-1.5">
          <span className="grid h-4 w-4 place-items-center rounded-full bg-[var(--cr-indigo-600)] text-white">
            <HeartFilled className="h-2.5 w-2.5" />
          </span>
          24
        </span>
        <span>3 comments</span>
      </div>
      <div className="mt-2 flex items-center justify-between border-t border-[var(--cr-neutral-200)] pt-2 text-[0.68rem]">
        <span className="inline-flex items-center gap-1.5 font-semibold text-[var(--cr-indigo-700)]">
          <HeartFilled className="h-3.5 w-3.5" />
          Liked
        </span>
        <span className="inline-flex items-center gap-1.5 text-[var(--cr-neutral-500)]">
          <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" aria-hidden="true">
            <path
              d="M2.5 4.5h11v6h-7l-2.5 2.5v-2.5h-1.5z"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.3"
              strokeLinejoin="round"
            />
          </svg>
          Comment
        </span>
        <span className="inline-flex items-center gap-1.5 text-[var(--cr-neutral-500)]">
          <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" aria-hidden="true">
            <path
              d="M11 5 6 8l5 3M6 8H3"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.3"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          Share
        </span>
      </div>
    </Frame>
  );
}

/** Storefront mock — a grid of products under a branded shop. */
export function StorefrontMock() {
  const tiles: Array<{
    from: string;
    to: string;
    name: string;
    price: string;
    motif: Motif;
    src: string;
  }> = [
    {
      from: '#7b2d4e',
      to: '#c0617f',
      name: 'Silk saree',
      price: '₹1,450',
      motif: 'embroidery',
      src: PRODUCT.saree,
    },
    {
      from: '#1f5f5b',
      to: '#4aa39a',
      name: 'Cotton lot',
      price: '₹85 / m',
      motif: 'weave',
      src: PRODUCT.cotton,
    },
    {
      from: '#9a6a1e',
      to: '#d8af55',
      name: 'Zari roll',
      price: '₹240',
      motif: 'zari',
      src: PRODUCT.zari,
    },
    {
      from: '#34407a',
      to: '#6f7fc4',
      name: 'Dress material',
      price: '₹560',
      motif: 'weave',
      src: PRODUCT.dressMaterial,
    },
  ];
  return (
    <Frame label="manekhr.in / shop / cotton-fabrics-co">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[0.9rem] font-semibold text-[var(--cr-charcoal)]">
            Cotton Fabrics Co.
          </p>
          <p className="mkt-mono text-[0.64rem] text-[var(--cr-neutral-500)]">
            12 products · Surat
          </p>
        </div>
        <VerifiedPill />
      </div>
      <div className="mt-3.5 grid grid-cols-2 gap-2.5">
        {tiles.map((tile) => (
          <div key={tile.name} className="rounded-[12px] border border-[var(--cr-neutral-200)] p-2">
            <Swatch
              from={tile.from}
              to={tile.to}
              motif={tile.motif}
              src={tile.src}
              className="aspect-[5/3] w-full"
            />
            <div className="mt-1.5 flex items-center justify-between">
              <span className="text-[0.68rem] font-semibold text-[var(--cr-charcoal)]">
                {tile.name}
              </span>
              <span className="mkt-mono text-[0.62rem] text-[var(--cr-neutral-500)]">
                {tile.price}
              </span>
            </div>
          </div>
        ))}
      </div>
    </Frame>
  );
}

/** RFQ mock — a requirement with two structured quotes to compare. */
export function RfqMock() {
  return (
    <Frame label="manekhr.in / quotes / 50m-cotton-greige">
      <div className="rounded-[12px] bg-[var(--cr-cream)] px-3 py-2.5">
        <p className="text-[0.8rem] font-semibold text-[var(--cr-charcoal)]">
          Need: 500 m cotton greige, 120 GSM
        </p>
        <p className="mkt-mono pt-0.5 text-[0.62rem] text-[var(--cr-neutral-500)]">
          Surat · budget ₹70-80 / m · by Friday
        </p>
      </div>
      <p className="mkt-mono pt-3 text-[0.6rem] tracking-[0.08em] text-[var(--cr-neutral-500)] uppercase">
        2 quotes
      </p>
      <div className="mt-2 space-y-2">
        {[
          { name: 'Mill A', price: '₹74 / m', lead: '3 days' },
          { name: 'Mill B', price: '₹78 / m', lead: 'Same day' },
        ].map((quote) => (
          <div
            key={quote.name}
            className="flex items-center justify-between rounded-[11px] border border-[var(--cr-neutral-200)] px-3 py-2"
          >
            <div className="flex items-center gap-2">
              <span className="grid h-7 w-7 place-items-center rounded-full bg-[var(--cr-indigo-50)] text-[0.62rem] font-bold text-[var(--cr-indigo-700)]">
                {quote.name.slice(-1)}
              </span>
              <div>
                <p className="text-[0.72rem] font-semibold text-[var(--cr-charcoal)]">
                  {quote.price}
                </p>
                <p className="mkt-mono text-[0.58rem] text-[var(--cr-neutral-500)]">
                  Lead {quote.lead}
                </p>
              </div>
            </div>
            <span className="rounded-[8px] border border-[var(--cr-neutral-300)] px-2.5 py-1 text-[0.64rem] font-semibold text-[var(--cr-indigo-700)]">
              Accept
            </span>
          </div>
        ))}
      </div>
    </Frame>
  );
}

/** Jobs mock — a job card with a voice-note apply affordance. */
export function JobsMock() {
  return (
    <Frame label="manekhr.in / jobs / embroidery-karigar">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[0.86rem] font-semibold text-[var(--cr-charcoal)]">
            Embroidery karigar
          </p>
          <p className="mkt-mono pt-0.5 text-[0.62rem] text-[var(--cr-neutral-500)]">
            Surat · full-time · piece-rate
          </p>
        </div>
        <span className="rounded-full bg-[var(--cr-gold-100)] px-2 py-0.5 text-[0.6rem] font-semibold text-[var(--cr-gold-700)]">
          Skill match
        </span>
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {['Aari work', 'Zari', 'Hand embroidery'].map((skill) => (
          <span
            key={skill}
            className="rounded-full border border-[var(--cr-neutral-200)] px-2 py-0.5 text-[0.62rem] text-[var(--cr-neutral-600)]"
          >
            {skill}
          </span>
        ))}
      </div>
      <div className="mt-3.5 flex items-center gap-2 rounded-[11px] border border-[var(--cr-neutral-200)] bg-[var(--cr-cream)] px-3 py-2">
        <span className="grid h-7 w-7 place-items-center rounded-full bg-[var(--cr-indigo-600)] text-white">
          <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" aria-hidden="true">
            <path
              d="M8 2a2 2 0 0 1 2 2v4a2 2 0 0 1-4 0V4a2 2 0 0 1 2-2zM4 8a4 4 0 0 0 8 0M8 12v2"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.2"
              strokeLinecap="round"
            />
          </svg>
        </span>
        <span className="flex flex-1 items-center gap-0.5">
          {[5, 9, 14, 8, 11, 6, 13, 7, 10, 5].map((h, index) => (
            <span
              key={index}
              className="w-[3px] rounded-full bg-[var(--cr-indigo-300)]"
              style={{ height: `${h}px` }}
            />
          ))}
        </span>
        <span className="text-[0.66rem] font-semibold text-[var(--cr-indigo-700)]">
          Apply by voice
        </span>
      </div>
    </Frame>
  );
}

/** Chat mock — a buyer-seller thread tied to a product, with a voice note. */
export function ChatMock() {
  return (
    <Frame label="manekhr.in / chat">
      <div className="flex items-center gap-2.5 border-b border-[var(--cr-neutral-200)] pb-2.5">
        <div className="grid h-8 w-8 place-items-center rounded-full bg-[var(--cr-indigo-600)] text-[0.66rem] font-bold text-white">
          B
        </div>
        <div>
          <p className="text-[0.78rem] font-semibold text-[var(--cr-charcoal)]">Buyer enquiry</p>
          <p className="mkt-mono text-[0.6rem] text-[var(--cr-neutral-500)]">
            about Banarasi saree
          </p>
        </div>
      </div>
      <div className="mt-3 space-y-2.5">
        <div className="max-w-[78%] rounded-[12px] rounded-tl-[4px] bg-[var(--cr-neutral-100)] px-3 py-2 text-[0.74rem] text-[var(--cr-neutral-700)]">
          Do you have this in maroon? Need 20 pieces.
        </div>
        <div className="ml-auto flex max-w-[78%] items-center gap-2 rounded-[12px] rounded-tr-[4px] bg-[var(--cr-indigo-600)] px-3 py-2 text-white">
          <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" aria-hidden="true">
            <path
              d="M4 8v0M4 5v6M7 3v10M10 6v4M13 8v0"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.4"
              strokeLinecap="round"
            />
          </svg>
          <span className="flex flex-1 items-center gap-0.5">
            {[6, 10, 14, 9, 12, 7, 11, 8].map((h, index) => (
              <span
                key={index}
                className="w-[3px] rounded-full bg-white/70"
                style={{ height: `${h}px` }}
              />
            ))}
          </span>
          <span className="mkt-mono text-[0.6rem] text-white/80">0:08</span>
        </div>
      </div>
    </Frame>
  );
}

/** ERP companion mock — a compact factory dashboard glimpse (secondary). */
export function ErpMock() {
  return (
    <Frame label="manekhr.in / erp">
      <div className="grid grid-cols-3 gap-2.5">
        <div className="rounded-[11px] border border-[var(--cr-neutral-200)] p-2.5">
          <p className="mkt-mono text-[0.56rem] tracking-[0.06em] text-[var(--cr-neutral-500)] uppercase">
            Present
          </p>
          <p className="pt-1 text-[1.1rem] font-bold text-[var(--cr-charcoal)]">
            28<span className="text-[0.7rem] font-medium text-[var(--cr-neutral-500)]">/32</span>
          </p>
        </div>
        <div className="rounded-[11px] border border-[var(--cr-neutral-200)] p-2.5">
          <p className="mkt-mono text-[0.56rem] tracking-[0.06em] text-[var(--cr-neutral-500)] uppercase">
            Output
          </p>
          <span className="mt-2 flex items-end gap-0.5">
            {[9, 13, 8, 15, 11, 16].map((h, index) => (
              <span
                key={index}
                className="w-1.5 rounded-sm bg-[var(--cr-indigo-400)]"
                style={{ height: `${h}px` }}
              />
            ))}
          </span>
        </div>
        <div className="rounded-[11px] border border-[var(--cr-neutral-200)] p-2.5">
          <p className="mkt-mono text-[0.56rem] tracking-[0.06em] text-[var(--cr-neutral-500)] uppercase">
            Machines
          </p>
          <p className="pt-1 text-[1.1rem] font-bold text-[var(--cr-charcoal)]">14</p>
        </div>
      </div>
      <div className="mt-2.5 space-y-1.5">
        {[
          {
            label: 'Payroll · this cycle',
            tone: 'var(--cr-indigo-50)',
            text: 'var(--cr-indigo-700)',
            value: 'Ready',
          },
          {
            label: 'GST invoice · #1042',
            tone: 'var(--cr-gold-100)',
            text: 'var(--cr-gold-700)',
            value: 'Posted',
          },
        ].map((row) => (
          <div
            key={row.label}
            className="flex items-center justify-between rounded-[10px] border border-[var(--cr-neutral-200)] px-3 py-1.5"
          >
            <span className="text-[0.68rem] text-[var(--cr-neutral-600)]">{row.label}</span>
            <span
              className="rounded-full px-2 py-0.5 text-[0.6rem] font-semibold"
              style={{ background: row.tone, color: row.text }}
            >
              {row.value}
            </span>
          </div>
        ))}
      </div>
    </Frame>
  );
}

/**
 * Dedicated /textile-marketplace hero mock — a "find verified suppliers" browse
 * panel: a search row, a verified-only filter, and two VERIFIED seller results
 * with enquiry / quote chips, closing on a no-middleman footnote. Leads with
 * verification and direct enquiry, never a price grid, so the marketplace
 * deep-dive page gets its own visual instead of the shared StorefrontMock.
 * Carries the page's single looping highlight (.mkt-pulse) behind the lead
 * "Enquire" chip. Cross-module links: mirrors the marketplace search + storefront
 * surfaces; decorative (aria-hidden via Frame); no fabricated counts or fake
 * people, per the file-header rule.
 */
export function MarketplaceHeroMock() {
  const sellers: Array<{
    name: string;
    cats: string;
    from: string;
    to: string;
    motif: Motif;
    src: string;
    action: string;
    pulse: boolean;
  }> = [
    {
      name: 'Cotton Fabrics Co.',
      cats: 'Greige · cotton lots',
      from: '#1f5f5b',
      to: '#4aa39a',
      motif: 'weave',
      src: PRODUCT.cotton,
      action: 'Enquire',
      pulse: true,
    },
    {
      name: 'Surat Silk House',
      cats: 'Sarees · dress material',
      from: '#7b2d4e',
      to: '#c0617f',
      motif: 'embroidery',
      src: PRODUCT.saree,
      action: 'Get quote',
      pulse: false,
    },
  ];
  return (
    <Frame label="manekhr.in / marketplace">
      {/* Search + verified-only filter (decorative). */}
      <div className="flex items-center gap-2">
        <div className="flex flex-1 items-center gap-2 rounded-[11px] border border-[var(--cr-neutral-200)] bg-[var(--cr-cream)] px-3 py-2">
          <svg
            viewBox="0 0 16 16"
            className="h-3.5 w-3.5 text-[var(--cr-neutral-500)]"
            aria-hidden="true"
          >
            <circle cx="7" cy="7" r="4.5" fill="none" stroke="currentColor" strokeWidth="1.4" />
            <path
              d="m13 13-2.6-2.6"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.4"
              strokeLinecap="round"
            />
          </svg>
          <span className="text-[0.72rem] text-[var(--cr-neutral-600)]">Cotton greige, Surat</span>
        </div>
        <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-[var(--cr-indigo-600)] px-2.5 py-1.5 text-[0.62rem] font-semibold text-white">
          <svg viewBox="0 0 16 16" className="h-3 w-3" aria-hidden="true">
            <path
              d="M3.5 8.5 6.5 11.5 12.5 5"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          Verified only
        </span>
      </div>

      <div className="mt-3 space-y-2.5">
        {sellers.map((seller) => (
          <div
            key={seller.name}
            className="relative rounded-[14px] border border-[var(--cr-neutral-200)] bg-white p-3"
          >
            {seller.pulse ? (
              <span
                className="mkt-pulse absolute -inset-px rounded-[15px] bg-[var(--cr-gold-100)]"
                aria-hidden="true"
              />
            ) : null}
            <div className="relative flex items-center gap-2.5">
              <Swatch
                from={seller.from}
                to={seller.to}
                motif={seller.motif}
                src={seller.src}
                className="h-10 w-10 shrink-0 rounded-[10px]"
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <p className="truncate text-[0.8rem] font-semibold text-[var(--cr-charcoal)]">
                    {seller.name}
                  </p>
                  <VerifiedPill />
                </div>
                <p className="mkt-mono text-[0.58rem] text-[var(--cr-neutral-500)]">
                  {seller.cats}
                </p>
              </div>
              <span className="inline-flex shrink-0 items-center gap-1 rounded-[9px] bg-[var(--cr-indigo-600)] px-2.5 py-1.5 text-[0.64rem] font-semibold text-white">
                <ChatBubble className="h-3 w-3" />
                {seller.action}
              </span>
            </div>
          </div>
        ))}
      </div>

      <p className="mkt-mono mt-3 text-center text-[0.58rem] tracking-[0.04em] text-[var(--cr-neutral-500)]">
        Direct · no middleman · no commission
      </p>
    </Frame>
  );
}

/**
 * Dedicated /textile-jobs hero mock — a jobs board with three roles across
 * employment types (piece-rate, monthly, daily-wage) so the page reads as
 * "every textile role in one place", with skill-match and voice-apply. Its own
 * visual, distinct from the shared single-card JobsMock. Carries the page's
 * single looping highlight (.mkt-pulse) behind the lead "Apply by voice".
 * Decorative (aria-hidden via Frame); no fabricated counts or fake people.
 */
export function JobsHeroMock() {
  return (
    <Frame label="manekhr.in / jobs">
      <div className="flex items-center justify-between">
        <span className="mkt-mono text-[0.6rem] tracking-[0.08em] text-[var(--cr-neutral-500)] uppercase">
          Jobs in your trade
        </span>
        <span className="rounded-full bg-[var(--cr-gold-100)] px-2 py-0.5 text-[0.58rem] font-semibold text-[var(--cr-gold-700)]">
          Skill match
        </span>
      </div>

      {/* Lead role with voice-apply — carries the single looping highlight. */}
      <div className="mt-3 rounded-[14px] border border-[var(--cr-neutral-200)] bg-white p-3">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-[0.8rem] font-semibold text-[var(--cr-charcoal)]">
              Embroidery karigar
            </p>
            <p className="mkt-mono text-[0.58rem] text-[var(--cr-neutral-500)]">
              Surat · piece-rate
            </p>
          </div>
          <span className="shrink-0 rounded-full bg-[var(--cr-gold-100)] px-2 py-0.5 text-[0.58rem] font-semibold text-[var(--cr-gold-700)]">
            Skill match
          </span>
        </div>
        <div className="relative mt-2">
          <span
            className="mkt-pulse absolute -inset-px rounded-[12px] bg-[var(--cr-gold-100)]"
            aria-hidden="true"
          />
          <div className="relative flex items-center gap-2 rounded-[11px] border border-[var(--cr-neutral-200)] bg-[var(--cr-cream)] px-2.5 py-1.5">
            <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-[var(--cr-indigo-600)] text-white">
              <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" aria-hidden="true">
                <path
                  d="M8 2a2 2 0 0 1 2 2v4a2 2 0 0 1-4 0V4a2 2 0 0 1 2-2zM4 8a4 4 0 0 0 8 0M8 12v2"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.2"
                  strokeLinecap="round"
                />
              </svg>
            </span>
            <Waveform />
            <span className="shrink-0 text-[0.64rem] font-semibold text-[var(--cr-indigo-700)]">
              Apply by voice
            </span>
          </div>
        </div>
      </div>

      {/* Two more roles in other employment types — "all in one place". */}
      <div className="mt-2.5 space-y-2">
        {[
          { title: 'Power-loom operator', kind: 'monthly' },
          { title: 'Dyeing helper', kind: 'daily-wage' },
        ].map((job) => (
          <div
            key={job.title}
            className="flex items-center justify-between rounded-[12px] border border-[var(--cr-neutral-200)] bg-white px-3 py-2"
          >
            <div>
              <p className="text-[0.76rem] font-semibold text-[var(--cr-charcoal)]">{job.title}</p>
              <p className="mkt-mono text-[0.56rem] text-[var(--cr-neutral-500)]">
                Surat · {job.kind}
              </p>
            </div>
            <span className="shrink-0 rounded-[8px] border border-[var(--cr-neutral-300)] px-2.5 py-1 text-[0.62rem] font-semibold text-[var(--cr-indigo-700)]">
              1-tap apply
            </span>
          </div>
        ))}
      </div>
    </Frame>
  );
}

/** Map a Connect module id to its mockup. */
export const MODULE_MOCKS: Record<string, () => ReactNode> = {
  feed: FeedMock,
  storefront: StorefrontMock,
  rfq: RfqMock,
  jobs: JobsMock,
  chat: ChatMock,
};
