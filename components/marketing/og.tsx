import type { ReactElement } from 'react';

/**
 * Shared branded OpenGraph / Twitter card renderer for the marketing pages,
 * used by the per-page `opengraph-image.tsx` / `twitter-image.tsx` routes via
 * next/og's ImageResponse. ImageResponse cannot read CSS variables or Tailwind,
 * so brand colours are inlined here (kept in sync with the --cr-* tokens):
 * navy #0B6E4F / #0e1844, gold #c9a227, cream #faf8f3.
 *
 * No custom fonts are loaded (default sans) so generation is robust at build.
 */
export const OG_SIZE = { width: 1200, height: 630 };
export const OG_CONTENT_TYPE = 'image/png';

export function renderOgCard(opts: { eyebrow: string; title: string }): ReactElement {
  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        padding: '72px 80px',
        background: 'linear-gradient(135deg, #0B6E4F 0%, #0e1844 100%)',
        color: '#ffffff',
        fontFamily: 'sans-serif',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            fontSize: 40,
            fontWeight: 800,
            letterSpacing: -1,
          }}
        >
          <span style={{ color: '#ffffff' }}>Zari</span>
          <span style={{ color: '#d8af55' }}>360</span>
        </div>
        <div
          style={{ display: 'flex', height: 6, width: 120, background: '#c9a227', borderRadius: 4 }}
        />
      </div>

      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <div
          style={{
            display: 'flex',
            alignSelf: 'flex-start',
            fontSize: 22,
            fontWeight: 700,
            letterSpacing: 3,
            textTransform: 'uppercase',
            color: '#d8af55',
            marginBottom: 24,
          }}
        >
          {opts.eyebrow}
        </div>
        <div
          style={{ display: 'flex', fontSize: 64, fontWeight: 700, lineHeight: 1.1, maxWidth: 980 }}
        >
          {opts.title}
        </div>
      </div>

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          fontSize: 26,
          color: 'rgba(255,255,255,0.72)',
        }}
      >
        Staff & salary made simple · built in Surat
      </div>
    </div>
  );
}
