import type { ReactNode } from 'react';

/**
 * ConnectLayout - the shared 3-column page shell for Connect content pages.
 *
 * Main column always renders; a right rail appears at >=lg; a left rail at >=xl.
 * Mobile shows the main column alone (rails are supplementary). The rails are
 * composable slots - pass a profile card, a suggestions widget, an `AdSlot`, or
 * nothing. An omitted rail collapses its column (no empty gutters), so the grid
 * adapts to whichever rails a page supplies.
 *
 * This replaces ad-hoc per-page width containers so every Connect page shares
 * one structure, and so the rails are a ready home for ads / widgets (the
 * future-proof layout the product needs for an ad system + "people you may
 * know"-style modules).
 */
interface ConnectLayoutProps {
  children: ReactNode;
  /** Left rail (>=xl). LinkedIn-style profile / context card lives here. */
  left?: ReactNode;
  /** Right rail (>=lg). Suggestions / ads live here. */
  right?: ReactNode;
  /** Full-width row above the columns - page back-link / breadcrumb / title. */
  topBar?: ReactNode;
}

export default function ConnectLayout({ children, left, right, topBar }: ConnectLayoutProps) {
  // Column template adapts to which rails are present. All four literal class
  // strings are present so Tailwind's JIT generates them.
  let cols = 'grid-cols-1';
  if (left && right) {
    cols =
      'grid-cols-1 lg:grid-cols-[minmax(0,1fr)_320px] xl:grid-cols-[240px_minmax(0,1fr)_320px]';
  } else if (right) {
    cols = 'grid-cols-1 lg:grid-cols-[minmax(0,1fr)_320px]';
  } else if (left) {
    cols = 'grid-cols-1 xl:grid-cols-[240px_minmax(0,1fr)]';
  }

  return (
    <div className="mx-auto w-full max-w-[1200px] px-4 pb-6 sm:px-6">
      {topBar ? <div className="mb-4">{topBar}</div> : null}
      <div className={`grid gap-6 ${cols}`}>
        {left ? <aside className="hidden flex-col gap-4 xl:flex">{left}</aside> : null}
        <main className="min-w-0">{children}</main>
        {right ? <aside className="hidden flex-col gap-4 lg:flex">{right}</aside> : null}
      </div>
    </div>
  );
}
