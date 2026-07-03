import type { Metadata } from 'next';
import { adminListBanners } from '@/features/connect/banners/banner.actions';
import AdminBannersConsole from '@/features/connect/banners/AdminBannersConsole';

/**
 * /admin/connect/banners - platform-admin management for the Connect feed
 * banner carousel.
 *
 * Guarded by AdminLayout (client isAdmin redirect) + the backend IsAdminGuard.
 * Loads the full banner list (all states); a read failure degrades to an empty
 * list rather than erroring the page (mirrors the moderation console).
 */

export const metadata: Metadata = { title: 'Feed banners' };

export default async function AdminConnectBannersPage() {
  const res = await adminListBanners();
  const banners = res.ok ? res.data : [];

  return <AdminBannersConsole initialBanners={banners} />;
}
