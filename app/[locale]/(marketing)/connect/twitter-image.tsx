import { ImageResponse } from 'next/og';
import { OG_CONTENT_TYPE, OG_SIZE, renderOgCard } from '@/components/marketing/og';

// Twitter card mirrors the Connect OG card.
export const alt = 'ManekHR Connect - free B2B textile network and marketplace';
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default function TwitterImage() {
  return new ImageResponse(
    renderOgCard({
      eyebrow: 'ManekHR Connect',
      title: 'Get found, sell your work, and hire your people.',
    }),
    size,
  );
}
