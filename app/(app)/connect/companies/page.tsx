import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';

/**
 * `/connect/companies` - the company directory is an owner-decided NON-user-facing
 * surface (see CLAUDE.md "Product scope - do NOT build or show"), so this route is
 * hidden: any direct hit is redirected to the feed. The directory screen + its
 * browse/promoted-rail data layer were intentionally removed from this page (they
 * were unreachable dead code after the redirect). Do NOT re-add a render path here
 * without an explicit product decision to surface companies to users again.
 */

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('connect.companies');
  return { title: t('title') };
}

export default async function ConnectCompaniesPage() {
  // Companies directory is hidden -- redirect anyone who hits this URL directly.
  redirect('/connect/feed');
}
