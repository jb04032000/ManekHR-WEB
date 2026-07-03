'use client';

/**
 * HideOnPaths - render children everywhere EXCEPT routes starting with `prefix`
 * (a single prefix, or any of an array of prefixes).
 *
 * Used to drop the footer (and any normal-page chrome) on full-screen app
 * surfaces like the inbox (fills the viewport like a native chat app) and dense
 * management consoles like a storefront's manage page (the footer is just noise
 * that pushes content down there).
 */

import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';

export default function HideOnPaths({
  prefix,
  children,
}: {
  prefix: string | string[];
  children: ReactNode;
}) {
  const pathname = usePathname();
  const prefixes = Array.isArray(prefix) ? prefix : [prefix];
  if (pathname && prefixes.some((p) => pathname.startsWith(p))) return null;
  return <>{children}</>;
}
