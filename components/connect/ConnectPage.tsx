'use client';

/**
 * ConnectPage - the shared content-width container for every Connect screen.
 *
 * Replaces ad-hoc per-file `max-width` declarations so every Connect page
 * gets the same horizontal spacing and any new page inherits it automatically.
 * The `DashboardLayout` shell already centers content + caps at 1400px and
 * applies the outer horizontal padding; this layer adds the page-specific
 * reading width inside that.
 *
 * **Sidebar-responsive width.** The max-width comes from the
 * `--cn-content-max-w` CSS variable, which `globals.css` defaults to 1180 px
 * and bumps to 1380 px when the sidebar is collapsed
 * (`[data-sidebar-collapsed='true']` is set on the dashboard layout root).
 * Earlier shipped as a hardcoded 1180 / 1280 cap - both left noticeable empty
 * margin on a collapsed sidebar at 1440 px viewports. The CSS-var swap lets
 * the rails + feed column inside actually grow into the freed space rather
 * than the container just centering wider with the same content packed.
 *
 * Pages that need an inner flex/grid layout pass it via `className` - the
 * wrapper merges those classes into its own, so we don't add a redundant
 * nested `<div>`. The default tag is `<div>`; pages that want a different
 * semantic root (e.g. `<article>` for a profile) put it as a child.
 */

import type { CSSProperties, ReactNode } from 'react';

export interface ConnectPageProps {
  /** Extra classes merged onto the wrapper (e.g. `flex justify-center gap-5`). */
  className?: string;
  /** Extra inline styles merged onto the wrapper. Used e.g. by the company-page
   *  manage console to set a viewport-fill `minHeight` so a short main column
   *  still stretches the right `Rail`'s aside, giving its sticky travel room
   *  (see Rail.tsx - sticky is bounded by this flex row's height). */
  style?: CSSProperties;
  children: ReactNode;
}

export default function ConnectPage({ className, style, children }: ConnectPageProps) {
  const cls = `mx-auto w-full${className ? ` ${className}` : ''}`;
  return (
    <div className={cls} style={{ maxWidth: 'var(--cn-content-max-w, 1180px)', ...style }}>
      {children}
    </div>
  );
}
