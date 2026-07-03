/**
 * Inline SVG icon set for the public marketing site.
 *
 * The app ships `@ant-design/icons`, but marketing components must stay
 * AntD-free to keep the public bundle lean - so these are hand-rolled,
 * stroke-based (Lucide-style) glyphs. Pure SVG, no hooks: usable from both
 * server and client components.
 */
import type { ComponentType, SVGProps } from 'react';

type IconProps = SVGProps<SVGSVGElement>;

const STROKE: IconProps = {
  xmlns: 'http://www.w3.org/2000/svg',
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.75,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': true,
  focusable: false,
};

const FILL: IconProps = {
  xmlns: 'http://www.w3.org/2000/svg',
  viewBox: '0 0 24 24',
  fill: 'currentColor',
  'aria-hidden': true,
  focusable: false,
};

export function ArrowUpRightIcon(p: IconProps) {
  return (
    <svg {...STROKE} {...p}>
      <path d="M7 7h10v10" />
      <path d="M7 17 17 7" />
    </svg>
  );
}

export function BuildingIcon(p: IconProps) {
  return (
    <svg {...STROKE} {...p}>
      <path d="M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18Z" />
      <path d="M6 12H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2" />
      <path d="M18 9h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-2" />
      <path d="M10 6h4M10 10h4M10 14h4M10 18h4" />
    </svg>
  );
}

export function TagIcon(p: IconProps) {
  return (
    <svg {...STROKE} {...p}>
      <path d="M12.586 2.586A2 2 0 0 0 11.172 2H4a2 2 0 0 0-2 2v7.172a2 2 0 0 0 .586 1.414l8.704 8.704a2.426 2.426 0 0 0 3.42 0l6.58-6.58a2.426 2.426 0 0 0 0-3.42z" />
      <path d="M7.5 7.5h.01" />
    </svg>
  );
}

export function PencilIcon(p: IconProps) {
  return (
    <svg {...STROKE} {...p}>
      <path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z" />
      <path d="m15 5 4 4" />
    </svg>
  );
}

export function BagIcon(p: IconProps) {
  return (
    <svg {...STROKE} {...p}>
      <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z" />
      <path d="M3 6h18" />
      <path d="M16 10a4 4 0 0 1-8 0" />
    </svg>
  );
}

export function MenuIcon(p: IconProps) {
  return (
    <svg {...STROKE} {...p}>
      <path d="M4 7h16M4 12h16M4 17h16" />
    </svg>
  );
}

export function CloseIcon(p: IconProps) {
  return (
    <svg {...STROKE} {...p}>
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  );
}

export function PlusIcon(p: IconProps) {
  return (
    <svg {...STROKE} {...p}>
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

export function ArrowRightIcon(p: IconProps) {
  return (
    <svg {...STROKE} {...p}>
      <path d="M5 12h14" />
      <path d="m13 5 7 7-7 7" />
    </svg>
  );
}

export function CheckIcon(p: IconProps) {
  return (
    <svg {...STROKE} {...p}>
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

export function GlobeIcon(p: IconProps) {
  return (
    <svg {...STROKE} {...p}>
      <circle cx="12" cy="12" r="10" />
      <path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20" />
      <path d="M2 12h20" />
    </svg>
  );
}

export function LinkedinIcon(p: IconProps) {
  return (
    <svg {...FILL} {...p}>
      <path d="M19 3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2zM8.34 18.34V9.99H5.67v8.35zM7 8.67a1.55 1.55 0 1 0 0-3.1 1.55 1.55 0 0 0 0 3.1zm11.34 9.67v-4.57c0-2.45-1.31-3.59-3.06-3.59a2.64 2.64 0 0 0-2.39 1.31V9.99h-2.67v8.35h2.67v-4.41c0-1.16.22-2.29 1.66-2.29 1.42 0 1.44 1.33 1.44 2.36v4.34z" />
    </svg>
  );
}

export function InstagramIcon(p: IconProps) {
  return (
    <svg {...STROKE} {...p}>
      <rect width="20" height="20" x="2" y="2" rx="5.5" />
      <circle cx="12" cy="12" r="4" />
      <path d="M17.5 6.5h.01" strokeWidth={2.25} />
    </svg>
  );
}

export function WhatsappIcon(p: IconProps) {
  return (
    <svg {...FILL} {...p}>
      <path d="M12.04 2c-5.46 0-9.91 4.45-9.91 9.91 0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38a9.86 9.86 0 0 0 4.74 1.21c5.46 0 9.91-4.45 9.91-9.91A9.86 9.86 0 0 0 19.07 4.9 9.82 9.82 0 0 0 12.04 2zm0 18.15c-1.48 0-2.93-.4-4.2-1.15l-.3-.18-3.12.82.83-3.04-.2-.31a8.23 8.23 0 0 1-1.26-4.39c0-4.54 3.7-8.24 8.25-8.24 2.2 0 4.27.86 5.82 2.42a8.18 8.18 0 0 1 2.42 5.83c0 4.54-3.7 8.24-8.26 8.24zm4.52-6.16c-.25-.12-1.47-.72-1.69-.81-.23-.08-.39-.12-.56.13-.16.25-.64.81-.79.97-.14.17-.29.19-.54.06-.25-.12-1.05-.39-1.99-1.23-.74-.66-1.23-1.47-1.38-1.72-.14-.25-.02-.38.11-.51.11-.11.25-.29.37-.43.13-.14.17-.25.25-.41.08-.17.04-.31-.02-.43-.06-.12-.56-1.35-.77-1.85-.2-.48-.41-.42-.56-.43h-.48c-.17 0-.43.06-.66.31-.22.25-.86.85-.86 2.07 0 1.22.89 2.4 1.01 2.56.12.17 1.75 2.67 4.24 3.74.59.26 1.05.41 1.41.52.59.19 1.13.16 1.56.1.48-.07 1.47-.6 1.68-1.18.21-.58.21-1.07.14-1.18-.06-.1-.22-.16-.47-.28z" />
    </svg>
  );
}

export function NetworkIcon(p: IconProps) {
  return (
    <svg {...STROKE} {...p}>
      <circle cx="12" cy="5" r="2.4" />
      <circle cx="5" cy="18" r="2.4" />
      <circle cx="19" cy="18" r="2.4" />
      <path d="M10.6 6.9 6.4 15.9M13.4 6.9l4.2 9M7.4 18h9.2" />
    </svg>
  );
}

export function StoreIcon(p: IconProps) {
  return (
    <svg {...STROKE} {...p}>
      <path d="M4 9.5 5.2 4h13.6L20 9.5" />
      <path d="M3.5 9.5h17a0 0 0 0 1 0 0 2.5 2.5 0 0 1-5 0 2.5 2.5 0 0 1-5 0 2.5 2.5 0 0 1-5 0 2.5 2.5 0 0 1-5 0 0 0 0 0 1 0 0Z" />
      <path d="M5 12v8h14v-8" />
      <path d="M10 20v-4h4v4" />
    </svg>
  );
}

export function BriefcaseIcon(p: IconProps) {
  return (
    <svg {...STROKE} {...p}>
      <rect width="18" height="13" x="3" y="7.5" rx="2" />
      <path d="M9 7.5V6a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v1.5" />
      <path d="M3 12.5h18" />
    </svg>
  );
}

export function ShieldCheckIcon(p: IconProps) {
  return (
    <svg {...STROKE} {...p}>
      <path d="M12 2.5 5 5v6c0 4.2 2.9 7.6 7 8.9 4.1-1.3 7-4.7 7-8.9V5z" />
      <path d="m9 11.5 2 2 4-4" />
    </svg>
  );
}

export function SearchIcon(p: IconProps) {
  return (
    <svg {...STROKE} {...p}>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </svg>
  );
}

export function LayersIcon(p: IconProps) {
  return (
    <svg {...STROKE} {...p}>
      <path d="m12 2 9 5-9 5-9-5z" />
      <path d="m3 12 9 5 9-5" />
      <path d="m3 17 9 5 9-5" />
    </svg>
  );
}

export function UsersIcon(p: IconProps) {
  return (
    <svg {...STROKE} {...p}>
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13A4 4 0 0 1 16 11" />
    </svg>
  );
}

export function ChatIcon(p: IconProps) {
  return (
    <svg {...STROKE} {...p}>
      <path d="M21 11.5a8.38 8.38 0 0 1-8.5 8.5 8.5 8.5 0 0 1-3.6-.8L3 21l1.8-5.9a8.5 8.5 0 0 1-.8-3.6A8.38 8.38 0 0 1 12.5 3 8.38 8.38 0 0 1 21 11.5z" />
    </svg>
  );
}

export function SparkIcon(p: IconProps) {
  return (
    <svg {...STROKE} {...p}>
      <path d="M12 3v4M12 17v4M3 12h4M17 12h4" />
      <path d="M12 8.5 13.4 11l2.6 1-2.6 1L12 15.5 10.6 13 8 12l2.6-1z" />
    </svg>
  );
}

// Academic-cap glyph for the Institutes persona (training institutes / academies
// on the audience strip). Lucide-style stroke path, no fill.
export function GraduationCapIcon(p: IconProps) {
  return (
    <svg {...STROKE} {...p}>
      <path d="M21.42 10.92a1 1 0 0 0-.02-1.84L12.83 5.18a2 2 0 0 0-1.66 0L2.6 9.08a1 1 0 0 0 0 1.84l8.57 3.9a2 2 0 0 0 1.66 0z" />
      <path d="M22 10v6" />
      <path d="M6 12.5V16a6 3 0 0 0 12 0v-3.5" />
    </svg>
  );
}

// Award / medal glyph for the Students persona; stands for the "Trained at"
// credential a student carries once their institute confirms it.
export function AwardIcon(p: IconProps) {
  return (
    <svg {...STROKE} {...p}>
      <path d="M15.48 12.89 17 21.4a.5.5 0 0 1-.81.47l-3.58-2.69a1 1 0 0 0-1.2 0l-3.59 2.69a.5.5 0 0 1-.81-.47l1.51-8.52" />
      <circle cx="12" cy="8" r="6" />
    </svg>
  );
}

// Wrench glyph for the Service providers & experts persona (consultants,
// machine maintenance, dyeing/printing, transport). Lucide-style stroke path,
// no fill. Used by the audience strip + the /connect "built for" services point.
export function WrenchIcon(p: IconProps) {
  return (
    <svg {...STROKE} {...p}>
      <path d="M14.7 6.3a4 4 0 0 0-5.4 5.3L3 18l3 3 6.4-6.3a4 4 0 0 0 5.3-5.4l-2.8 2.8a1.5 1.5 0 0 1-2.1-2.1z" />
    </svg>
  );
}

// Handshake glyph for the broker / dalal network-trust item: a broker introduces
// a buyer and a seller, both confirm, and a verified track record builds up.
// Lucide-style stroke path, no fill. Used by the home + /connect trust bands.
export function HandshakeIcon(p: IconProps) {
  return (
    <svg {...STROKE} {...p}>
      <path d="m11 17 2 2a1 1 0 1 0 3-3" />
      <path d="m14 14 2.5 2.5a1 1 0 1 0 3-3l-3.88-3.88a3 3 0 0 0-4.24 0l-.88.88a1 1 0 1 1-3-3l2.81-2.81a5.79 5.79 0 0 1 7.06-.87l.47.28a2 2 0 0 0 1.42.25L21 4" />
      <path d="m21 3 1 11h-2" />
      <path d="M3 3 2 14l6.5 6.5a1 1 0 1 0 3-3" />
      <path d="M3 4h8" />
    </svg>
  );
}

/** String-keyed lookup for data-driven icon rendering (roles, socials). */
export const ICONS: Record<string, ComponentType<IconProps>> = {
  arrowUpRight: ArrowUpRightIcon,
  globe: GlobeIcon,
  building: BuildingIcon,
  tag: TagIcon,
  pencil: PencilIcon,
  bag: BagIcon,
  linkedin: LinkedinIcon,
  instagram: InstagramIcon,
  whatsapp: WhatsappIcon,
  network: NetworkIcon,
  store: StoreIcon,
  briefcase: BriefcaseIcon,
  shield: ShieldCheckIcon,
  search: SearchIcon,
  layers: LayersIcon,
  users: UsersIcon,
  chat: ChatIcon,
  spark: SparkIcon,
  graduationCap: GraduationCapIcon,
  award: AwardIcon,
  wrench: WrenchIcon,
  handshake: HandshakeIcon,
};
