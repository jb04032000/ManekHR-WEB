import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { env } from '@/lib/env';
import DesignSystemGallery from './DesignSystemGallery';

/**
 * /design-system - internal component gallery for ManekHR Connect.
 *
 * Every shared Connect component is rendered here in isolation so it can be
 * reviewed without clicking through routes (ENGINEERING-STANDARDS #11).
 * Dev-only - returns 404 in production.
 */

export const metadata: Metadata = {
  title: 'Connect - Design System',
  robots: { index: false, follow: false },
};

export default function DesignSystemPage() {
  if (env.isProd) notFound();
  return <DesignSystemGallery />;
}
