/**
 * Shop Floor stage catalogue + SVG illustration library.
 *
 * What: defines the 12 production stages (label, accent colour, station flag,
 * default piece-rate) and one hand-drawn SVG illustration per stage. The same
 * drawing is reused EVERYWHERE on the Shop Floor page (floor map, process
 * nodes, stencil rail, CPM/PERT networks) so every view reads as one system.
 *
 * Links: consumed by components/machines/shop-floor/* and
 * app/dashboard/machines/shop-floor/page.tsx. Stage keys are validated by the
 * backend WorkOrderStep schema (crewroster-backend machines/work-orders) -
 * keep STAGE_KEYS in sync with the BE enum.
 *
 * Watch: art functions return raw SVG strings (rendered via
 * dangerouslySetInnerHTML inside <g>/<svg>) - never interpolate user input
 * into them. Colours are tuned for the LIGHT theme (cream surface).
 */

export const STAGE_KEYS = [
  'inward',
  'design',
  'marking',
  'embroidery',
  'handwork',
  'cutting',
  'washing',
  'sewing',
  'finishing',
  'qc',
  'packing',
  'dispatch',
] as const;

export type StageKey = (typeof STAGE_KEYS)[number];

export interface StageMeta {
  label: string;
  /** Accent colour - saturated-dark so it reads on the cream/light surface. */
  accent: string;
  /** true = a machine/station stage; false = manual/hand stage (no machine). */
  station: boolean;
  /** Suggested wage ₹/pc default for new steps. */
  rate: number;
}

export const STAGE: Record<StageKey, StageMeta> = {
  inward: { label: 'Material In', accent: '#64748B', station: false, rate: 0 },
  design: { label: 'Design Prep', accent: '#7C3AED', station: true, rate: 0 },
  marking: { label: 'Marking', accent: '#CA8A04', station: true, rate: 2 },
  embroidery: { label: 'Embroidery', accent: '#0D9488', station: true, rate: 14 },
  handwork: { label: 'Hand Work', accent: '#DB2777', station: false, rate: 10 },
  cutting: { label: 'Cutting', accent: '#E11D48', station: true, rate: 3 },
  washing: { label: 'Washing', accent: '#2563EB', station: false, rate: 2 },
  sewing: { label: 'Sewing', accent: '#EA580C', station: true, rate: 8 },
  finishing: { label: 'Finish / Press', accent: '#16A34A', station: true, rate: 2 },
  qc: { label: 'QC Check', accent: '#0891B2', station: false, rate: 1 },
  packing: { label: 'Packing', accent: '#A16207', station: false, rate: 1 },
  dispatch: { label: 'Dispatch', accent: '#64748B', station: false, rate: 0 },
};

export const STENCIL_ORDER: StageKey[] = [...STAGE_KEYS];
export const ROUTE_ORDER: StageKey[] = [...STAGE_KEYS];

export function isStageKey(v: string): v is StageKey {
  return (STAGE_KEYS as readonly string[]).includes(v);
}

/**
 * Map a Machine.type free-text value (machines module: embroidery / cutting /
 * printing / other + anything custom) onto the closest stage illustration.
 */
export function machineArtKind(type: string | undefined): StageKey {
  const t = (type ?? '').toLowerCase();
  if (t.includes('embroid')) return 'embroidery';
  if (t.includes('cut')) return 'cutting';
  if (t.includes('print') || t.includes('mark')) return 'marking';
  if (t.includes('wash')) return 'washing';
  if (t.includes('finish') || t.includes('press') || t.includes('iron')) return 'finishing';
  if (t.includes('design') || t.includes('punch')) return 'design';
  if (t.includes('pack')) return 'packing';
  // Generic table-top machine silhouette for 'other' / unknown types.
  return 'sewing';
}

// ── Illustration library (box 230×150, light-theme palette) ────────────────
export const ART_W = 230;
export const ART_H = 150;
const GREY = '#94A3B8'; // machine body / structural grey
const GREY2 = '#C3CCDA'; // lighter structural grey
const FAB = '#EDE9F7'; // fabric panels
const SCREEN = '#334155'; // monitor / window glass

function legs(y: number): string {
  return `<rect x="16" y="${y}" width="10" height="${148 - y}" fill="${GREY}"/><rect x="${ART_W - 26}" y="${y}" width="10" height="${148 - y}" fill="${GREY}"/>`;
}

const AW = ART_W;

type ArtFn = (c: string) => string;

const ART: Record<StageKey, ArtFn> = {
  design: (
    c,
  ) => `<rect x="10" y="84" width="${AW - 20}" height="34" rx="5" fill="${c}" opacity=".13" stroke="${c}" stroke-width="1.6"/>${legs(118)}
    <rect x="64" y="14" width="100" height="58" rx="6" fill="${SCREEN}" stroke="${c}" stroke-width="2"/>
    <path d="M92 56 q10 -22 24 -10 q14 12 22 -14" fill="none" stroke="#A5F3FC" stroke-width="2"/>
    <circle cx="100" cy="34" r="5" fill="none" stroke="#A5F3FC" stroke-width="1.6"/>
    <rect x="104" y="72" width="20" height="8" fill="${GREY}"/><rect x="84" y="80" width="60" height="5" rx="2" fill="${GREY2}"/>
    <rect x="24" y="90" width="44" height="22" rx="4" fill="${GREY2}" stroke="${c}"/><line x1="30" y1="96" x2="62" y2="96" stroke="${c}" stroke-width="1.2" opacity=".7"/>
    <g transform="translate(176,88) rotate(40)"><rect width="30" height="7" rx="3" fill="${GREY}" stroke="${c}"/><path d="M30 0 l7 3.5 l-7 3.5 z" fill="${c}"/></g>`,
  marking: (
    c,
  ) => `<rect x="8" y="80" width="${AW - 16}" height="38" rx="5" fill="${c}" opacity=".13" stroke="${c}" stroke-width="1.6"/>${legs(118)}
    <rect x="22" y="88" width="${AW - 44}" height="22" rx="3" fill="${FAB}"/>
    <line x1="32" y1="94" x2="${AW - 32}" y2="94" stroke="${c}" stroke-width="1.4" stroke-dasharray="3 4"/>
    <line x1="32" y1="100" x2="${AW - 58}" y2="100" stroke="${c}" stroke-width="1.4" stroke-dasharray="3 4"/>
    <path d="M32 106 q24 -8 48 0 t48 0 t48 0" fill="none" stroke="${c}" stroke-width="1.4" stroke-dasharray="3 4"/>
    <path d="M${AW - 66} 22 L${AW - 26} 22 L${AW - 66} 62 Z" fill="none" stroke="${c}" stroke-width="2"/>
    <g transform="translate(36,36) rotate(35)"><rect width="36" height="9" rx="3" fill="${GREY}" stroke="${c}"/><path d="M36 0 l8 4.5 l-8 4.5 z" fill="${c}"/></g>`,
  embroidery: (
    c,
  ) => `<rect x="0" y="6" width="${AW}" height="18" rx="7" fill="${GREY2}" stroke="${GREY}"/>
    ${[0, 1, 2, 3, 4]
      .map(
        (
          i,
        ) => `<g transform="translate(${28 + i * ((AW - 56) / 4)},24)"><rect x="-11" y="0" width="22" height="28" rx="4" fill="${GREY}" stroke="${GREY2}"/>
      <line x1="0" y1="28" x2="0" y2="48" stroke="${c}" stroke-width="2.6"/><circle cx="0" cy="50" r="2.6" fill="${c}"/><circle cx="0" cy="6" r="3.6" fill="${c}" opacity=".85"/></g>`,
      )
      .join('')}
    <rect x="8" y="78" width="${AW - 16}" height="38" rx="7" fill="${c}" opacity=".14" stroke="${c}" stroke-width="1.6"/>
    <path d="M18 97 q24 -11 48 0 t48 0 t48 0 t46 0" fill="none" stroke="${c}" stroke-width="1.8" opacity=".8"/>${legs(116)}`,
  handwork: (
    c,
  ) => `<rect x="28" y="34" width="${AW - 56}" height="78" rx="6" fill="none" stroke="#B08968" stroke-width="7"/>
    <rect x="36" y="42" width="${AW - 72}" height="62" fill="${FAB}"/>
    <path d="M58 86 q22 -28 50 -8 q26 18 48 -16" fill="none" stroke="${c}" stroke-width="2.2"/>
    <circle cx="108" cy="72" r="6" fill="none" stroke="${c}" stroke-width="1.6"/>
    <line x1="150" y1="40" x2="170" y2="16" stroke="${c}" stroke-width="2"/><path d="M170 16 q10 -6 6 6 q-4 10 6 4" fill="none" stroke="${c}" stroke-width="1.6"/>
    <rect x="46" y="120" width="14" height="18" rx="3" fill="${GREY2}" stroke="${c}"/><rect x="66" y="124" width="14" height="14" rx="3" fill="${GREY2}" stroke="${c}"/>`,
  cutting: (
    c,
  ) => `<rect x="8" y="76" width="${AW - 16}" height="42" rx="5" fill="${c}" opacity=".13" stroke="${c}" stroke-width="1.6"/>${legs(118)}
    <rect x="22" y="84" width="${AW - 44}" height="26" rx="2" fill="${FAB}"/>
    <polyline points="22,97 34,91 46,97 58,91 70,97 82,91 94,97 106,91 118,97" fill="none" stroke="${c}" stroke-width="1.8"/>
    <g transform="translate(${AW - 70},28)"><circle cx="0" cy="14" r="13" fill="none" stroke="${c}" stroke-width="2.6"/><circle cx="0" cy="14" r="4" fill="${c}"/>
      <rect x="8" y="6" width="36" height="9" rx="4" fill="${GREY}" stroke="${c}" transform="rotate(-22 8 10)"/></g>
    <g transform="translate(34,34)"><path d="M0 0 L26 15 M0 15 L26 0" stroke="${c}" stroke-width="2"/><circle r="3.5" fill="none" stroke="${c}" stroke-width="2"/><circle cy="15" r="3.5" fill="none" stroke="${c}" stroke-width="2"/></g>`,
  washing: (
    c,
  ) => `<path d="M36 64 h158 l-14 56 q-2 10 -12 10 h-106 q-10 0 -12 -10 z" fill="${c}" opacity=".15" stroke="${c}" stroke-width="2"/>
    <ellipse cx="115" cy="64" rx="79" ry="11" fill="none" stroke="${c}" stroke-width="2"/>
    <path d="M52 78 q16 -8 32 0 t32 0 t32 0 t28 0" fill="none" stroke="${c}" stroke-width="2" opacity=".8"/>
    <path d="M86 30 q5 8 0 14 M115 22 q5 8 0 14 M144 30 q5 8 0 14" fill="none" stroke="${c}" stroke-width="2" stroke-linecap="round"/>`,
  sewing: (
    c,
  ) => `<rect x="0" y="88" width="${AW}" height="14" rx="5" fill="${GREY2}" stroke="${GREY}"/>${legs(102)}
    <path d="M58 88 V40 q0 -15 15 -15 h72 q15 0 15 15 v13 h-17 v-13 h-63 v48 z" fill="${GREY}" stroke="${GREY2}"/>
    <line x1="151" y1="53" x2="151" y2="78" stroke="${c}" stroke-width="2.8"/><circle cx="151" cy="80" r="2.6" fill="${c}"/>
    <circle cx="66" cy="38" r="11" fill="none" stroke="${c}" stroke-width="2.8"/>
    <rect x="112" y="76" width="68" height="10" rx="3" fill="${c}" opacity=".3" stroke="${c}"/>`,
  finishing: (
    c,
  ) => `<rect x="14" y="86" width="200" height="17" rx="9" fill="${c}" opacity=".18" stroke="${c}" stroke-width="1.8"/>
    <line x1="44" y1="103" x2="86" y2="146" stroke="${GREY}" stroke-width="8"/><line x1="186" y1="103" x2="144" y2="146" stroke="${GREY}" stroke-width="8"/>
    <path d="M78 78 q0 -26 30 -26 h44 q14 0 14 14 v12 z" fill="${GREY}" stroke="${c}" stroke-width="2"/>
    <path d="M96 52 q4 -12 18 -12 h28" fill="none" stroke="${c}" stroke-width="2.4"/>
    <path d="M62 56 q-5 -8 0 -14 M50 64 q-5 -8 0 -14" fill="none" stroke="${c}" stroke-width="2" stroke-linecap="round"/>
    <path d="M166 64 q22 -4 30 -22" fill="none" stroke="${GREY2}" stroke-width="2" stroke-dasharray="4 4"/>`,
  inward: (
    c,
  ) => `<path d="M52 44 L96 28 L140 44 L140 92 L96 108 L52 92 Z" fill="${c}" opacity=".15" stroke="${c}" stroke-width="1.8"/>
    <path d="M52 44 L96 60 L140 44 M96 60 V108" fill="none" stroke="${c}" stroke-width="1.5"/>
    <circle cx="176" cy="58" r="14" fill="none" stroke="${c}" stroke-width="2.2"/><circle cx="176" cy="58" r="4" fill="${c}"/>
    <rect x="176" y="44" width="38" height="28" fill="${c}" opacity=".15" stroke="${c}" stroke-width="1.6"/>
    <rect x="48" y="108" width="120" height="12" rx="3" fill="${GREY2}"/>`,
  qc: (
    c,
  ) => `<rect x="8" y="84" width="${AW - 16}" height="34" rx="5" fill="${c}" opacity=".13" stroke="${c}" stroke-width="1.6"/>${legs(118)}
    <path d="M186 84 V46 q0 -10 -10 -10 h-22" fill="none" stroke="${GREY2}" stroke-width="4"/>
    <path d="M154 26 l-22 12 l22 12 z" fill="${GREY2}" stroke="${c}" stroke-width="1.6"/>
    <path d="M132 38 L74 84 h58 z" fill="${c}" opacity=".10"/>
    <rect x="40" y="58" width="42" height="30" rx="3" fill="#FFF" stroke="${GREY2}" transform="rotate(-6 40 58)"/>
    <path d="M48 70 l6 6 l12 -12" fill="none" stroke="${c}" stroke-width="2.6" transform="rotate(-6 40 58)"/>
    <circle cx="112" cy="66" r="12" fill="none" stroke="${c}" stroke-width="2.4"/><line x1="121" y1="75" x2="134" y2="86" stroke="${c}" stroke-width="3.2"/>`,
  packing: (
    c,
  ) => `<rect x="58" y="64" width="92" height="54" rx="3" fill="${c}" opacity=".15" stroke="${c}" stroke-width="2"/>
    <path d="M58 64 l-22 -16 l54 -6 z M150 64 l22 -16 l-54 -6 z" fill="${c}" opacity=".22" stroke="${c}" stroke-width="1.6"/>
    <path d="M84 64 q8 -18 20 0 q10 -16 20 0" fill="none" stroke="${GREY}" stroke-width="2.4"/>
    <line x1="104" y1="64" x2="104" y2="118" stroke="${c}" stroke-width="3" opacity=".5"/>
    <circle cx="184" cy="100" r="15" fill="none" stroke="${c}" stroke-width="4"/><circle cx="184" cy="100" r="5" fill="${GREY}"/>`,
  dispatch: (
    c,
  ) => `<rect x="26" y="52" width="108" height="52" rx="5" fill="${c}" opacity=".15" stroke="${c}" stroke-width="2"/>
    <path d="M134 66 h36 l22 22 v16 h-58 z" fill="${c}" opacity=".22" stroke="${c}" stroke-width="2"/>
    <rect x="142" y="72" width="22" height="14" rx="2" fill="${SCREEN}" stroke="${c}"/>
    <circle cx="62" cy="108" r="11" fill="${GREY2}" stroke="${c}" stroke-width="2.4"/><circle cx="168" cy="108" r="11" fill="${GREY2}" stroke="${c}" stroke-width="2.4"/>
    <line x1="6" y1="66" x2="20" y2="66" stroke="${c}" stroke-width="2" opacity=".6"/><line x1="0" y1="80" x2="18" y2="80" stroke="${c}" stroke-width="2" opacity=".4"/>`,
};

/** Raw illustration group for embedding inside an outer <svg>. */
export function art(kind: StageKey | string, color: string): string {
  const fn = ART[(isStageKey(kind) ? kind : 'sewing') as StageKey] ?? ART.sewing;
  return `<g>${fn(color)}</g>`;
}

/** Standalone <svg> icon string (stencil tiles, modals). */
export function artIcon(kind: StageKey | string, color: string, w = 84, h = 46): string {
  return `<svg viewBox="0 0 ${ART_W} ${ART_H}" width="${w}" height="${h}" aria-hidden="true">${art(kind, color)}</svg>`;
}

/** Escape a string for safe interpolation into SVG markup strings. */
export function svgEsc(s: string | null | undefined): string {
  return String(s ?? '').replace(
    /[<>&"]/g,
    (ch) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' })[ch] as string,
  );
}

/** ₹ formatter shared by every Shop Floor view. */
export function fmtINR(n: number): string {
  return '₹' + Math.round(n).toLocaleString('en-IN');
}
