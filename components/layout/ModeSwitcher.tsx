'use client';

import { Segmented } from 'antd';
import { AppstoreOutlined, DeploymentUnitOutlined } from '@ant-design/icons';
import { usePathname, useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useAuthStore, useWorkspaceStore } from '@/lib/store';

/**
 * Product switcher - toggles between the two ManekHR products:
 * ERP (`/dashboard`) and Connect (`/connect`). Current mode is derived
 * from the route, so there is no extra state to persist.
 *
 * Lives in the sidebar header, brand-adjacent (directly under the ManekHR
 * logo) and consistent across desktop + the mobile nav drawer. The
 * `collapsed` prop renders the compact icon-only form for the 64px rail.
 *
 * Switching to ERP without a workspace routes to the existing workspace
 * setup flow (the proper ERP onboarding redesign is a separate task).
 */
export default function ModeSwitcher({ collapsed = false }: { collapsed?: boolean }) {
  const pathname = usePathname();
  const router = useRouter();
  const t = useTranslations('connectMode');
  const { user } = useAuthStore();
  const { workspaces } = useWorkspaceStore();

  const mode: 'erp' | 'connect' = pathname?.startsWith('/connect') ? 'connect' : 'erp';
  const hasWorkspace = user?.hasWorkspace !== false && workspaces.length > 0;

  const handleChange = (value: string | number) => {
    if (value === mode) return;
    if (value === 'connect') {
      router.push('/connect/feed');
      return;
    }
    router.push(hasWorkspace ? '/dashboard' : '/auth/setup-workspace');
  };

  // Collapsed 64px rail - stacked icon-only toggle; full labels would not fit.
  if (collapsed) {
    return (
      <Segmented
        className="mode-switcher"
        vertical
        value={mode}
        onChange={handleChange}
        size="small"
        aria-label={t('switchAriaLabel')}
        // Connect is listed first (primary product); ERP second. Order is purely
        // visual - active mode is derived from the route, not list position.
        options={[
          { value: 'connect', label: <DeploymentUnitOutlined />, title: t('switchConnect') },
          { value: 'erp', label: <AppstoreOutlined />, title: t('switchErp') },
        ]}
      />
    );
  }

  // Expanded sidebar / mobile drawer - full-width labelled toggle.
  return (
    <Segmented
      className="mode-switcher"
      block
      value={mode}
      onChange={handleChange}
      aria-label={t('switchAriaLabel')}
      // Connect is listed first (primary product); ERP second. Order is purely
      // visual - active mode is derived from the route, not list position.
      options={[
        {
          value: 'connect',
          label: (
            <span className="inline-flex items-center justify-center gap-1.5">
              <DeploymentUnitOutlined className="text-[13px]" />
              {t('switchConnect')}
            </span>
          ),
        },
        {
          value: 'erp',
          label: (
            <span className="inline-flex items-center justify-center gap-1.5">
              <AppstoreOutlined className="text-[13px]" />
              {t('switchErp')}
            </span>
          ),
        },
      ]}
    />
  );
}
