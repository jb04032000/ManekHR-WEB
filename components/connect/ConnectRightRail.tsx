'use client';

/**
 * ConnectRightRail - the standard right-hand column for a Connect content page.
 *
 * Reserves the ad surface (house ad engine + any future external network via
 * the `AdSlot` provider seam) above and below an optional contextual panel, so
 * every page that opts in gets the same ad-ready layout with one element. The
 * ad slots render nothing until a provider is wired, so the rail collapses to
 * just its panel today and lights up with ads later - no page change needed.
 *
 * Hidden below `xl` like every Connect rail (mobile-first; the main column owns
 * the width). Drop it as the last child of a `<ConnectPage className="flex
 * gap-5">` next to the `<main>`.
 */

import type { ReactNode } from 'react';
import Rail from './Rail';
import AdSlot from './AdSlot';

export default function ConnectRightRail({ children }: { children?: ReactNode }) {
  return (
    <Rail side="right">
      <AdSlot placement="connect.right.top" />
      {children}
      <AdSlot placement="connect.right.mid" />
    </Rail>
  );
}
