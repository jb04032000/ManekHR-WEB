import { ImageResponse } from 'next/og';
import { OG_CONTENT_TYPE, OG_SIZE, renderOgCard } from '@/components/marketing/og';

// Twitter card mirrors the default marketing OG card.
export const alt = 'ManekHR - the textile trade network and marketplace';
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default function TwitterImage() {
  return new ImageResponse(
    renderOgCard({
      eyebrow: 'ManekHR',
      title: "The textile trade's own network and marketplace.",
    }),
    size,
  );
}
