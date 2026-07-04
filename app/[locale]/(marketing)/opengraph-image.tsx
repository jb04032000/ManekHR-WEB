import { ImageResponse } from 'next/og';
import { OG_CONTENT_TYPE, OG_SIZE, renderOgCard } from '@/components/marketing/og';

// Default branded OG card for the marketing route group (home + every page that
// does not override it). Cross-module links: renderOgCard in
// components/marketing/og.tsx.
export const alt = 'ManekHR - staff and salary management for diamond-polishing units';
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default function OpengraphImage() {
  return new ImageResponse(
    renderOgCard({
      eyebrow: 'ManekHR',
      title: 'Staff and salary management for diamond-polishing units.',
    }),
    size,
  );
}
