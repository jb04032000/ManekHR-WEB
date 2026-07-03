'use client';

// ManekHR brand loading mark. Renders the animated emerald + gold gem
// "stitch-loop" asset (public/manekhr-stitch-loop.svg) at a caller-given size.
// Single brand spinner for the dashboard shell (components/layout/DashboardLayout.tsx)
// and the route-change overlay (components/PageTransitionLoader.tsx). Watch:
// `src` defaults to the bundled brand asset; keep that SVG in sync with the
// brand colours (emerald #0B6E4F + gold #C49A2E).
interface ManekHRStitchLoaderProps {
  size?: number;
  src?: string;
}

export function ManekHRStitchLoader({
  size = 240,
  src = '/manekhr-stitch-loop.svg',
}: ManekHRStitchLoaderProps) {
  return (
    <div style={{ width: size, height: size }}>
      <img
        src={src}
        alt="ManekHR loading"
        width={size}
        height={size}
        style={{ width: '100%', height: '100%', display: 'block' }}
      />
    </div>
  );
}
